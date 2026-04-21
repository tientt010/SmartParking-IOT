import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";

// danh sách khách hàng
export const listCustomers = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        vehiclePlate: true,
        balance: true,
        createdAt: true,
      },
    });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// tạo tài khoản khách hàng mới
export const createCustomer = async (req, res) => {
  try {
    const { name, phone, password, vehiclePlate, initialBalance } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ message: "Thiếu tên, SĐT hoặc mật khẩu" });

    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing)
      return res.status(409).json({ message: "Số điện thoại đã tồn tại" });

    const plate = vehiclePlate?.toUpperCase().replace(/\s+/g, "") || null;
    const balance = parseFloat(initialBalance) || 0;
    const hashed = await bcrypt.hash(password, 10);

    const customer = await prisma.customer.create({
      data: { name, phone, password: hashed, vehiclePlate: plate, balance },
      select: {
        id: true,
        name: true,
        phone: true,
        vehiclePlate: true,
        balance: true,
        createdAt: true,
      },
    });

    if (balance > 0) {
      await prisma.transaction.create({
        data: {
          customerId: customer.id,
          type: "topup",
          amount: balance,
          description: "Nạp tiền khởi tạo tài khoản (Admin)",
        },
      });
    }

    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// nạp thêm tiền cho khách
export const adminTopup = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Số tiền không hợp lệ" });

    const customer = await prisma.customer.update({
      where: { id },
      data: { balance: { increment: amount } },
      select: {
        id: true,
        name: true,
        phone: true,
        vehiclePlate: true,
        balance: true,
      },
    });

    await prisma.transaction.create({
      data: {
        customerId: id,
        type: "topup",
        amount,
        description: "Nạp tiền bởi Admin",
      },
    });

    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// cập nhật biển số xe
export const adminUpdatePlate = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const plate =
      req.body.vehiclePlate?.toUpperCase().replace(/\s+/g, "") || null;

    const customer = await prisma.customer.update({
      where: { id },
      data: { vehiclePlate: plate },
      select: {
        id: true,
        name: true,
        phone: true,
        vehiclePlate: true,
        balance: true,
      },
    });

    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// xoá khách hàng
export const deleteCustomer = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.transaction.deleteMany({ where: { customerId: id } });
    await prisma.customer.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
