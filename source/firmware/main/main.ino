#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include <time.h>

// ===== WiFi =====
char ssid[] = "iphone";
char pass[] = "66668888";

// ===== MQTT =====
const char *mqtt_server = "13.215.71.135";
const int mqtt_port = 1883;
const char *mqtt_topic_entry = "esp32/parking/entry";               // sự kiện xe vào
const char *mqtt_topic_exit = "esp32/parking/exit";                 // sự kiện xe ra
const char *mqtt_topic_s36 = "esp32/parking/sensor";                // khoảng cách sensor 3..6 (1s/1 lần)
const char *mqtt_topic_gate_control = "esp32/parking/gate/control"; // điều khiển servo từ server
const char *mqtt_topic_gate_status = "esp32/parking/gate/status";   // trạng thái servo
const char *mqtt_client_id = "ESP32_Device";

// ===== Ultrasonic pins (6 cảm biến) =====
// 1,2: sự kiện vào/ra. 3..6: publish khoảng cách định kỳ.
const int trigPins[6] = {25, 32, 15, 16, 17, 18};
const int echoPins[6] = {33, 35, 2, 4, 5, 19};
// 25 33 là sensor trước servo (1)
// 32 35 là sensor trước servo (2)
// QUy tắc xe vào 1 --> 2
// Quy tắc xe ra 2 --> 1
// ===== Servo =====
// Lưu ý: GPIO34 là input-only, không PWM → dùng GPIO27 để điều khiển servo.
const int servoPin = 27;
Servo gateServo;
bool gateIsOpen = false;    // Trạng thái cổng
bool autoCloseMode = false; // Chế độ tự động đóng khi xe qua

// ===== Logic tham số =====
const float detectionThreshold = 10.0;              // cm (có xe khi < 10cm)
const unsigned long rearmMs = 3000;                 // chống lặp sự kiện 3s
const unsigned long publishIntervalMs = 1000;       // chu kỳ gửi sensor 3..6
const unsigned long checkEntryExitIntervalMs = 200; // chu kỳ kiểm tra vào/ra

// Trạng thái sự kiện vào/ra
bool sensor1_prev = false;
bool sensor2_prev = false;
unsigned long lastEntryMs = 0;
unsigned long lastExitMs = 0;
unsigned long lastCheckEntryExitMs = 0;
unsigned long gateOpenedAtMs = 0; // Thời điểm cổng được mở (để tránh đóng ngay)

// Trạng thái để theo dõi xe đi qua
enum VehicleState
{
  IDLE,
  S1_DETECTED,
  S2_DETECTED
};
VehicleState vehicleState = IDLE;

// Tick gửi định kỳ
unsigned long lastPublishS36Ms = 0;

// ===== MQTT client =====
WiFiClient espClient;
PubSubClient client(espClient);

// ===== Time (GMT+7) =====
const long gmtOffset_sec = 7 * 3600;
const int daylightOffset_sec = 0;

void setup()
{
  Serial.begin(115200);

  // Pin mode cảm biến
  for (int i = 0; i < 6; i++)
  {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
  }

  // Servo
  gateServo.attach(servoPin);
  gateServo.write(0); // đóng cổng

  // WiFi
  Serial.print("Ket noi WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(300);
    Serial.print(".");
  }
  Serial.print("\nIP: ");
  Serial.println(WiFi.localIP());

  // NTP
  configTime(gmtOffset_sec, daylightOffset_sec, "pool.ntp.org", "time.nist.gov");
  waitForTimeSync();

  // MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback); // Thêm callback để nhận message
  reconnectMQTT();

  Serial.println("READY.");
}

void loop()
{
  // Kiểm tra WiFi
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected! Reconnecting...");
    WiFi.reconnect();
    delay(1000);
    return;
  }

  if (!client.connected())
    reconnectMQTT();
  client.loop();

  unsigned long nowMs = millis();

  // 1) Phát hiện xe vào/ra bằng sensor 1 & 2 (mỗi 200ms)
  if (nowMs - lastCheckEntryExitMs >= checkEntryExitIntervalMs)
  {
    checkEntryExit();
    lastCheckEntryExitMs = nowMs;
  }

  // 2) Gửi khoảng cách sensor 3..6 mỗi 1s
  if (nowMs - lastPublishS36Ms >= publishIntervalMs)
  {
    publishS36Distances();
    lastPublishS36Ms = nowMs;
  }

  // Delay nhỏ để WiFi stack xử lý
  delay(10);
}

// ===== Helpers =====

