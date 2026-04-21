import express from "express";
import authRoutes from "./auth.js";
import slotRoutes from "./slots.js";
import logRoutes from "./logs.js";
import whitelistRoutes from "./whitelist.js";
import statsRoutes from "./stats.js";
import deviceRoutes from "./device.js";
import hardwareRoutes from "./hardware.js";
import publicRoutes from "./public.js";
import customerRoutes from "./customer.js";
import adminRoutes from "./admin.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/slots", slotRoutes);
router.use("/logs", logRoutes);
router.use("/whitelist", whitelistRoutes);
router.use("/stats", statsRoutes);
router.use("/device", deviceRoutes);
router.use("/hardware", hardwareRoutes);
router.use("/public", publicRoutes);
router.use("/customer", customerRoutes);
router.use("/admin", adminRoutes);

export default router;
