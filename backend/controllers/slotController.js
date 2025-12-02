import ParkingSlot from "../models/ParkingSlot.js";

export const getSlots = async (req, res) => {
  try {
    const slots = await ParkingSlot.find().sort("slotNumber");
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
