import ParkingSlot from "../models/ParkingSlot.js";
import Log from "../models/Log.js";

export const processExit = async (req, res) => {
  try {
    const { slotNumber } = req.body;

    let slot;

    if (slotNumber) {
      slot = await ParkingSlot.findOne({ slotNumber });
    } else {
      slot = await ParkingSlot.findOne({ status: "occupied" });
    }

    if (!slot || slot.status === "empty") {
      console.log("[Exit] No occupied slot found - skip");
      return res.json({
        action: "skip",
        message: "Slot already empty or not found",
      });
    }

    const vehiclePlate = slot.vehiclePlate;

    slot.status = "empty";
    slot.vehiclePlate = null;
    slot.entryTime = null;
    slot.exitTime = new Date();
    await slot.save();

    console.log(`[Exit] Slot ${slot.slotNumber} freed${vehiclePlate ? ` - Vehicle: ${vehiclePlate}` : ""}`);

    if (vehiclePlate) {
      await Log.create({
        vehiclePlate: vehiclePlate,
        slot: slot._id,
        action: "exit",
        exitTime: new Date(),
        status: "accepted",
      });
    }

    req.app.get("io")?.emit("slot:update", {
      slotNumber: slot.slotNumber,
      status: "empty",
    });

    req.app.get("io")?.emit("exit:processed", {
      slotNumber: slot.slotNumber,
      vehiclePlate: vehiclePlate,
    });

    const mqttClient = req.app.get("mqttClient");
    if (mqttClient) {
      setTimeout(() => {
        mqttClient.publish(
          "esp32/parking/gate2/control",
          "close",
          { qos: 1 }
        );
        console.log(
          "[Exit] Sent MQTT command to close gate2 (esp32/parking/gate2/control = 'close') after 5s"
        );
      }, 5000);
    } else {
      console.warn("[Exit] MQTT client not available - cannot send close command");
    }

    res.json({
      action: "accept",
      message: "Exit processed",
      slotNumber: slot.slotNumber,
      vehiclePlate: vehiclePlate,
    });
  } catch (error) {
    console.error("[Exit] Error:", error.message);
    res.status(500).json({
      action: "deny",
      error: error.message,
    });
  }
};
