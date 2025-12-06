import Log from "../models/Log.js";

export const getLogs = async (req, res) => {
  try {
    const { vehiclePlate, action, startDate, endDate, limit = 50 } = req.query;

    const query = {};
    if (vehiclePlate) {
      query.vehiclePlate = { $regex: vehiclePlate, $options: "i" };
    }

    if (action) {
      query.action = action;
    }

    if (startDate && endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await Log.find(query)
      .populate("slot", "slotNumber")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(logs);
  } catch (error) {
    res.status(500).json({
      message: "fail",
      error: error.message,
    });
  }
};
