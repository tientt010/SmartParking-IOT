import express from "express";
import { getSlots } from "../controllers/slotController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();
router.get("/", authGuard, getSlots);

export default router;
