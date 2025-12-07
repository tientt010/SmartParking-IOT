import express from "express";
import {
  controlDevice,
  getGateStatus,
} from "../controllers/deviceController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();

// admin handle control device
router.post("/control", authGuard, controlDevice);
// API lấy trạng thái cửa
router.get("/status", authGuard, getGateStatus);

export default router;
