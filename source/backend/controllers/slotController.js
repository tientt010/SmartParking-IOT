import prisma from "../config/prisma.js";

export const getSlots = async (req, res) => {
  try {
    const slots = await prisma.parkingSlot.findMany({
      where: { slotNumber: { not: { startsWith: "v_" } } },
      orderBy: { slotNumber: "asc" },
    });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
