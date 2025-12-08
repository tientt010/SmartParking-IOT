import ParkingSlot from "../models/ParkingSlot.js";
import Sensor from "../models/Sensor.js";

// Timeout để xác định sensor offline (5 phút)
const SENSOR_TIMEOUT_MS = 5 * 60 * 1000;

export const getSlots = async (req, res) => {
  try {
    const slots = await ParkingSlot.find().sort("slotNumber");
    const sensors = await Sensor.find();
    
    // Tạo map sensor theo slotNumber
    const sensorMap = {};
    sensors.forEach((sensor) => {
      sensorMap[sensor.slotNumber] = sensor;
    });

    const now = Date.now();

    // Gắn thông tin maintenance vào mỗi slot
    const slotsWithMaintenance = slots.map((slot) => {
      const sensor = sensorMap[slot.slotNumber];
      let isMaintenance = false;
      let maintenanceReason = null;

      if (!sensor) {
        // Không có sensor -> maintenance
        isMaintenance = true;
        maintenanceReason = "Chưa có sensor";
      } else if (!sensor.isActive) {
        // Admin đã tắt sensor
        isMaintenance = true;
        maintenanceReason = "Đã tắt bởi admin";
      } else if (now - new Date(sensor.updatedAt).getTime() > SENSOR_TIMEOUT_MS) {
        // Sensor không gửi dữ liệu quá 5 phút
        isMaintenance = true;
        maintenanceReason = "Mất kết nối";
      }

      return {
        ...slot.toObject(),
        isMaintenance,
        maintenanceReason,
        sensor: sensor
          ? {
              sensorId: sensor.sensorId,
              isActive: sensor.isActive,
              lastUpdate: sensor.updatedAt,
              distance: sensor.distance,
              threshold: sensor.threshold,
            }
          : null,
      };
    });

    res.json(slotsWithMaintenance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Toggle sensor isActive status
export const toggleSensorStatus = async (req, res) => {
  try {
    const { slotNumber } = req.params;
    const { isActive } = req.body;

    const sensor = await Sensor.findOne({ slotNumber });
    if (!sensor) {
      return res.status(404).json({ message: "Sensor không tồn tại" });
    }

    sensor.isActive = isActive;
    await sensor.save();

    // Emit socket event để cập nhật realtime
    const io = req.app?.get("io");
    if (io) {
      io.emit("sensor:status", {
        slotNumber,
        isActive,
        sensorId: sensor.sensorId,
      });
    }

    res.json({
      message: `Sensor ${sensor.sensorId} đã ${isActive ? "bật" : "tắt"}`,
      sensor,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
