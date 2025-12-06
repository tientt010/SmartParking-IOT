import Sensor from "../models/Sensor.js";

export const updateSensor = async (req, res) => {
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
          const status = distance < sensor.threshold ? 1 : 0;

          let sensor = await Sensor.findOne({ sensorId: mapping.sensorId });
          if (!sensor) {
            sensor = await Sensor.create({
              sensorId: mapping.sensorId,
              slotNumber: mapping.slotNumber,
              status,
              distance,
              threshold: 50,
            });
          } else {
            sensor.status = status;
            sensor.distance = distance;
            sensor.threshold = 50;
            await sensor.save();
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
      sensor = await Sensor.create({ sensorId, slotNumber, status, distance, threshold: 50 });
    } else {
      sensor.status = status;
      sensor.distance = distance;
      sensor.threshold = 50;
      await sensor.save();
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
      threshold: sensor.threshold || 50, 
      currentDistance: sensor.distance,
      currentStatus: sensor.status,
    });
  } catch (error) {
    res.status(500).json({
      message: "fail",
      error: err.message,
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

    if (typeof threshold !== "number" || threshold < 10 || threshold > 200) {
      return res.status(400).json({
        message: "fail",
        error: "threshold must be a number between 10 and 200 (cm)",
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
        threshold: s.threshold || 50,
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
