import express from "express";
import {
  getWhitelist,
  createWhitelist,
  updateWhitelist,
  deleteWhitelist,
} from "../controllers/whitelistController.js";
import { authGuard } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authGuard, getWhitelist);
router.post("/", authGuard, createWhitelist);
router.put("/:id", authGuard, updateWhitelist);
router.delete("/:id", authGuard, deleteWhitelist);

export default router;
