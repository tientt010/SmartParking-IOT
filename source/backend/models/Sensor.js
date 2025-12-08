import mongoose from "mongoose";

const sensorSchema = new mongoose.Schema(
  {
    sensorId: { type: String, unique: true, required: true },
    slotNumber: { type: String, required: true },
    status: { type: Number, default: 0 },
    distance: Number,
    threshold: { type: Number, default: 7 },
    isActive: { type: Boolean, default: true }, // Admin có thể tắt sensor thủ công
  },
  { timestamps: true }
);

export default mongoose.model("Sensor", sensorSchema);
