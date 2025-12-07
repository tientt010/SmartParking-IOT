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
const char *mqtt_topic_entry = "esp32/parking/entry";                  // sự kiện xe vào
const char *mqtt_topic_exit = "esp32/parking/exit";                    // sự kiện xe ra
const char *mqtt_topic_s36 = "esp32/parking/sensor";                   // khoảng cách sensor 3..6 (1s/1 lần)
const char *mqtt_topic_gate1_control = "esp32/parking/gate1/control";  // điều khiển servo1 (cửa vào) từ server
const char *mqtt_topic_gate2_control = "esp32/parking/gate2/control";  // điều khiển servo2 (cửa ra) từ server
const char *mqtt_topic_gate_control = "esp32/parking/gate/control";    // điều khiển chung (legacy)
const char *mqtt_topic_gate_status = "esp32/parking/gate/status";      // trạng thái servo
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
// Servo1 (cửa vào) - GPIO27
// Servo2 (cửa ra) - GPIO26
const int servo1Pin = 27; // Cửa vào (Entry Gate)
const int servo2Pin = 26; // Cửa ra (Exit Gate)
Servo servo1; // Cửa vào
Servo servo2; // Cửa ra
bool gate1IsOpen = false; // Trạng thái cửa vào
bool gate2IsOpen = false; // Trạng thái cửa ra
bool gate1AutoClose = false; // Chế độ tự động đóng gate1
bool gate2AutoClose = false; // Chế độ tự động đóng gate2
unsigned long gate1OpenTime = 0; // Thời điểm mở cửa vào (để tự đóng sau 5s)
unsigned long gate2OpenTime = 0; // Thời điểm mở cửa ra (để tự đóng sau 5s)

// ===== Logic tham số =====
const float detectionThreshold = 4.0;              // cm (có xe khi < 4cm)
const unsigned long rearmMs = 3000;                 // chống lặp sự kiện 3s
const unsigned long publishIntervalMs = 1000;       // chu kỳ gửi sensor 3..6
const unsigned long checkEntryExitIntervalMs = 200; // chu kỳ kiểm tra vào/ra

// Trạng thái sự kiện vào/ra
bool sensor1_prev = false;
bool sensor2_prev = false;
unsigned long lastEntryMs = 0;
unsigned long lastExitMs = 0;
unsigned long lastCheckEntryExitMs = 0;

// Tick gửi định kỳ
unsigned long lastPublishS36Ms = 0;

// ===== MQTT client =====
WiFiClient espClient;
PubSubClient client(espClient);

// ===== Forward declarations =====
void openGate1(bool autoClose = false);
void closeGate1();
void openGate2(bool autoClose = false);
void closeGate2();
void publishEvent(const char *topic, const char *type);
void publishGateStatus(const char *status);

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
  servo1.attach(servo1Pin);
  servo2.attach(servo2Pin);
  servo1.write(0); // đóng cửa vào
  servo2.write(0); // đóng cửa ra

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

  // 2) Tự động đóng cửa sau 5s
  autoCloseGates(nowMs);

  // 3) Gửi khoảng cách sensor 3..6 mỗi 1s
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
  float d1 = readUltrasonic(0); // Sensor 1 - cửa vào
  delay(10);                    
  float d2 = readUltrasonic(1); // Sensor 2 - cửa ra

  bool s1 = (d1 > 0 && d1 < detectionThreshold);
  bool s2 = (d2 > 0 && d2 < detectionThreshold);

  unsigned long nowMs = millis();

  // ===== LOGIC CỬA VÀO: Sensor1 phát hiện → gửi entry → chờ server mở =====
  if (s1 && !sensor1_prev && (nowMs - lastEntryMs > rearmMs))
  {
    // Sensor1 phát hiện xe lần đầu → gửi event "entry"
    publishEvent(mqtt_topic_entry, "entry");
    lastEntryMs = nowMs;
    Serial.print("ENTRY: Sensor 1 detected (d1=");
    Serial.print(d1);
    Serial.println("cm) - Entry event sent, waiting for server command");
  }

  // ===== LOGIC CỬA RA: Sensor2 phát hiện → tự động mở cửa ra ngay =====
  if (s2 && !sensor2_prev && !gate2IsOpen && (nowMs - lastExitMs > rearmMs))
  {
    // Sensor2 phát hiện xe lần đầu → mở cửa ra tự động (KHÔNG tự đóng)
    publishEvent(mqtt_topic_exit, "exit");
    openGate2(false); // Mở cửa ra - manual mode (không tự đóng)
    lastExitMs = nowMs;
    Serial.print("EXIT: Sensor 2 detected (d2=");
    Serial.print(d2);
    Serial.println("cm) - Exit gate OPENED (manual mode)");
  }

  sensor1_prev = s1;
  sensor2_prev = s2;
}

