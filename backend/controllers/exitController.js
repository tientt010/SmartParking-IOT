import ParkingSlot from "../models/ParkingSlot.js";
import Log from "../models/Log.js";

export const processExit = async (req, res) => {
  try {
    // Khi ESP32 gửi exit event, không có slotNumber trong body
    // Tự động tìm slot đang occupied để giải phóng
    const { slotNumber } = req.body;

    let slot;

    if (slotNumber) {
      // Nếu có slotNumber từ frontend (manual exit)
      slot = await ParkingSlot.findOne({ slotNumber });
    } else {
      // Tự động tìm slot đang occupied đầu tiên (từ ESP32 exit event)
      slot = await ParkingSlot.findOne({ status: "occupied" });
    }

    if (!slot || slot.status === "empty") {
      console.log("[Exit] No occupied slot found - skip");
      return res.json({
        action: "skip",
        message: "Slot already empty or not found",
      });
    }

    const vehiclePlate = slot.vehiclePlate;

    // Giải phóng slot
    slot.status = "empty";
    slot.vehiclePlate = null;
    slot.entryTime = null;
    slot.exitTime = new Date();
    await slot.save();

    console.log(`[Exit] Slot ${slot.slotNumber} freed${vehiclePlate ? ` - Vehicle: ${vehiclePlate}` : ""}`);

    // Log exit event
    if (vehiclePlate) {
      await Log.create({
        vehiclePlate: vehiclePlate,
        slot: slot._id,
        action: "exit",
        exitTime: new Date(),
        status: "accepted",
      });
    }

    // Emit socket events để frontend update
    req.app.get("io")?.emit("slot:update", {
      slotNumber: slot.slotNumber,
      status: "empty",
    });

    req.app.get("io")?.emit("exit:processed", {
      slotNumber: slot.slotNumber,
      vehiclePlate: vehiclePlate,
    });

    // Lưu ý: KHÔNG gửi lệnh mở barrier vì ESP32 đã tự động mở rồi
    // (ESP32 tự mở khi detect s2→s1 pattern)

    res.json({
      action: "accept",
      message: "Exit processed",
      slotNumber: slot.slotNumber,
      vehiclePlate: vehiclePlate,
    });
  } catch (error) {
    console.error("[Exit] Error:", error.message);
    res.status(500).json({
      action: "deny",
      error: error.message,
    });
  }
};
