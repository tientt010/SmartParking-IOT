import express from "express";
import multer from "multer";
import {
  updateSensor,
  getSensorConfig,
  updateSensorConfig,
  getAllSensorsConfig,
  handleEntry,
  handleExit,
} from "../controllers/hardwareController.js";
import { lprController } from "../controllers/lprController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/sensor", updateSensor);
router.get("/sensor", getAllSensorsConfig);
router.get("/sensor/:sensorId", getSensorConfig);
router.put("/sensor/:sensorId", updateSensorConfig);

router.post("/lpr", upload.single("image"), lprController);

// REST API handlers for PI
router.post("/entry", handleEntry);
router.post("/exit", handleExit);
export default router;
