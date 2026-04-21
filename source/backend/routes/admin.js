import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  listCustomers,
  createCustomer,
  adminTopup,
  adminUpdatePlate,
  deleteCustomer,
} from "../controllers/adminCustomerController.js";

const router = express.Router();

router.use(authenticate);

router.get("/customers", listCustomers);
router.post("/customers", createCustomer);
router.patch("/customers/:id/topup", adminTopup);
router.patch("/customers/:id/plate", adminUpdatePlate);
router.delete("/customers/:id", deleteCustomer);

export default router;
