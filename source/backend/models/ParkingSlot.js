import mongoose from "mongoose";

const parkingSlotSchema = new mongoose.Schema(
  {
    slotNumber: { type: String, unique: true, required: true },
    status: { type: String, enum: ["empty", "occupied"], default: "empty" },
    vehiclePlate: String,
    entryTime: Date,
    exitTime: Date,
  },
  { timestamps: true }
);

export default mongoose.model("ParkingSlot", parkingSlotSchema);
