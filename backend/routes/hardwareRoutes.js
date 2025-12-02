import express from "express";
import { updateSensor } from "../controllers/hardwareController.js";
import { lprController } from "../controllers/lprController.js";
import { processExit } from "../controllers/exitController.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

// ESP32 call
router.post("/sensor", updateSensor);
router.post("/lpr", uploadSingle, lprController);
router.post("/exit", processExit);
export default router;
