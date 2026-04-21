import prisma from "../config/prisma.js";

// In-memory gate status
const gateStatus = {
  gate1: { status: "closed", lastUpdate: null },
  gate2: { status: "closed", lastUpdate: null },
};

const pendingCommands = [];

// POST /api/device/control — Admin bấm mở/đóng cổng
export const controlDevice = async (req, res) => {
  try {
    const { action, gateId } = req.body;
    if (!action || !["Open", "Close"].includes(action))
      return res.status(400).json({ message: "Action must be Open or Close" });

    const gate = gateId || "gate1";
    if (!["gate1", "gate2"].includes(gate))
      return res.status(400).json({ message: "gateId must be gate1 or gate2" });

    pendingCommands.push({
      gate,
      action: action.toLowerCase(),
      ts: Date.now(),
    });
    if (pendingCommands.length > 10) pendingCommands.shift();

    const io = req.app.get("io");
    const newStatus = action === "Open" ? "open" : "closed";
    gateStatus[gate] = { status: newStatus, lastUpdate: new Date() };
    io?.emit("gate:status", { gateId: gate, status: newStatus, fullStatus: `${gate}_${newStatus}`, timestamp: new Date().toISOString() });
    io?.emit("gate:command", { gate, action: action.toLowerCase() });

    console.log(`[Device] Manual: ${action} ${gate} → Queued for Pi`);
    res.json({ message: "success", action, gateId: gate });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/device/gate-commands — Pi-driver poll mỗi 2 giây
export const getGateCommands = async (req, res) => {
  const now = Date.now();
  const recent = pendingCommands.filter(c => now - c.ts < 5000);
  pendingCommands.splice(0, pendingCommands.length);
  res.json({ commands: recent });
};

export const getGateStatus = async (req, res) => {
  res.json({ message: "success", gates: gateStatus });
};
