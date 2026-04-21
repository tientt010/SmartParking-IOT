import prisma from "../config/prisma.js";

const SENSOR_THRESHOLD = 7.0; 

// Update sensor data (called by pi-driver via POST /api/hardware/sensor)
export const updateSensor = async (req, res) => {
  const io = req.app?.get("io");
  try {
    // main.py chỉ gửi sensor3 + sensor4

    const slotMapping = [
      { key: "sensor3", sensorId: "sensor3", slotNumber: "slot1" },
      { key: "sensor4", sensorId: "sensor4", slotNumber: "slot2" },
      { key: "sensor5", sensorId: "sensor5", slotNumber: "slot3" },
      { key: "sensor6", sensorId: "sensor6", slotNumber: "slot4" },
    ];

    for (const { key, sensorId, slotNumber } of slotMapping) {
      const distance = req.body[key];
      if (distance === null || distance === undefined) continue;

      const existingSensor = await prisma.sensor.findUnique({ where: { sensorId } });
      const threshold = existingSensor?.threshold ?? SENSOR_THRESHOLD;
      const status = distance < threshold ? 1 : 0;
      const previousStatus = existingSensor?.status;

      await prisma.sensor.upsert({
        where: { sensorId },
        update: { status, distance },
        create: { sensorId, slotNumber, status, distance, threshold: SENSOR_THRESHOLD },
      });

      if (previousStatus !== status) {
        await updateParkingSlot(slotNumber, status === 1 ? "occupied" : "empty", io);
      }
    }

    res.json({ message: "update success" });
  } catch (err) {
    res.status(500).json({ message: "update fail", error: err.message });
  }
};

