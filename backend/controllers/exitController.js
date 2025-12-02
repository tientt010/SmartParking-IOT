import ParkingSlot from "../models/ParkingSlot.js";
import Log from "../models/Log.js";

export const processExit = async (req, res) => {
  try {
    const { slotNumber } = req.body;

    const slot = await ParkingSlot.findOne({ slotNumber });

    if (!slot || slot.status === "empty") {
      return res.json({
        action: "skip",
        message: "Slot already empty or not found",
      });
    }

    const vehiclePlate = slot.vehiclePlate;

    if (!vehiclePlate) {
      slot.status = "empty";
      slot.vehiclePlate = null;
      slot.entryTime = null;
      slot.exitTime = new Date();
      await slot.save();

      req.app.get("io")?.emit("slot:update", {
        slotNumber: slot.slotNumber,
        status: "empty",
      });

      req.app.get("io")?.emit("device:control", { action: "Open" });

      const mqttClient = req.app.get("mqttClient");
      mqttClient?.publish(
        "iot/parking/barrier",
        JSON.stringify({ action: "Open", source: "exit" })
      );

      return res.json({
        action: "accept",
        message: "Exit processed (no vehicle plate)",
        slotNumber: slot.slotNumber,
      });
    }
    slot.status = "empty";
    slot.vehiclePlate = null;
    slot.entryTime = null;
    slot.exitTime = new Date();
    await slot.save();

    await Log.create({
      vehiclePlate: vehiclePlate,
      slot: slot._id,
      action: "exit",
      exitTime: new Date(),
      status: "accepted",
    });

    // Emit socket events
    req.app.get("io")?.emit("slot:update", {
      slotNumber: slot.slotNumber,
      status: "empty",
    });

    // Open barrier
    req.app.get("io")?.emit("device:control", { action: "Open" });

    res.json({
      action: "accept",
      message: "Exit processed",
      slotNumber: slot.slotNumber,
    });
  } catch (error) {
    res.status(500).json({
      action: "deny",
      error: error.message,
    });
  }
};
