import mqtt from "mqtt";
import axios from "axios";
import { updateGateStatus } from "../controllers/deviceController.js";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export const createMqttClient = (io = null) => {
  console.log("[MQTT] Connecting to broker:", MQTT_URL);
  const client = mqtt.connect(MQTT_URL, { clientId: "smartparking-backend" });

  client.on("connect", () => {
    console.log("[MQTT] Connected to broker:", MQTT_URL);
    client.subscribe("parking/sensor", { qos: 1 });
    client.subscribe("parking/entry", { qos: 1 });
    client.subscribe("parking/exit", { qos: 1 });
    client.subscribe("parking/image", { qos: 1 });
    client.subscribe("parking/gate/status", { qos: 1 });
    console.log("[MQTT] Subscribed to all parking topics");
  });

  client.on("error", (err) => console.error("[MQTT] Error:", err.message));
  client.on("reconnect", () => console.log("[MQTT] Reconnecting..."));

  let lprInProgress = false;
  let isVehicleAtSensor1 = false;
  const SENSOR1_THRESHOLD = 4.0; // cm
  const LPR_INTERVAL_MS = parseInt(process.env.LPR_INTERVAL_MS || "2000");
  let lastLprSentAt = 0;
  let gate2CloseTimeout = null;

  client.on("message", async (topic, message) => {
    try {
      if (topic === "parking/image") {
        if (!isVehicleAtSensor1) return;
        if (lprInProgress) return;

        const now = Date.now();
        if (now - lastLprSentAt < LPR_INTERVAL_MS) return;
        lastLprSentAt = now;
        lprInProgress = true;

        const imageBase64 = message.toString("base64");
        console.log("[MQTT] Forwarding image to LPR API, size:", imageBase64.length);

        try {
          await axios.post(`${BACKEND_URL}/api/hardware/lpr`, { image: imageBase64 });
        } finally {
          lprInProgress = false;
        }
        return;
      }

      const payload = JSON.parse(message.toString());

      if (topic === "parking/sensor") {
        const d1 = payload.sensor1;
        if (d1 !== null && d1 !== undefined) {
          const wasAt = isVehicleAtSensor1;
          isVehicleAtSensor1 = d1 < SENSOR1_THRESHOLD;
          if (wasAt && !isVehicleAtSensor1)
            console.log("[MQTT] Vehicle LEFT sensor1 — stopping LPR");
          if (!wasAt && isVehicleAtSensor1)
            console.log("[MQTT] Vehicle ENTERED sensor1 — LPR enabled");
        }
        await axios.post(`${BACKEND_URL}/api/hardware/sensor`, payload).catch(() => {});
      }

      if (topic === "parking/entry") {
        console.log("[MQTT] Entry event:", payload);
        isVehicleAtSensor1 = true;
        client.publish("parking/camera/capture", "1", { qos: 1 });
        console.log("[MQTT] Camera capture command sent");
      }

      if (topic === "parking/exit") {
        console.log("[MQTT] Exit event:", payload);
        await axios.post(`${BACKEND_URL}/api/hardware/exit`, payload).catch(() => {});
      }

      if (topic === "parking/gate/status") {
        const { status, ts, iso } = payload;
        updateGateStatus(status, ts, iso);

        let gateId = null, gateState = null;
        if (status?.startsWith("gate1_")) { gateId = "gate1"; gateState = status.replace("gate1_", ""); }
        else if (status?.startsWith("gate2_")) {
          gateId = "gate2"; gateState = status.replace("gate2_", "");
          if (gateState === "open") {
            if (gate2CloseTimeout) clearTimeout(gate2CloseTimeout);
            gate2CloseTimeout = setTimeout(() => {
              client.publish("parking/gate2/control", "close", { qos: 1 });
              console.log("[MQTT] Auto-closed gate2 after 5s");
              gate2CloseTimeout = null;
            }, 5000);
          } else if (gateState === "closed" && gate2CloseTimeout) {
            clearTimeout(gate2CloseTimeout);
            gate2CloseTimeout = null;
          }
        }

        io?.emit("gate:status", { gateId, status: gateState, fullStatus: status, ts, iso, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      console.error("[MQTT] Message error:", topic, err.message);
    }
  });

  return client;
};
