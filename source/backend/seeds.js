import bcrypt from "bcryptjs";
import prisma from "./config/prisma.js";
import dotenv from "dotenv";
dotenv.config();

const seed = async () => {
  console.log("🌱 Seeding database...");

  const hashed = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", password: hashed, role: "admin" },
  });
  console.log("✅ Admin user: admin / admin123");

  const plates = [
    { vehiclePlate: "51A12345", ownerName: "Nguyen Van A" },
    { vehiclePlate: "51B67890", ownerName: "Tran Thi B" },
    { vehiclePlate: "29C11111", ownerName: "Le Van C" },
  ];
  for (const p of plates) {
    await prisma.whitelist.upsert({
      where: { vehiclePlate: p.vehiclePlate },
      update: {},
      create: { ...p, status: "active" },
    });
  }
  console.log("✅ Whitelist seeded with", plates.length, "entries");

  // Default parking slots
  const slots = ["slot1", "slot2", "slot3", "slot4"];
  for (const s of slots) {
    await prisma.parkingSlot.upsert({
      where: { slotNumber: s },
      update: {},
      create: { slotNumber: s, status: "empty" },
    });
  }
  console.log("✅ Parking slots seeded:", slots.join(", "));

  console.log("✅ Done! Backend ready.");
  await prisma.$disconnect();
};

seed().catch((e) => { console.error(e); process.exit(1); });
