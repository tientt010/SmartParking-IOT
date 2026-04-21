import prisma from "../config/prisma.js";
import axios from "axios";
import FormData from "form-data";

const callAIService = async (imageInput) => {
  try {
    const formData = new FormData();
    let imageBuffer;

    if (typeof imageInput === "string") {
      const base64Data = imageInput.startsWith("data:image")
        ? imageInput.split(",")[1]
        : imageInput;
      imageBuffer = Buffer.from(base64Data, "base64");
    } else {
      imageBuffer = imageInput;
    }

    formData.append("image", imageBuffer, {
      filename: "plate.jpg",
      contentType: "image/jpeg",
    });

    const aiUrl = process.env.AI_SERVICE_URL || "http://localhost:5001";
    const response = await axios.post(`${aiUrl}/api/lpr/detect`, formData, {
      headers: formData.getHeaders(),
      timeout: 15000,
    });

    return response.data?.success ? response.data.plate_number : null;
  } catch (err) {
    console.error("[LPR] AI Service error:", err.message);
    return null;
  }
};

export const lprController = async (req, res) => {
  try {
    const image = req.file ? req.file.buffer : req.body.image;
    if (!image) return res.status(400).json({ action: "deny", reason: "No image provided" });

    console.log("[LPR] Processing image...");
    const plateNumber = await callAIService(image);
    console.log("[LPR] Detected plate:", plateNumber);

    if (!plateNumber) {
      return res.json({ action: "deny", reason: "Could not detect license plate" });
    }

    const whitelistEntry = await prisma.whitelist.findFirst({
      where: { vehiclePlate: plateNumber, status: "active" },
    });

    if (!whitelistEntry) {
      console.log("[LPR] Plate NOT in whitelist - DENY:", plateNumber);
      await prisma.log.create({
        data: { vehiclePlate: plateNumber, action: "entry", status: "denied" },
      });

      req.app.get("io")?.emit("lpr:result", {
        number: plateNumber, action: "deny", reason: "Not in whitelist",
      });
      return res.json({ action: "deny", reason: "Not in whitelist" });
    }

    // Accepted - log + open gate via MQTT
    await prisma.log.create({
      data: {
        vehiclePlate: plateNumber,
        action: "entry",
        status: "accepted",
        entryTime: new Date(),
      },
    });

    req.app.get("io")?.emit("lpr:result", { number: plateNumber, action: "accept" });

    const mqttClient = req.app.get("mqttClient");
    if (mqttClient) {
      mqttClient.publish("parking/gate1/control", "open_then_close", { qos: 1 });
      console.log("[LPR] MQTT command sent: open gate1");
    }

    console.log("[LPR] ACCEPTED:", plateNumber);
    res.json({ action: "accept", plate: plateNumber });
  } catch (err) {
    console.error("[LPR] Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
