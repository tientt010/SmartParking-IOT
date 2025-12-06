import express from "express";
import { getLogs } from "../controllers/logController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authGuard, getLogs);

export default router;
