import Log from "../models/Log.js";
import ParkingSlot from "../models/ParkingSlot.js";

export const getStats = async (req, res) => {
  try {
    const { type = "day" } = req.query;

    const now = new Date();
    let startDate = new Date(now.setHours(0, 0, 0, 0));

    if (type === "week") {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (type === "month") {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const [totalLogs, entryLogs, exitLogs, occupiedSlots, emptySlots] =
      await Promise.all([
        Log.countDocuments({ createdAt: { $gte: startDate } }),
        Log.countDocuments({
          action: "entry",
          createdAt: { $gte: startDate },
        }),
        Log.countDocuments({
          action: "exit",
          createdAt: { $gte: startDate },
        }),
        ParkingSlot.countDocuments({ status: "occupied" }),
        ParkingSlot.countDocuments({ status: "empty" }),
      ]);

    res.json({
      type,
      period: { start: startDate, end: new Date() },
      totalLogs,
      entryLogs,
      exitLogs,
      occupiedSlots,
      emptySlots,
      totalSlots: occupiedSlots + emptySlots,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
