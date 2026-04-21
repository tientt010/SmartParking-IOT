import prisma from "../config/prisma.js";

export const getWhitelist = async (req, res) => {
  try {
    const list = await prisma.whitelist.findMany({ orderBy: { createdAt: "desc" } });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addWhitelist = async (req, res) => {
  try {
    const { vehiclePlate, ownerName } = req.body;
    if (!vehiclePlate) return res.status(400).json({ message: "vehiclePlate required" });

    const existing = await prisma.whitelist.findUnique({ where: { vehiclePlate: vehiclePlate.trim().toUpperCase() } });
    if (existing) return res.status(409).json({ message: "Plate already in whitelist" });

    const entry = await prisma.whitelist.create({
      data: { vehiclePlate: vehiclePlate.trim().toUpperCase(), ownerName, status: "active" },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateWhitelistStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "inactive"].includes(status))
      return res.status(400).json({ message: "status must be active or inactive" });

    const entry = await prisma.whitelist.update({
      where: { id: parseInt(id) },
      data: { status },
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteWhitelist = async (req, res) => {
  try {
    await prisma.whitelist.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
