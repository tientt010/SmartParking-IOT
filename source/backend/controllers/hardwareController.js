import Sensor from "../models/Sensor.js";
import ParkingSlot from "../models/ParkingSlot.js";

const SENSOR_THRESHOLD = 7.0; // cm - ngưỡng phát hiện xe cho sensor 3-6

export const updateSensor = async (req, res) => {
  const io = req.app?.get("io");
  try {
    if (req.body.sensor1 !== undefined || req.body.sensor3 !== undefined) {
      const { sensor3, sensor4, sensor5, sensor6, ts, iso } = req.body;

      const sensorMapping = [
        { sensorKey: "sensor3", sensorId: "sensor3", slotNumber: "slot1" },
        { sensorKey: "sensor4", sensorId: "sensor4", slotNumber: "slot2" },
        { sensorKey: "sensor5", sensorId: "sensor5", slotNumber: "slot3" },
        { sensorKey: "sensor6", sensorId: "sensor6", slotNumber: "slot4" },
      ];

      for (const mapping of sensorMapping) {
        const distance = req.body[mapping.sensorKey];
        if (distance !== null && distance !== undefined) {
          // Tìm sensor để lấy threshold (hoặc dùng mặc định)
          let sensor = await Sensor.findOne({ sensorId: mapping.sensorId });
          const threshold = sensor?.threshold || SENSOR_THRESHOLD;
          
          // Tính status: distance < 7cm = có xe (1), ngược lại = không có xe (0)
          const status = distance < threshold ? 1 : 0;

          if (!sensor) {
            sensor = await Sensor.create({
              sensorId: mapping.sensorId,
              slotNumber: mapping.slotNumber,
              status,
              distance,
              threshold: SENSOR_THRESHOLD,
            });
            // Cập nhật slot khi tạo sensor mới
            await updateParkingSlotFromSensor(
              mapping.slotNumber,
              status === 1 ? "occupied" : "empty",
              io
            );
          } else {
            const previousStatus = sensor.status;
            sensor.status = status;
            sensor.distance = distance;
            // Giữ nguyên threshold nếu đã có, không ghi đè
            if (!sensor.threshold) {
              sensor.threshold = SENSOR_THRESHOLD;
            }
            await sensor.save();

            // Cập nhật ParkingSlot nếu status thay đổi
            if (previousStatus !== status) {
              await updateParkingSlotFromSensor(
                mapping.slotNumber,
                status === 1 ? "occupied" : "empty",
                io
              );
            }
          }
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
      sensor = await Sensor.create({
        sensorId,
        slotNumber,
        status,
        distance,
        threshold: SENSOR_THRESHOLD,
      });
    } else {
      const previousStatus = sensor.status;
      sensor.status = status;
      sensor.distance = distance;
      if (!sensor.threshold) {
        sensor.threshold = SENSOR_THRESHOLD;
      }
      await sensor.save();

      // Cập nhật ParkingSlot nếu status thay đổi
      if (previousStatus !== status) {
        const io = req.app?.get("io");
        await updateParkingSlotFromSensor(
          sensor.slotNumber,
          status === 1 ? "occupied" : "empty",
          io
        );
      }
    }

    res.json({ message: "update success" });
  } catch (err) {
    res.status(500).json({ message: "update fail", error: err.message });
  }
};

export const getSensorConfig = async (req, res) => {
  try {
    const {sensorId} = req.params;
    const sensor = await Sensor.findOne({sensorId});
    if(!sensor) {
      return res.status(404).json({
        message: "fail",
        error: "Sensor not found",
      })
    }

    res.json({
      sensorId: sensor.sensorId,
      slotNumber: sensor.slotNumber,
      threshold: sensor.threshold || SENSOR_THRESHOLD, 
      currentDistance: sensor.distance,
      currentStatus: sensor.status,
    });
  } catch (error) {
    res.status(500).json({
      message: "fail",
      error: error.message,
    });
  }
}

export const updateSensorConfig = async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { threshold } = req.body;

    if (threshold === undefined || threshold === null) {
      return res.status(400).json({
        message: "fail",
        error: "threshold is required",
      });
    }

    if (typeof threshold !== "number" || threshold < 1 || threshold > 200) {
      return res.status(400).json({
        message: "fail",
        error: "threshold must be a number between 1 and 200 (cm)",
      });
    }

    const sensor = await Sensor.findOne({ sensorId });
    if (!sensor) {
      return res.status(404).json({
        message: "fail",
        error: "Sensor not found",
      });
    }

    sensor.threshold = threshold;
    await sensor.save();

    res.json({
      message: "success",
      sensorId: sensor.sensorId,
      threshold: sensor.threshold,
    });
  } catch (err) {
    res.status(500).json({
      message: "fail",
      error: err.message,
    });
  }
};

export const getAllSensorsConfig = async (req, res) => {
  try {
    const sensors = await Sensor.find().sort("sensorId");
    
    res.json(
      sensors.map((s) => ({
        sensorId: s.sensorId,
        slotNumber: s.slotNumber,
        threshold: s.threshold || SENSOR_THRESHOLD,
        currentDistance: s.distance,
        currentStatus: s.status,
      }))
    );
  } catch (err) {
    res.status(500).json({
      message: "fail",
      error: err.message,
    });
  }
};

// Helper function: Cập nhật ParkingSlot dựa trên sensor status
const updateParkingSlotFromSensor = async (slotNumber, status, io = null) => {
  try {
    let slot = await ParkingSlot.findOne({ slotNumber });
    
    if (!slot) {
      // Tạo slot mới nếu chưa tồn tại
      slot = await ParkingSlot.create({
        slotNumber,
        status,
        vehiclePlate: null,
        entryTime: status === "occupied" ? new Date() : null,
        exitTime: status === "empty" ? new Date() : null,
      });
      console.log(`[Sensor] Created new slot ${slotNumber} with status: ${status}`);
      
      // Emit socket event
      if (io) {
        io.emit("slot:update", {
          slotNumber: slot.slotNumber,
          status: slot.status,
        });
      }
    } else {
      // Chỉ cập nhật nếu status thay đổi
      if (slot.status !== status) {
        const previousStatus = slot.status;
        slot.status = status;
        
        // Cập nhật thời gian
        if (status === "occupied" && previousStatus === "empty") {
          slot.entryTime = new Date();
          slot.exitTime = null;
        } else if (status === "empty" && previousStatus === "occupied") {
          slot.exitTime = new Date();
          // Giữ nguyên vehiclePlate và entryTime để log
        }
        
        await slot.save();
        console.log(
          `[Sensor] Updated slot ${slotNumber}: ${previousStatus} → ${status}`
        );
        
        // Emit socket event để frontend cập nhật
        if (io) {
          io.emit("slot:update", {
            slotNumber: slot.slotNumber,
            status: slot.status,
          });
        }
      }
    }
  } catch (error) {
    console.error(`[Sensor] Error updating slot ${slotNumber}:`, error.message);
  }
};
