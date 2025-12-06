import Whitelist from "../models/Whitelist.js";

export const getWhitelist = async (req, res) => {
  try {
    const { status, vehiclePlate, limit = 100 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (vehiclePlate) {
      query.vehiclePlate = { $regex: vehiclePlate, $options: "i" };
    }

    const whitelist = await Whitelist.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    res.json(whitelist);
  } catch (error) {
    res.status(500).json({
      message: "fail",
      error: error.message,
    });
  }
};

export const createWhitelist = async (req, res) => {
  try {
    const { vehiclePlate, ownerName, phoneNumber } = req.body;
    if (!vehiclePlate) {
      return res.status(400).json({ message: "vehiclePlate is required" });
    }

    const existingWhitelist = await Whitelist.findOne({ vehiclePlate });
    if (existingWhitelist) {
      return res.status(400).json({ message: "Vehicle already in whitelist" });
    }

    const newWhitelist = await Whitelist.create({
      vehiclePlate,
      ownerName,
      phoneNumber,
      status: "active",
    });
    res.status(201).json(newWhitelist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateWhitelist = async (req, res) => {
  try {
    const { id } = req.params;
    const { ownerName, phoneNumber, status } = req.body;

    const whitelist = await Whitelist.findByIdAndUpdate(
      id,
      { ownerName, phoneNumber, status },
      { new: true, runValidators: true }
    );

    if (!whitelist) {
      return res.status(404).json({ message: "Whitelist not found" });
    }
    res.json(whitelist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteWhitelist = async (req, res) => {
  try {
    const { id } = req.params;
    const { hardDelete = false } = req.query;

    if (hardDelete) {
      const whitelist = await Whitelist.findByIdAndDelete(id);
      if (!whitelist) {
        return res.status(404).json({ message: "Whitelist not found" });
      }
      res.json({ message: "Whitelist deleted" });
    } else {
      const whitelist = await Whitelist.findByIdAndUpdate(
        id,
        { status: "inactive" },
        { new: true }
      );
      if (!whitelist) {
        return res.status(404).json({ message: "Whitelist not found" });
      }
      res.json({ message: "Whitelist set to inactive", whitelist });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
