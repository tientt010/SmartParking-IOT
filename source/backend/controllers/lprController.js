import Log from "../models/Log.js";
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
    console.error(
      "AI Service error:",
      error.message,
      error.response?.status,
      error.response?.data
    );
    return null;
  }
};

export const lprController = async (req, res) => {
  try {
    const image = req.file ? req.file.buffer : req.body.image;
    console.log(
      "[LPR] Request received. Image type:",
      req.file ? "buffer" : "base64"
    );

    const plateNumber = await callAIService(image);
    console.log("[LPR] Detected plate number:", plateNumber);

    if (!plateNumber) {
      return res.json({
        action: "deny",
        reason: "Could not detect license plate",
      });
    }

    console.log("[LPR] Checking whitelist for plate:", plateNumber);
    const whiteListEntry = await Whitelist.findOne({
      vehiclePlate: plateNumber,
      status: "active",
    });

    if (!whiteListEntry) {
      console.log("[LPR] Plate NOT in whitelist - DENY");
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

    // === TẠM THỜI BỎ TOÀN BỘ LOGIC CHIẾM CHỖ / SLOT ĐỂ TEST MỞ CỬA ===
    // Giữ lại duy nhất: ghi log entry + emit kết quả accept, KHÔNG động vào ParkingSlot

    await Log.create({
      vehiclePlate: plateNumber,
      action: "entry",
      entryTime: new Date(),
      imagePath: image,
      status: "accepted",
    });

    req.app.get("io")?.emit("lpr:result", {
      number: plateNumber,
      action: "accept",
    });

    req.app.get("io")?.emit("device:control", { action: "Open" }); // Gui len thiet bi de mo cổng

    // Gửi lệnh mở barrier qua MQTT
    const mqttClient = req.app.get("mqttClient");
    if (mqttClient) {
      mqttClient.publish(
        "esp32/parking/gate1/control",
        "open_then_close",
        { qos: 1 }
      );
      console.log(
        "[LPR] Sent MQTT command to gate1 (esp32/parking/gate1/control = 'open_then_close')"
      );
    } else {
      console.error(
        "[LPR] MQTT client not available - cannot send open command"
      );
    }

    res.json({ action: "accept" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
