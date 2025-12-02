import express from "express";
import authRoutes from "./authRoutes.js";
import slotRoutes from "./slotRoutes.js";
import hardwareRoutes from "./hardwareRoutes.js";
import deviceRoutes from "./deviceRoutes.js";
import logRoutes from "./logRoutes.js";
import whitelistRoutes from "./whitelistRoutes.js";
import statsRoutes from "./statsRoutes.js";
const routes = express.Router();

routes.use("/auth", authRoutes);
routes.use("/slots", slotRoutes);
routes.use("/hardware", hardwareRoutes);
routes.use("/device", deviceRoutes);
routes.use("/logs", logRoutes);
routes.use("/whitelist", whitelistRoutes);
routes.use("/stats", statsRoutes);
export default routes;
