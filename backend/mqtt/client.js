import mqtt from "mqtt";
import axios from "axios";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export const createMqttClient = () => {
  const client = mqtt.connect(MQTT_URL);
  client.on("connect", () => {
    console.log("MQTT connected:", MMQTT_URL);
    client.subscribe("iot/parking/sensor", { qos: 1 });
    client.subscribe("iot/parking/exit", { qos: 1 });
    client.subscribe("iot/parking/lpr", { qos: 1 });
  });

  client.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (topic === "iot/parking/sensor") {
        await axios.post(`${BACKEND_URL}/api/hardware/sensor`, payload);
      }

      if (topic === "iot/parking/exit") {
        await axios.post(`${BACKEND_URL}/api/hardware/exit`, payload);
      }

      if (topic === "iot/parking/lpr") {
        await axios.post(`${BACKEND_URL}/api/hardware/lpr`, payload);
      }
    } catch (err) {
      console.error("MQTT message error:", topic, err.message);
    }
  });

  return client;
};
