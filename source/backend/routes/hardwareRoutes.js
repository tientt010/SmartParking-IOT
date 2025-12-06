import express from "express";
import { updateSensor, getSensorConfig, updateSensorConfig, getAllSensorsConfig } from "../controllers/hardwareController.js";
import { lprController } from "../controllers/lprController.js";
import { processExit } from "../controllers/exitController.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

router.post("/sensor", updateSensor);
router.post("/lpr", uploadSingle, lprController);
router.post("/exit", processExit);
router.get("/sensor/:sensorId", getSensorConfig);
router.put("/sensor/:sensorId", updateSensorConfig);
router.get("/sensors", getAllSensorsConfig);
export default router;
