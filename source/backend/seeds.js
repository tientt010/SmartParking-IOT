import "dotenv/config";
import mongoose from "mongoose";
import connectMongo from "./config/db.js";
import ParkingSlot from "./models/ParkingSlot.js";
import Sensor from "./models/Sensor.js";

const seed = async () => {
  await connectMongo();

  const slots = ["A1", "A2", "A3", "B1", "B2"];
  await ParkingSlot.deleteMany({});
  await Sensor.deleteMany({});

  await ParkingSlot.insertMany(slots.map((slot) => ({ slotNumber: slot })));
  await Sensor.insertMany(
    slots.map((slot, idx) => ({
      sensorId: `SENSOR_${slot}`,
      slotNumber: slot,
      status: 0,
    }))
  );

  console.log("Seeded slots & sensors");
  await mongoose.disconnect();
};

seed();
