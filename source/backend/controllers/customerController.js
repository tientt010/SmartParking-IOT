import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const RATE_PER_HOUR = 5000;

function calcFee(entryTime) {
  if (!entryTime) return RATE_PER_HOUR;
  const hours = (Date.now() - new Date(entryTime).getTime()) / 3600000;
  return Math.max(1, Math.ceil(hours)) * RATE_PER_HOUR;
}

function calcDurationMinutes(entryTime) {
  if (!entryTime) return 0;
  return Math.floor((Date.now() - new Date(entryTime).getTime()) / 60000);
}

// POST /api/customer/register
export const register = async (req, res) => {
  try {
    const { phone, name, password, vehiclePlate } = req.body;
    if (!phone || !name || !password)
      return res.status(400).json({ message: "Thiếu thông tin đăng ký" });

    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing)
      return res.status(409).json({ message: "Số điện thoại đã được đăng ký" });

    const hashed = await bcrypt.hash(password, 10);
    const plate = vehiclePlate?.toUpperCase().replace(/\s+/g, "") || null;

    const customer = await prisma.customer.create({
      data: { phone, name, password: hashed, vehiclePlate: plate },
    });

    const token = jwt.sign(
      { id: customer.id, phone: customer.phone, role: "customer" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );

    res.json({
      token,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        vehiclePlate: customer.vehiclePlate,
        balance: customer.balance,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/customer/login
export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ message: "Thiếu thông tin đăng nhập" });

    const customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer || !(await bcrypt.compare(password, customer.password)))
      return res
        .status(401)
        .json({ message: "Số điện thoại hoặc mật khẩu không đúng" });

    const token = jwt.sign(
      { id: customer.id, phone: customer.phone, role: "customer" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" },
    );

    res.json({
      token,
      customer: {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        vehiclePlate: customer.vehiclePlate,
        balance: customer.balance,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/customer/me
export const getMe = async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer.id },
      select: {
        id: true,
        phone: true,
        name: true,
        vehiclePlate: true,
        balance: true,
        createdAt: true,
      },
    });
    if (!customer)
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/customer/topup
export const topup = async (req, res) => {
  try {
    const { amount, method } = req.body;
    const num = parseFloat(amount);
    if (!num || num < 10000 || num > 10000000)
      return res
        .status(400)
        .json({ message: "Số tiền nạp không hợp lệ (10,000đ — 10,000,000đ)" });

    const updated = await prisma.customer.update({
      where: { id: req.customer.id },
      data: { balance: { increment: num } },
    });

    await prisma.transaction.create({
      data: {
        customerId: req.customer.id,
        type: "topup",
        amount: num,
        description: `Nạp tiền qua ${method || "chuyển khoản"}`,
      },
    });

    res.json({
      success: true,
      balance: updated.balance,
      amount: num,
      transactionId: `TP${Date.now()}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/customer/pay
export const payFromWallet = async (req, res) => {
  try {
    const plate =
      (req.body.vehiclePlate || "").toUpperCase().replace(/\s+/g, "") ||
      req.customer.vehiclePlate;
    if (!plate) return res.status(400).json({ message: "Thiếu biển số xe" });

    const slot = await prisma.parkingSlot.findFirst({
      where: { vehiclePlate: plate, status: "occupied" },
    });
    if (!slot)
      return res.status(404).json({ message: "Không tìm thấy xe trong bãi" });

    const fee = calcFee(slot.entryTime);
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer.id },
    });

    if (customer.balance < fee)
      return res
        .status(400)
        .json({
          message: "Số dư không đủ",
          balance: customer.balance,
          required: fee,
        });

    const updated = await prisma.customer.update({
      where: { id: req.customer.id },
      data: { balance: { decrement: fee } },
    });

    await prisma.transaction.create({
      data: {
        customerId: req.customer.id,
        type: "payment",
        amount: fee,
        description: `Thanh toán đỗ xe ${plate} — ${slot.slotNumber}`,
      },
    });

    res.json({
      success: true,
      vehiclePlate: plate,
      slotNumber: slot.slotNumber,
      fee,
      balanceBefore: customer.balance,
      balanceAfter: updated.balance,
      transactionId: `PY${Date.now()}`,
      message: "Thanh toán thành công! Vui lòng ra xe trong 15 phút.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/customer/transactions
export const getTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { customerId: req.customer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/customer/vehicle?plate=...
export const getVehicle = async (req, res) => {
  try {
    const plate = req.query.plate
      ? req.query.plate.toUpperCase().replace(/\s+/g, "")
      : req.customer.vehiclePlate;

    if (!plate) return res.json({ found: false });

    const slot = await prisma.parkingSlot.findFirst({
      where: { vehiclePlate: plate, status: "occupied" },
    });

    if (!slot) return res.json({ found: false, plate });

    res.json({
      found: true,
      slot: slot.slotNumber,
      vehiclePlate: slot.vehiclePlate,
      entryTime: slot.entryTime,
      durationMinutes: calcDurationMinutes(slot.entryTime),
      fee: calcFee(slot.entryTime),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/customer/plate
export const updatePlate = async (req, res) => {
  try {
    const plate =
      req.body.vehiclePlate?.toUpperCase().replace(/\s+/g, "") || null;
    const customer = await prisma.customer.update({
      where: { id: req.customer.id },
      data: { vehiclePlate: plate },
      select: {
        id: true,
        phone: true,
        name: true,
        vehiclePlate: true,
        balance: true,
      },
    });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
