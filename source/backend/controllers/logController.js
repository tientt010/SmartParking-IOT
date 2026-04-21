import prisma from "../config/prisma.js";

export const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, status } = req.query;
    const where = {
      vehiclePlate: { not: { in: ["UNKNOWN", "unknown", ""] }, },
    };
    if (action) where.action = action;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.log.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
