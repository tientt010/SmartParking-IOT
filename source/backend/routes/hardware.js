import express from "express";
import {
  updateSensor,
  getSensorConfig,
  updateSensorConfig,
  getAllSensorsConfig,
  handleEntry,
  handleExit,
} from "../controllers/hardwareController.js";

const router = express.Router();

router.post("/sensor", updateSensor);
router.get("/sensor", getAllSensorsConfig);
router.get("/sensor/:sensorId", getSensorConfig);
router.put("/sensor/:sensorId", updateSensorConfig);

// REST API: Python main.py gọi trực tiếp
router.post("/entry", handleEntry);
router.post("/exit", handleExit);
export default router;
