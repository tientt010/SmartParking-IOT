import express from "express";
import { signup, login, me } from "../controllers/authController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authGuard, me);

export default router;
