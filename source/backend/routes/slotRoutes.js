import express from "express";
import { getSlots, toggleSensorStatus } from "../controllers/slotController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();
router.get("/", authGuard, getSlots);
router.patch("/:slotNumber/sensor", authGuard, toggleSensorStatus);

export default router;
