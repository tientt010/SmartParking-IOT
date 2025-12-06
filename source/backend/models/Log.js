import mongoose, { Types } from "mongoose";

const logSchema = new mongoose.Schema(
  {
    vehiclePlate: { type: String, required: true },
    slot: { type: Types.ObjectId, ref: "ParkingSlot" },
    action: { type: String, enum: ["entry", "exit"], required: true },
    entryTime: { type: Date, default: Date.now },
    exitTime: { type: Date },
    imagePath: { type: String },
    status: { type: String, enum: ["accepted", "denied"], default: "accepted" },
  },
  { timestamps: true }
);

export default mongoose.model("Log", logSchema);
