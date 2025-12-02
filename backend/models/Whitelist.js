import mongoose from "mongoose";

const whitelistSchema = new mongoose.Schema(
  {
    vehiclePlate: { type: String, unique: true, required: true },
    ownerName: String,
    phoneNumber: String,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Whitelist", whitelistSchema);
