import Sensor from "../models/Sensor.js";
import ParkingSlot from "../models/ParkingSlot.js";

export const updateSensor = async (req, res) => {
  try {
    const { sensorId, status, distance } = req.body;

    let sensor = await Sensor.findOne({ sensorId });

    if (!sensor) {
      const { slotNumber } = req.body;
      if (!slotNumber) {
        return res.status(400).json({
          message: "update fail",
          error: "slotNumber required for new sensor",
        });
      }
      sensor = await Sensor.create({ sensorId, slotNumber, status, distance });
    } else {
      sensor.status = status;
      sensor.distance = distance;
      await sensor.save();
    }

    const slot = await ParkingSlot.findOne({ slotNumber: sensor.slotNumber });
    if (slot) {
      const isOccupied = status === 1;
      slot.status = isOccupied ? "occupied" : "empty";
      if (!isOccupied) {
        slot.vehiclePlate = null;
        slot.entryTime = null;
        slot.exitTime = new Date();
      }
      await slot.save();

      req.app.get("io")?.emit("slot:update", {
        slotNumber: sensor.slotNumber,
        status: slot.status,
        distance,
      });
    }

    res.json({ message: "update success" });
  } catch (err) {
    res.status(500).json({ message: "update fail", error: err.message });
  }
};
