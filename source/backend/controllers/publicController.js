import prisma from "../config/prisma.js";

const RATE_PER_HOUR = 5000; // VND

function calcFee(entryTime) {
  if (!entryTime) return RATE_PER_HOUR;
  const durationMs = Date.now() - new Date(entryTime).getTime();
  const hours = durationMs / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(hours)) * RATE_PER_HOUR;
}

function calcDurationMinutes(entryTime) {
  if (!entryTime) return 0;
  return Math.floor((Date.now() - new Date(entryTime).getTime()) / 60000);
}

// GET /api/public/slots
export const getPublicSlots = async (req, res) => {
  try {
    const slots = await prisma.parkingSlot.findMany({
      orderBy: { slotNumber: "asc" },
    });
    const occupied = slots.filter((s) => s.status === "occupied").length;
    const empty = slots.filter((s) => s.status === "empty").length;
    res.json({ slots, occupied, empty, total: slots.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/public/vehicle/:plate
export const getVehicleStatus = async (req, res) => {
  try {
    const plate = req.params.plate.toUpperCase().replace(/\s+/g, "");
    if (!plate) return res.status(400).json({ message: "Thiếu biển số xe" });

    const slot = await prisma.parkingSlot.findFirst({
      where: { vehiclePlate: plate, status: "occupied" },
    });

    if (!slot) return res.json({ found: false });

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

// POST /api/public/pay
export const processPayment = async (req, res) => {
  try {
    const { vehiclePlate, amount, method } = req.body;
    if (!vehiclePlate || !amount || !method)
      return res.status(400).json({ message: "Thiếu thông tin thanh toán" });

    const plate = vehiclePlate.toUpperCase().replace(/\s+/g, "");

    const slot = await prisma.parkingSlot.findFirst({
      where: { vehiclePlate: plate, status: "occupied" },
    });

    if (!slot)
      return res.status(404).json({ message: "Không tìm thấy xe trong bãi" });

    res.json({
      success: true,
      transactionId: `SP${Date.now()}`,
      vehiclePlate: plate,
      slotNumber: slot.slotNumber,
      amount: Number(amount),
      method,
      paidAt: new Date().toISOString(),
      message: "Thanh toán thành công! Vui lòng ra xe trong 15 phút.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
