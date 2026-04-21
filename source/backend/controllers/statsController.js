import prisma from "../config/prisma.js";

export const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, entryToday, exitToday, denied, slots, totalLogs] = await Promise.all([
      prisma.log.count({ where: { createdAt: { gte: today } } }),
      prisma.log.count({ where: { action: "entry", status: "accepted", createdAt: { gte: today } } }),
      prisma.log.count({ where: { action: "exit", createdAt: { gte: today } } }),
      prisma.log.count({ where: { status: "denied", createdAt: { gte: today } } }),
      prisma.parkingSlot.findMany(),
      prisma.log.count(),
    ]);

    const occupied = slots.filter((s) => s.status === "occupied").length;
    const empty = slots.filter((s) => s.status === "empty").length;

    res.json({
      today: { total: totalToday, entry: entryToday, exit: exitToday, denied },
      slots: { total: slots.length, occupied, empty },
      totalLogs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
