import express from "express";
import { controlDevice } from "../controllers/deviceController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();

// admin handle control device
router.post("/control", authGuard, controlDevice);

export default router;
