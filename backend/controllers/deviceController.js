export const controlDevice = async (req, res) => {
  try {
    const { action } = req.body;

    if (!action || !["Open", "Close"].includes(action)) {
      return res.status(400).json({
        message: "fail",
        error: "Action must be 'Open' or 'Close'",
      });
    }

    req.app.get("io")?.emit("device:control", { action });

    // Gửi lệnh qua MQTT đến ESP32
    const mqttClient = req.app.get("mqttClient");
    if (!mqttClient) {
      return res.status(503).json({
        message: "fail",
        error: "MQTT client not available",
      });
    }

    const mqttCommand = action === "Open" ? "open" : "close";
    mqttClient.publish("esp32/parking/gate/control", mqttCommand, { qos: 1 });

    console.log(`[Device] Manual control: ${action} barrier via MQTT`);

    res.json({
      message: "success",
      action,
      mqttTopic: "esp32/parking/gate/control",
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
