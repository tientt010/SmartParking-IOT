import mqtt from "mqtt";
import axios from "axios";

const MQTT_URL = process.env.MQTT_URL || "mqtt://13.215.71.135:1883";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const LPR_INTERVAL_MS = parseInt(process.env.LPR_INTERVAL_MS || "1000", 10);

export const createMqttClient = () => {
  console.log("[MQTT] Connecting to broker:", MQTT_URL);
  const client = mqtt.connect(MQTT_URL);
  client.on("connect", () => {
    console.log("MQTT connected:", MQTT_URL);
    client.subscribe("esp32/parking/sensor", { qos: 1 });
    client.subscribe("esp32/parking/exit", { qos: 1 });
    client.subscribe("esp32/parking/entry", { qos: 1 });
    client.subscribe("esp32/parking/image", { qos: 1 });
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
        // Chỉ xử lý LPR nếu xe đang ở vùng sensor 1
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
        // Theo dõi trạng thái sensor1 để biết xe có đang ở vùng không
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
        // Khi có entry event, giả sử xe đang ở sensor 1
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
    } catch (err) {
      console.error("MQTT message error:", topic, err.message);
    }
  });

  return client;
};
