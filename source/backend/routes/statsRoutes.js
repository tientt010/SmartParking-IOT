import express from "express";
import { getStats } from "../controllers/statsController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authGuard, getStats);

export default router;
