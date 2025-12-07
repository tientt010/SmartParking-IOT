// Lưu trạng thái cửa (có thể dùng Map hoặc object)
const gateStatus = {
  gate1: { status: "closed", ts: null, iso: null, lastUpdate: null },
  gate2: { status: "closed", ts: null, iso: null, lastUpdate: null },
};

// Function để update status (gọi từ MQTT client)
export const updateGateStatus = (status, ts, iso) => {
  if (status.startsWith("gate1_")) {
    gateStatus.gate1 = {
      status: status.replace("gate1_", ""), // "open" hoặc "closed"
      ts,
      iso,
      lastUpdate: new Date(),
    };
  } else if (status.startsWith("gate2_")) {
    gateStatus.gate2 = {
      status: status.replace("gate2_", ""),
      ts,
      iso,
      lastUpdate: new Date(),
    };
  }
};

export const controlDevice = async (req, res) => {
  try {
    const { action, gateId } = req.body;

    if (!action || !["Open", "Close"].includes(action)) {
      return res.status(400).json({
        message: "fail",
        error: "Action must be 'Open' or 'Close'",
      });
    }

    // Xác định gate: mặc định gate1 nếu không có gateId
    const gate = gateId || "gate1"; // "gate1" hoặc "gate2"

    if (gate !== "gate1" && gate !== "gate2") {
      return res.status(400).json({
        message: "fail",
        error: "gateId must be 'gate1' or 'gate2'",
      });
    }

    req.app.get("io")?.emit("device:control", { action, gateId: gate });

    // Gửi lệnh qua MQTT đến ESP32
    const mqttClient = req.app.get("mqttClient");
    if (!mqttClient) {
      return res.status(503).json({
        message: "fail",
        error: "MQTT client not available",
      });
    }

    const mqttCommand = action === "Open" ? "open_then_close" : "close";

    // Xác định topic dựa trên gate
    const mqttTopic =
      gate === "gate1"
        ? "esp32/parking/gate1/control"
        : "esp32/parking/gate2/control";

    mqttClient.publish(mqttTopic, mqttCommand, { qos: 1 });

    console.log(
      `[Device] Manual control: ${action} ${gate} via MQTT (${mqttTopic})`
    );

    res.json({
      message: "success",
      action,
      gateId: gate,
      mqttTopic,
      mqttCommand,
    });
  } catch (error) {
    console.error("[Device] Control error:", error.message);
    res.status(500).json({
      message: "fail",
      error: error.message,
    });
  }
};

// API endpoint để lấy trạng thái cửa
export const getGateStatus = async (req, res) => {
  try {
    res.json({
      message: "success",
      gates: {
        gate1: gateStatus.gate1,
        gate2: gateStatus.gate2,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "fail",
      error: error.message,
    });
  }
};