// Tự động đóng cửa sau 5 giây
void autoCloseGates(unsigned long nowMs)
{
  const unsigned long autoCloseDelay = 5000; // 5 giây

  // Tự động đóng cửa vào sau 5s (chỉ khi bật chế độ auto close)
  if (gate1IsOpen && gate1AutoClose && (nowMs - gate1OpenTime >= autoCloseDelay))
  {
    closeGate1();
    Serial.println("ENTRY: Gate 1 AUTO CLOSED after 5s");
  }

  // Tự động đóng cửa ra sau 5s (chỉ khi bật chế độ auto close)
  if (gate2IsOpen && gate2AutoClose && (nowMs - gate2OpenTime >= autoCloseDelay))
  {
    closeGate2();
    Serial.println("EXIT: Gate 2 AUTO CLOSED after 5s");
  }
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
  json += "\"iso\"😕"" + nowISO8601() + "\"";
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

void openGate1(bool autoClose)
{
  if (!gate1IsOpen)
  {
    servo1.write(90);
    gate1IsOpen = true;
    gate1AutoClose = autoClose;
    if (autoClose)
    {
      gate1OpenTime = millis();
      Serial.println("Gate 1 (ENTRY) OPENED - will auto close in 5s");
    }
    else
    {
      Serial.println("Gate 1 (ENTRY) OPENED - manual mode");
    }
    publishGateStatus("gate1_open");
  }
}

void closeGate1()
{
  if (gate1IsOpen)
  {
    servo1.write(0);
    gate1IsOpen = false;
    gate1AutoClose = false;
    publishGateStatus("gate1_closed");
    Serial.println("Gate 1 (ENTRY) CLOSED");
  }
}

void openGate2(bool autoClose)
{
  if (!gate2IsOpen)
  {
    servo2.write(90);
    gate2IsOpen = true;
    gate2AutoClose = autoClose;
    if (autoClose)
    {
      gate2OpenTime = millis();
      Serial.println("Gate 2 (EXIT) OPENED - will auto close in 5s");
    }
    else
    {
      Serial.println("Gate 2 (EXIT) OPENED - manual mode");
    }
    publishGateStatus("gate2_open");
  }
}

void closeGate2()
{
  if (gate2IsOpen)
  {
    servo2.write(0);
    gate2IsOpen = false;
    gate2AutoClose = false;
    publishGateStatus("gate2_closed");
    Serial.println("Gate 2 (EXIT) CLOSED");
  }
}

// Legacy functions - giữ để tương thích với server cũ
void openGate()
{
  openGate1(false); // Mặc định mở cửa vào - manual mode
}

void closeGate()
{
  closeGate1(); // Mặc định đóng cửa vào
}

void openThenClose()
{
  // Mở cửa vào và sẽ tự động đóng sau 5s
  openGate1(true);
}

void toggleGate()
{
  // Toggle cửa vào
  if (gate1IsOpen)
  {
    closeGate1();
  }
  else
  {
    openGate1(false); // Manual mode
  }
}

void publishGateStatus(const char *status)
{
  String payload = String("{\"status\"😕"") + status +
                   "\",\"ts\":" + String((long)time(nullptr)) +
                   ",\"iso\"😕"" + nowISO8601() + "\"}";
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

  String topicStr = String(topic);
  message.toLowerCase();

  // Xử lý lệnh điều khiển cửa vào (gate1)
  if (topicStr == mqtt_topic_gate1_control || topicStr == mqtt_topic_gate_control)
  {
    if (message == "open")
    {
      openGate1(false); // Manual mode - không tự đóng
    }
    else if (message == "close")
    {
      closeGate1();
    }
    else if (message == "open_then_close")
    {
      openGate1(true); // Sẽ tự đóng sau 5s
    }
    else if (message == "toggle")
    {
      if (gate1IsOpen)
        closeGate1();
      else
        openGate1(false); // Manual mode
    }
    else
    {
      Serial.println("Unknown gate1 command");
    }
  }
  // Xử lý lệnh điều khiển cửa ra (gate2)
  else if (topicStr == mqtt_topic_gate2_control)
  {
    if (message == "open")
    {
      openGate2(false); // Manual mode - không tự đóng
    }
    else if (message == "close")
    {
      closeGate2();
    }
    else if (message == "open_then_close")
    {
      openGate2(true); // Sẽ tự đóng sau 5s
    }
    else if (message == "toggle")
    {
      if (gate2IsOpen)
        closeGate2();
      else
        openGate2(false); // Manual mode
    }
    else
    {
      Serial.println("Unknown gate2 command");
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
      client.subscribe(mqtt_topic_gate_control);   // Legacy - điều khiển gate1
      client.subscribe(mqtt_topic_gate1_control);  // Điều khiển riêng gate1
      client.subscribe(mqtt_topic_gate2_control);  // Điều khiển riêng gate2
      Serial.println("Subscribed to:");
      Serial.print("  - ");
      Serial.println(mqtt_topic_gate_control);
      Serial.print("  - ");
      Serial.println(mqtt_topic_gate1_control);
      Serial.print("  - ");
      Serial.println(mqtt_topic_gate2_control);

      // Publish trạng thái ban đầu
      publishGateStatus(gate1IsOpen ? "gate1_open" : "gate1_closed");
      publishGateStatus(gate2IsOpen ? "gate2_open" : "gate2_closed");
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
  String payload = String("{\"event\"😕"") + type +
                   "\",\"ts\":" + String((long)now) +
                   ",\"iso\"😕"" + nowISO8601() + "\"}";
  client.publish(topic, payload.c_str(), true);
  Serial.print("PUB ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(payload);
}