import mqtt from "mqtt";
import axios from "axios";
import { updateGateStatus } from "../controllers/deviceController.js";

const MQTT_URL = process.env.MQTT_URL || "mqtt://13.215.71.135:1883";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const LPR_INTERVAL_MS = parseInt(process.env.LPR_INTERVAL_MS || "1000", 10);

export const createMqttClient = (io = null) => {
  console.log("[MQTT] Connecting to broker:", MQTT_URL);
  const client = mqtt.connect(MQTT_URL);
  client.on("connect", () => {
    console.log("MQTT connected:", MQTT_URL);
    client.subscribe("esp32/parking/sensor", { qos: 1 });
    client.subscribe("esp32/parking/exit", { qos: 1 });
    client.subscribe("esp32/parking/entry", { qos: 1 });
    client.subscribe("esp32/parking/image", { qos: 1 });
    client.subscribe("esp32/parking/gate/status", { qos: 1 });
    console.log("[MQTT] Subscribed to gate/status topic");
  });

  client.on("error", (err) => {
    console.error("[MQTT] Connection error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting to broker...");
  });

  let lastLprSentAt = 0;
  let lprInProgress = false;
  let isVehicleAtSensor1 = false; // Trạng thái xe có đang ở vùng sensor 1 không
  const SENSOR1_THRESHOLD = 10.0; // cm (giống ESP32: detectionThreshold = 10.0)

  client.on("message", async (topic, message) => {
    try {
      console.log(
        "[MQTT] Received message on topic:",
        topic,
        "- length:",
        message.length
      );

      if (topic === "esp32/parking/image") {
        if (!isVehicleAtSensor1) {
          console.log(
            "[MQTT] Skip LPR - vehicle not at sensor 1 (already left or not detected)"
          );
          return;
        }

        if (lprInProgress) {
          console.log(
            "[MQTT] Skip LPR frame because previous LPR request is still in progress"
          );
          return;
        }

        const now = Date.now();
        if (now - lastLprSentAt < LPR_INTERVAL_MS) {
          console.log(
            "[MQTT] Skip LPR frame due to rate limit. Interval(ms):",
            LPR_INTERVAL_MS
          );
          return;
        }
        lastLprSentAt = now;
        lprInProgress = true;

        const imageBase64 = message.toString("base64");

        console.log(
          "[MQTT] Forwarding image to HTTP LPR API, size (base64):",
          imageBase64.length
        );

        try {
          await axios.post(`${BACKEND_URL}/api/hardware/lpr`, {
            image: imageBase64,
          });
          console.log("[MQTT] LPR HTTP request finished");
        } finally {
          lprInProgress = false;
        }

        return;
      }

      const payload = JSON.parse(message.toString());

      if (topic === "esp32/parking/sensor") {
        const sensor1Distance = payload.sensor1;
        if (sensor1Distance !== null && sensor1Distance !== undefined) {
          const wasAtSensor1 = isVehicleAtSensor1;
          isVehicleAtSensor1 = sensor1Distance < SENSOR1_THRESHOLD;

          if (wasAtSensor1 && !isVehicleAtSensor1) {
            console.log(
              "[MQTT] Vehicle left sensor 1 area - stopping LPR requests"
            );
          } else if (!wasAtSensor1 && isVehicleAtSensor1) {
            console.log(
              "[MQTT] Vehicle entered sensor 1 area - LPR requests enabled"
            );
          }
        }

        console.log("[MQTT] Forwarding sensor payload to HTTP:", payload);
        await axios.post(`${BACKEND_URL}/api/hardware/sensor`, payload);
      }

      if (topic === "esp32/parking/entry") {
        console.log("[MQTT] Entry event received:", payload);
        isVehicleAtSensor1 = true;
        console.log("[MQTT] Requesting image from ESP32-CAM to trigger LPR...");

        // Publish lệnh yêu cầu ESP32-CAM chụp và gửi ảnh ngay
        client.publish("esp32/parking/camera/capture", "1", { qos: 1 });
        console.log(
          "[MQTT] Published capture command to esp32/parking/camera/capture"
        );
      }

      if (topic === "esp32/parking/exit") {
        console.log("[MQTT] Forwarding exit payload to HTTP:", payload);
        await axios.post(`${BACKEND_URL}/api/hardware/exit`, payload);
      }

      if (topic === "esp32/parking/gate/status") {
        console.log("[MQTT] Gate status received:", payload);
        
        // payload format: {"status":"gate1_open","ts":1234567890,"iso":"2024-01-01T12:00:00+0700"}
        const { status, ts, iso } = payload;
        
        // Cập nhật trạng thái trong memory
        updateGateStatus(status, ts, iso);
        
        // Parse gate number và state từ status string
        // status có thể là: "gate1_open", "gate1_closed", "gate2_open", "gate2_closed"
        let gateId = null;
        let gateState = null;
        
        if (status) {
          if (status.startsWith("gate1_")) {
            gateId = "gate1";
            gateState = status.replace("gate1_", ""); // "open" hoặc "closed"
          } else if (status.startsWith("gate2_")) {
            gateId = "gate2";
            gateState = status.replace("gate2_", ""); // "open" hoặc "closed"
          }
        }

        // Emit qua socket.io để frontend nhận được
        if (io) {
          io.emit("gate:status", {
            gateId,
            status: gateState,
            fullStatus: status,
            ts,
            iso,
            timestamp: new Date().toISOString(),
          });
          console.log(`[MQTT] Emitted gate status to socket: ${gateId} = ${gateState}`);
        } else {
          console.log("[MQTT] Socket.io not available - gate status not emitted");
        }
      }
    } catch (err) {
      console.error("MQTT message error:", topic, err.message);
    }
  });

  return client;
};