float readUltrasonic(int idx)
{
  digitalWrite(trigPins[idx], LOW);
  delayMicroseconds(2);
  digitalWrite(trigPins[idx], HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPins[idx], LOW);
  long duration = pulseIn(echoPins[idx], HIGH, 30000); // timeout 30ms
  if (duration == 0)
    return -1;                     // timeout
  return duration * 0.034f / 2.0f; // cm
}

void checkEntryExit()
{
  float d1 = readUltrasonic(0); // Sensor 1 - trước servo
  delay(10);                    // Delay giữa các lần đọc
  float d2 = readUltrasonic(1); // Sensor 2 - sau servo

  bool s1 = (d1 > 0 && d1 < detectionThreshold);
  bool s2 = (d2 > 0 && d2 < detectionThreshold);

  unsigned long nowMs = millis();

  // ===== LOGIC XE RA: Đơn giản - Sensor2 detect → mở cửa ngay =====
  if (s2 && !gateIsOpen && (nowMs - lastExitMs > rearmMs))
  {
    // Sensor2 phát hiện xe và cổng đang đóng → XE RA → mở cửa ngay
    publishEvent(mqtt_topic_exit, "exit");
    gateServo.write(90);
    gateIsOpen = true;
    autoCloseMode = true; // Bật chế độ tự động đóng khi xe qua sensor 1
    gateOpenedAtMs = millis(); // Lưu thời điểm mở cửa
    publishGateStatus("open");
    lastExitMs = nowMs;
    Serial.print("EXIT: Sensor 2 detected (d2=");
    Serial.print(d2);
    Serial.print("cm, s1=");
    Serial.print(s1 ? "ON" : "OFF");
    Serial.println(") - Gate AUTO OPENED");
  }

  // ===== ĐÓNG CỔNG: Xe đã đi qua sensor1 → đóng cửa =====
  // Chỉ đóng khi:
  // 1. Cổng đang mở và autoCloseMode = true
  // 2. Sensor1 từ CÓ detect → KHÔNG detect (xe đã đi qua sensor1)
  // 3. Cổng đã mở ít nhất 2 giây (đủ thời gian xe đi qua)
  if (gateIsOpen && autoCloseMode && sensor1_prev && !s1 && 
      (nowMs - gateOpenedAtMs > 2000))
  {
    // Xe đã đi qua sensor1 → đóng cửa
    Serial.print("EXIT: Closing gate - sensor1 passed (opened ");
    Serial.print(nowMs - gateOpenedAtMs);
    Serial.println("ms ago)");
    delay(500);
    closeGate();
    Serial.println("EXIT: Vehicle passed sensor 1 - Gate AUTO CLOSED");
  }

  // ===== XE VÀO: Sensor 1 phát hiện → publish entry NGAY → chờ server mở =====
  if (s1 && !s2 && vehicleState == IDLE && (nowMs - lastEntryMs > rearmMs))
  {
    publishEvent(mqtt_topic_entry, "entry");
    vehicleState = S1_DETECTED; // Đánh dấu đã gửi entry, đang chờ server mở barrier
    lastEntryMs = nowMs;
    Serial.println("ENTRY: Sensor 1 detected - entry event sent, waiting for server to open gate");
  }

  // ===== Sau khi barrier mở (từ server), xe qua sensor 2 → tự đóng =====
  if (vehicleState == S1_DETECTED && gateIsOpen && s2)
  {
    // Xe đã vào qua sensor 2, đóng barrier
    delay(500);
    closeGate();
    vehicleState = IDLE;
    Serial.println("ENTRY: Vehicle passed sensor 2 - gate AUTO CLOSED");
  }

  // Reset state nếu cả 2 sensor đều không phát hiện xe
  // Lưu ý: Giữ S1_DETECTED nếu đang chờ xe qua sensor 2 (barrier đã mở)
  if (!s1 && !s2 && vehicleState != S1_DETECTED)
  {
    vehicleState = IDLE;
  }

  sensor1_prev = s1;
  sensor2_prev = s2;
}

