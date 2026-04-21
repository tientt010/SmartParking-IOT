import express from "express";
import {
  getWhitelist,
  addWhitelist,
  updateWhitelistStatus,
  deleteWhitelist,
} from "../controllers/whitelistController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.get("/", authenticate, getWhitelist);
router.post("/", authenticate, addWhitelist);
router.put("/:id", authenticate, updateWhitelistStatus);
router.delete("/:id", authenticate, deleteWhitelist);
export default router;
