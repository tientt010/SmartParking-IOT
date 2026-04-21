import express from "express";
import {
  register,
  login,
  getMe,
  topup,
  payFromWallet,
  getTransactions,
  getVehicle,
  updatePlate,
} from "../controllers/customerController.js";
import { authenticateCustomer } from "../middleware/customerAuth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateCustomer, getMe);
router.post("/topup", authenticateCustomer, topup);
router.post("/pay", authenticateCustomer, payFromWallet);
router.get("/transactions", authenticateCustomer, getTransactions);
router.get("/vehicle", authenticateCustomer, getVehicle);
router.put("/plate", authenticateCustomer, updatePlate);

export default router;
