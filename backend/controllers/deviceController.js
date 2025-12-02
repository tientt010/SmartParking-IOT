export const controlDevice = async (req, res) => {
  try {
    const { action } = req.body;

    if (!action || !["Open", "Close"].includes(action)) {
      return res.status(400).json({
        message: "fail",
        error: "Action must be 'Open' or 'Close'",
      });
    }

    // Emit qua Socket.IO để ESP32 nhận command
    req.app.get("io")?.emit("device:control", { action });

    const mqttClient = req.app.get("mqttClient");
    mqttClient?.publish(
      "iot/parking/barrier",
      JSON.stringify({ action, source: "manual" })
    );

    // todo: publish command MQTT
    // mqttClient.publish("device/barrier/control", JSON.stringify({ action }));
  } catch (error) {
    res.status(500).json({
      message: "fail",
      error: error.message,
    });
  }
};
