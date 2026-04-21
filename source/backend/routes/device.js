import express from "express";
import { controlDevice, getGateStatus, getGateCommands } from "../controllers/deviceController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.post("/control",       authenticate, controlDevice);
router.get("/gate-status",    authenticate, getGateStatus);
router.get("/gate-commands",  getGateCommands); // Pi polls này — không cần auth
export default router;