export const getSensorConfig = async (req, res) => {
  try {
    const sensor = await prisma.sensor.findUnique({ where: { sensorId: req.params.sensorId } });
    if (!sensor) return res.status(404).json({ message: "Sensor not found" });
    res.json({
      sensorId: sensor.sensorId,
      slotNumber: sensor.slotNumber,
      threshold: sensor.threshold,
      currentDistance: sensor.distance,
      currentStatus: sensor.status,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateSensorConfig = async (req, res) => {
  try {
    const { sensorId } = req.params;
    const { threshold } = req.body;

    if (!threshold || typeof threshold !== "number" || threshold < 1 || threshold > 200)
      return res.status(400).json({ message: "threshold must be 1-200 cm" });

    const sensor = await prisma.sensor.findUnique({ where: { sensorId } });
    if (!sensor) return res.status(404).json({ message: "Sensor not found" });

    await prisma.sensor.update({ where: { sensorId }, data: { threshold } });
    res.json({ message: "success", sensorId, threshold });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllSensorsConfig = async (req, res) => {
  try {
    const sensors = await prisma.sensor.findMany({ orderBy: { sensorId: "asc" } });
    res.json(sensors.map((s) => ({
      sensorId: s.sensorId, slotNumber: s.slotNumber,
      threshold: s.threshold, currentDistance: s.distance, currentStatus: s.status,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateParkingSlot = async (slotNumber, status, io) => {
  try {
    const slot = await prisma.parkingSlot.upsert({
      where: { slotNumber },
      update: {
        status,
        entryTime: status === "occupied" ? new Date() : undefined,
        exitTime: status === "empty" ? new Date() : undefined,
      },
      create: { slotNumber, status },
    });

    io?.emit("slot:update", { slotNumber: slot.slotNumber, status: slot.status });
    console.log(`[Sensor] Slot ${slotNumber}: ${status}`);
  } catch (err) {
    console.error("[Sensor] updateParkingSlot error:", err.message);
  }
};

export const handleEntry = async (req, res) => {
  const io = req.app?.get("io");
  try {
    const plate = req.body.plate?.toUpperCase().replace(/\s+/g, "");
    if (!plate) return res.status(400).json({ action: "deny", reason: "Thiếu biển số" });

    io?.emit("lpr:scanning", { gate: "entry", plate, time: new Date().toISOString() });

    const customer = await prisma.customer.findFirst({ where: { vehiclePlate: plate } });
    if (!customer) {
      console.log(`[Entry] Từ chối: Xe ${plate} chưa đăng ký tài khoản.`);
      io?.emit("lpr:result", { action: "deny", plate, reason: "Xe chưa đăng ký ví điện tử", gate: "entry", time: new Date().toISOString() });
      return res.json({ action: "deny", reason: "Xe chưa đăng ký ví điện tử" });
    }

    if (customer.balance < 5000) {
      console.log(`[Entry] Từ chối: Xe ${plate} không đủ tiền (${customer.balance}đ)`);
      io?.emit("lpr:result", { action: "deny", plate, reason: "Ví không đủ số dư (Cần >= 5000đ)", gate: "entry", time: new Date().toISOString() });
      return res.json({ action: "deny", reason: "Ví không đủ số dư (Cần >= 5000đ)" });
    }

    const entryTime = new Date();
    await prisma.log.create({
      data: { vehiclePlate: plate, action: "entry", status: "accepted", entryTime }
    });

    await prisma.parkingSlot.upsert({
      where: { slotNumber: "v_" + plate },
      update: { status: "occupied", vehiclePlate: plate, entryTime },
      create: { slotNumber: "v_" + plate, status: "occupied", vehiclePlate: plate, entryTime }
    });

    console.log(`[Entry] Chấp nhận: Xe ${plate} được phép vào. Số dư: ${customer.balance}đ`);
    io?.emit("lpr:result", { action: "accept", plate, name: customer.name, balance: customer.balance, gate: "entry", time: new Date().toISOString() });
    res.json({ action: "accept", message: "Mời vào", balance: customer.balance, name: customer.name });
  } catch (err) {
    console.error("[Entry] Lỗi:", err.message);
    res.status(500).json({ action: "deny", reason: "Lỗi server" });
  }
};

export const handleExit = async (req, res) => {
  const io = req.app?.get("io");
  try {
    const plate = req.body.plate?.toUpperCase().replace(/\s+/g, "");
    if (!plate) return res.status(400).json({ action: "deny", reason: "Thiếu biển số" });

    io?.emit("lpr:scanning", { gate: "exit", plate, time: new Date().toISOString() });

    const customer = await prisma.customer.findFirst({ where: { vehiclePlate: plate } });
    if (!customer) {
      io?.emit("lpr:result", { action: "deny", plate, reason: "Xe chưa đăng ký", gate: "exit", time: new Date().toISOString() });
      return res.json({ action: "deny", reason: "Xe chưa đăng ký" });
    }

    const slot = await prisma.parkingSlot.findFirst({ where: { vehiclePlate: plate, status: "occupied" } });
    const entryTime = slot?.entryTime ? slot.entryTime : new Date(Date.now() - 60000);

    const RATE_PER_SECOND = 0.1;
    const seconds = (Date.now() - new Date(entryTime).getTime()) / 1000;
    const fee = Math.max(1, Math.round(seconds * RATE_PER_SECOND));
    const durationSec = Math.round(seconds);

    if (customer.balance < fee) {
      console.log(`[Exit] Từ chối: ${plate} nợ thanh toán. Cần: ${fee}đ, Số dư: ${customer.balance}đ`);
      io?.emit("lpr:result", { action: "deny", plate, reason: `Số dư không đủ. Cần trả: ${fee}đ`, gate: "exit", time: new Date().toISOString() });
      return res.json({ action: "deny", reason: `Số dư không đủ. Cần trả: ${fee}đ` });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { balance: { decrement: fee } }
    });

    await prisma.transaction.create({
      data: {
        customerId: customer.id,
        type: "payment",
        amount: fee,
        description: `Thanh toán Bãi Đỗ Tự Động – Xe ${plate} (${durationSec}giây demo)`
      }
    });

    await prisma.log.create({
      data: { vehiclePlate: plate, action: "exit", status: "accepted", exitTime: new Date() }
    });

    if (slot) {
      await prisma.parkingSlot.update({
        where: { id: slot.id },
        data: { status: "empty", exitTime: new Date() }
      });
    }

    console.log(`[Exit] Chấp nhận: Xe ${plate} ra. Đã trừ ${fee}đ (${durationSec}s), Số dư còn ${updatedCustomer.balance}đ`);
    io?.emit("lpr:result", { action: "accept", plate, fee, durationSec, balanceAfter: updatedCustomer.balance, gate: "exit", time: new Date().toISOString() });
    io?.emit("parking:exit", { plate, fee, balanceAfter: updatedCustomer.balance });
    res.json({ action: "accept", fee, durationSec, balanceAfter: updatedCustomer.balance });
  } catch (err) {
    console.error("[Exit] Lỗi:", err.message);
    res.status(500).json({ action: "deny", reason: "Lỗi server" });
  }
};
