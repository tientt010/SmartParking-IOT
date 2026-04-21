import express from "express";
import {
  getPublicSlots,
  getVehicleStatus,
  processPayment,
} from "../controllers/publicController.js";

const router = express.Router();

router.get("/slots", getPublicSlots);
router.get("/vehicle/:plate", getVehicleStatus);
router.post("/pay", processPayment);

export default router;
