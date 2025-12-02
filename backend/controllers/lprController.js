import Log from "../models/Log.js";
import ParkingSlot from "../models/ParkingSlot.js";
import Whitelist from "../models/Whitelist.js";
import axios from "axios";
import FormData from "form-data";

const callAIService = async (image) => {
  try {
    const formData = new FormData();
    let imageBuffer;
    if (typeof image === "string") {
      if (image.startsWith("data:image")) {
        const base64Data = image.split(",")[1] || image;
        imageBuffer = Buffer.from(base64Data, "base64");
      } else {
        imageBuffer = Buffer.from(image, "base64");
      }
    } else {
      imageBuffer = image;
    }

    formData.append("image", imageBuffer, {
      filename: "plate.jpg",
      contentType: "image/jpeg",
    });

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:5000";
    const response = await axios.post(
      `${aiServiceUrl}/api/lpr/detect`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );

    if (response.data.success && response.data.plate_number) {
      return response.data.plate_number;
    }

    console.error("AI Service returned no plate number:", response.data);
    return null;
  } catch (error) {
    console.error("AI Service error:", error.message);
    return null;
  }
};

export const lprController = async (req, res) => {
  try {
    const image = req.file ? req.file.buffer : req.body.image;

    const plateNumber = await callAIService(image);
    console.log(plateNumber);

    if (!plateNumber) {
      return res.json({
        action: "deny",
        reason: "Could not detect license plate",
      });
    }

    const whiteListEntry = await Whitelist.findOne({
      vehiclePlate: plateNumber,
      status: "active",
    });

    if (!whiteListEntry) {
      await Log.create({
        vehiclePlate: plateNumber,
        action: "entry",
        status: "denied",
        imagePath: image,
      });

      req.app.get("io")?.emit("lpr:result", {
        number: plateNumber,
        action: "deny",
        reason: "Not in whitelist",
      });

      return res.json({ action: "deny", reason: "Not in whitelist" });
    }

    const emptySlot = await ParkingSlot.findOne({ status: "empty" });

    if (!emptySlot) {
      await Log.create({
        vehiclePlate: plateNumber,
        action: "entry",
        status: "denied",
        imagePath: image,
      });

      req.app.get("io")?.emit("lpr:result", {
        number: plateNumber,
        action: "deny",
        reason: "No available slots",
      });

      return res.json({ action: "deny", reason: "No available slots" });
    }

    emptySlot.status = "occupied";
    emptySlot.vehiclePlate = plateNumber;
    emptySlot.entryTime = new Date();
    await emptySlot.save();

    req.app.get("io")?.emit("slot:update", {
      slotNumber: emptySlot.slotNumber,
      status: "occupied",
      vehiclePlate: plateNumber,
    });

    await Log.create({
      vehiclePlate: plateNumber,
      slot: emptySlot._id,
      action: "entry",
      entryTime: new Date(),
      imagePath: image,
      status: "accepted",
    });

    req.app.get("io")?.emit("lpr:result", {
      number: plateNumber,
      action: "accept",
      slotNumber: emptySlot.slotNumber,
    });

    req.app.get("io")?.emit("device:control", { action: "Open" }); // Gui len thiet bi de mo cổng

    const mqttClient = req.app.get("mqttClient");
    mqttClient?.publish(
      "iot/parking/barrier",
      JSON.stringify({ action: "Open", source: "lpr" })
    );

    res.json({ action: "accept", slotNumber: emptySlot.slotNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