void publishS36Distances()
{
  // Đọc sensor 1..6: index 0..5
  float d1 = readUltrasonic(0);
  delay(10);
  float d2 = readUltrasonic(1);
  delay(10);
  float d3 = readUltrasonic(2);
  delay(10);
  float d4 = readUltrasonic(3);
  delay(10);
  float d5 = readUltrasonic(4);
  delay(10);
  float d6 = readUltrasonic(5);

  // Tạo JSON đơn giản: null nếu ngoài phạm vi/timeout
  String json = "{";
  json += "\"sensor1\":" + valueOrNull(d1) + ",";
  json += "\"sensor2\":" + valueOrNull(d2) + ",";
  json += "\"sensor3\":" + valueOrNull(d3) + ",";
  json += "\"sensor4\":" + valueOrNull(d4) + ",";
  json += "\"sensor5\":" + valueOrNull(d5) + ",";
  json += "\"sensor6\":" + valueOrNull(d6) + ",";
  json += "\"ts\":" + String((long)time(nullptr)) + ",";
  json += "\"iso\":\"" + nowISO8601() + "\"";
  json += "}";

  bool ok = client.publish(mqtt_topic_s36, json.c_str(), true);
  if (!ok)
  {
    Serial.println("PUB S36 FAILED");
  }
}

String valueOrNull(float d)
{
  if (d > 0 && d < 400.0f)
  {
    return String(d, 1); // 1 số thập phân
  }
  return String("null");
}

void openGate()
{
  if (!gateIsOpen)
  {
    gateServo.write(90);
    gateIsOpen = true;
    autoCloseMode = false;
    publishGateStatus("open");
    Serial.println("Gate OPENED");
  }
}

void closeGate()
{
  if (gateIsOpen)
  {
    gateServo.write(0);
    gateIsOpen = false;
    autoCloseMode = false;
    publishGateStatus("closed");
    Serial.println("Gate CLOSED");
  }
}

void openThenClose()
{
  // Mở cổng và bật chế độ tự động đóng
  gateServo.write(90);
  gateIsOpen = true;
  autoCloseMode = true;
  publishGateStatus("open");
  Serial.println("Gate OPENED - will auto close when vehicle passes sensor 2");
}

void toggleGate()
{
  if (gateIsOpen)
  {
    closeGate();
  }
  else
  {
    openGate();
  }
}

void publishGateStatus(const char *status)
{
  String payload = String("{\"status\":\"") + status +
                   "\",\"ts\":" + String((long)time(nullptr)) +
                   ",\"iso\":\"" + nowISO8601() + "\"}";
  client.publish(mqtt_topic_gate_status, payload.c_str(), true);
  Serial.print("Gate status: ");
  Serial.println(status);
}

// Callback khi nhận message từ MQTT
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
  String message = "";
  for (unsigned int i = 0; i < length; i++)
  {
    message += (char)payload[i];
  }

  Serial.print("MQTT received [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  // Xử lý lệnh điều khiển cổng
  if (String(topic) == mqtt_topic_gate_control)
  {
    message.toLowerCase();

    if (message == "open")
    {
      openGate();
    }
    else if (message == "close")
    {
      closeGate();
    }
    else if (message == "open_then_close")
    {
      openThenClose();
    }
    else if (message == "toggle")
    {
      toggleGate();
    }
    else
    {
      Serial.println("Unknown gate command");
    }
  }
}

void reconnectMQTT()
{
  while (!client.connected())
  {
    Serial.print("MQTT connecting...");
    if (client.connect(mqtt_client_id))
    {
      Serial.println("OK");
      // Subscribe topic điều khiển cổng
      client.subscribe(mqtt_topic_gate_control);
      Serial.print("Subscribed to: ");
      Serial.println(mqtt_topic_gate_control);

      // Publish trạng thái ban đầu
      publishGateStatus(gateIsOpen ? "open" : "closed");
    }
    else
    {
      Serial.print("fail(");
      Serial.print(client.state());
      Serial.println(") retry 2s");
      delay(2000);
    }
  }
}

void waitForTimeSync()
{
  for (int i = 0; i < 50; i++)
  {
    time_t now = time(nullptr);
    if (now > 1700000000)
    { // đã có thời gian hợp lệ
      struct tm ti;
      localtime_r(&now, &ti);
      char buf[32];
      strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S%z", &ti);
      Serial.print("Time synced: ");
      Serial.println(buf);
      return;
    }
    delay(200);
  }
  Serial.println("Time sync timeout, will still publish epoch=0 until synced.");
}

String nowISO8601()
{
  time_t now = time(nullptr);
  struct tm ti;
  localtime_r(&now, &ti);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S%z", &ti);
  return String(buf);
}

void publishEvent(const char *topic, const char *type)
{
  time_t now = time(nullptr);
  String payload = String("{\"event\":\"") + type +
                   "\",\"ts\":" + String((long)now) +
                   ",\"iso\":\"" + nowISO8601() + "\"}";
  client.publish(topic, payload.c_str(), true);
  Serial.print("PUB ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
}