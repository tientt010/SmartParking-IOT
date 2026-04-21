import express from "express";
import { getSlots } from "../controllers/slotController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.get("/", authenticate, getSlots);
export default router;
