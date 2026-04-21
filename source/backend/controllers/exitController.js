import prisma from "../config/prisma.js";

export const exitController = async (req, res) => {
  try {
    const { event, ts, iso } = req.body;
    console.log("[Exit] Event received:", req.body);

    await prisma.log.create({
      data: {
        vehiclePlate: "UNKNOWN",
        action: "exit",
        status: "accepted",
        exitTime: new Date(),
      },
    });

    req.app.get("io")?.emit("parking:exit", { event, ts, iso });
    res.json({ message: "exit logged" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
