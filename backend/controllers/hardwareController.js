import Sensor from "../models/Sensor.js";
import ParkingSlot from "../models/ParkingSlot.js";

export const updateSensor = async (req, res) => {
  try {
    // Kiểm tra format mới (có sensor1-6)
    if (req.body.sensor1 !== undefined || req.body.sensor3 !== undefined) {
      // Format mới từ ESP32 - xử lý sensor 3-6 (sensor 1-2 dùng cho entry/exit)
      const { sensor3, sensor4, sensor5, sensor6, ts, iso } = req.body;

      // Map sensor3-6 với slot (giả sử: sensor3 -> slot1, sensor4 -> slot2, ...)
      const sensorMapping = [
        { sensorKey: "sensor3", sensorId: "sensor3", slotNumber: "slot1" },
        { sensorKey: "sensor4", sensorId: "sensor4", slotNumber: "slot2" },
        { sensorKey: "sensor5", sensorId: "sensor5", slotNumber: "slot3" },
        { sensorKey: "sensor6", sensorId: "sensor6", slotNumber: "slot4" },
      ];

      for (const mapping of sensorMapping) {
        const distance = req.body[mapping.sensorKey];
        if (distance !== null && distance !== undefined) {
          // Tính status: có xe khi distance < 50cm (có thể điều chỉnh)
          const status = distance < 50 ? 1 : 0;

          let sensor = await Sensor.findOne({ sensorId: mapping.sensorId });
          if (!sensor) {
            sensor = await Sensor.create({
              sensorId: mapping.sensorId,
              slotNumber: mapping.slotNumber,
              status,
              distance,
            });
          } else {
            sensor.status = status;
            sensor.distance = distance;
            await sensor.save();
          }

          // Bỏ cập nhật slot - slot chỉ được cập nhật bởi LPR controller
          // (để tránh cập nhật liên tục mỗi 1s từ sensor data)
        }
      }

      return res.json({ message: "update success", format: "esp32_batch" });
    }

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

    // Bỏ cập nhật slot - slot chỉ được cập nhật bởi LPR controller
    // (để tránh cập nhật liên tục mỗi 1s từ sensor data)

    res.json({ message: "update success" });
  } catch (err) {
    res.status(500).json({ message: "update fail", error: err.message });
  }
};
