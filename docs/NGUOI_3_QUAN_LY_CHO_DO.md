# 📘 TÀI LIỆU NGƯỜI 3 — QUẢN LÝ CHỖ ĐỖ

> **Chức năng chính**: Cập nhật trạng thái trống/đầy và hiển thị realtime.  
> **Phần vi xử lý bắt buộc**: Đọc cụm sensor chỗ đỗ, lọc nhiễu đo khoảng cách, hiệu chỉnh ngưỡng cho từng cảm biến.

---

## 1. TỔNG QUAN

### 1.1 Sơ đồ luồng dữ liệu

```
┌────────────┐  ┌────────────┐
│  HC-SR04   │  │  HC-SR04   │
│  Sensor 3  │  │  Sensor 4  │
│  (Ô đỗ 1) │  │  (Ô đỗ 2) │
└─────┬──────┘  └─────┬──────┘
      │               │
      └───────┬───────┘
              │  GPIO
       ┌──────▼──────┐        ┌──────────────┐       ┌─────────────┐
       │  Python     │  HTTP  │   Backend    │Socket │  Dashboard  │
       │  main.py    │──POST─>│  Node.js     │──IO──>│  React      │
       │  (mỗi 2s)  │        │  updateSensor│       │  SlotGrid   │
       └─────────────┘        └──────────────┘       └─────────────┘
```

### 1.2 Hệ thống chỉ có 2 ô đỗ (sensor3 + sensor4)

Python `main.py` quản lý **4 sensor** tổng cộng:
- Sensor 1 (GPIO 22/23) = Cổng vào → **Người 1** quản lý
- Sensor 2 (GPIO 25/8)  = Cổng ra  → **Người 2** quản lý
- **Sensor 3 (GPIO 12/16) = Ô đỗ 1** → Người 3
- **Sensor 4 (GPIO 20/21) = Ô đỗ 2** → Người 3

---

## 2. CODE CHI TIẾT — `source/pi-driver/main.py`

### 2.1 Cấu hình GPIO sensor chỗ đỗ (Dòng 22-26)

```python
TRIG_PIN_3 = int(os.getenv("SENSOR3_TRIG", 12))   # Ô đỗ 1
ECHO_PIN_3 = int(os.getenv("SENSOR3_ECHO", 16))
TRIG_PIN_4 = int(os.getenv("SENSOR4_TRIG", 20))   # Ô đỗ 2
ECHO_PIN_4 = int(os.getenv("SENSOR4_ECHO", 21))

PARK_THRESHOLD = 4.0    # Ngưỡng phát hiện xe trong ô (cm) — hardcoded
```

### 2.2 Đọc sensor + Hiển thị trạng thái local (Dòng 242-248)

```python
# Trong main loop — đọc mỗi 300ms:
dist_lot1 = read_distance(TRIG_PIN_3, ECHO_PIN_3)
dist_lot2 = read_distance(TRIG_PIN_4, ECHO_PIN_4)

# Xử lý trạng thái LOCAL (in terminal)
status_lot1 = "🔴 ĐẦY" if (0 < dist_lot1 < PARK_THRESHOLD) else "🟢 TRỐNG"
status_lot2 = "🔴 ĐẦY" if (0 < dist_lot2 < PARK_THRESHOLD) else "🟢 TRỐNG"
```

### 2.3 Push data lên backend qua HTTP (Dòng 265-277)

```python
# Throttle: chỉ push mỗi 2 giây
if now - last_sensor_push > 2.0:
    try:
        requests.post(
            f"{BACKEND_URL}/api/hardware/sensor",
            json={
                "sensor3": round(dist_lot1, 1) if dist_lot1 > 0 else None,
                "sensor4": round(dist_lot2, 1) if dist_lot2 > 0 else None,
            },
            timeout=1,
        )
        last_sensor_push = now
    except Exception:
        pass   # Backend offline → không crash, tiếp tục
```

### 2.4 Hiển thị realtime trên terminal (Dòng 283-290)

```python
# Output terminal (dòng đè liên tục với \r):
#   [VÀ]  3.2cm | [RA] ---   ║  [Ô 1]: 🟢 TRỐNG | [Ô 2]: 🔴 ĐẦY
log_lot = f"[Ô 1]: {status_lot1} | [Ô 2]: {status_lot2}"
print(f"\r  {log_gate}  ║  {log_lot}        ", end="", flush=True)
```

### 2.5 Lọc nhiễu trong read_distance (Dòng 116-133)

```python
def read_distance(trig, echo) -> float:
    # ... trigger 10μs ...
    
    # LỌC NHIỄU 1: Timeout 100ms (ECHO_TIMEOUT)
    while GPIO.input(echo) == 0:
        if time.time() - t0 > ECHO_TIMEOUT: return -1.0   # Sensor lỗi

    # LỌC NHIỄU 2: Phạm vi hợp lệ 0–400cm
    return round(dist, 1) if 0 < dist < 400 else -1.0
```

**Cơ chế lọc nhiễu tại Python:**
1. `ECHO_TIMEOUT = 0.1s`: Nếu sensor không phản hồi → trả `-1.0`
2. `0 < dist < 400`: Loại bỏ giá trị ngoài phạm vi HC-SR04
3. `dist > 0 else None`: Khi push lên backend, chuyển `-1.0` thành `null` → backend biết bỏ qua

---

## 3. CODE CHI TIẾT — Backend `source/backend/controllers/hardwareController.js`

### 3.1 updateSensor — Nhận data từ Python, cập nhật DB (Dòng 6-42)

```javascript
const SENSOR_THRESHOLD = 7.0;   // Ngưỡng mặc định (cm)

export const updateSensor = async (req, res) => {
    // main.py chỉ gửi sensor3 + sensor4
    const slotMapping = [
        { key: "sensor3", sensorId: "sensor3", slotNumber: "slot1" },
        { key: "sensor4", sensorId: "sensor4", slotNumber: "slot2" },
        { key: "sensor5", sensorId: "sensor5", slotNumber: "slot3" },  // Dự phòng mở rộng
        { key: "sensor6", sensorId: "sensor6", slotNumber: "slot4" },
    ];

    for (const { key, sensorId, slotNumber } of slotMapping) {
        const distance = req.body[key];
        if (distance === null || distance === undefined) continue;  // Bỏ qua sensor lỗi/null

        // HIỆU CHỈNH NGƯỠNG RIÊNG cho từng sensor
        const existingSensor = await prisma.sensor.findUnique({ where: { sensorId } });
        const threshold = existingSensor?.threshold ?? SENSOR_THRESHOLD;

        const status = distance < threshold ? 1 : 0;   // 1=occupied, 0=empty
        const previousStatus = existingSensor?.status;

        await prisma.sensor.upsert({
            where: { sensorId },
            update: { status, distance },
            create: { sensorId, slotNumber, status, distance, threshold: SENSOR_THRESHOLD },
        });

        // CHỈ EMIT KHI TRẠNG THÁI THAY ĐỔI → giảm noise
        if (previousStatus !== status) {
            await updateParkingSlot(slotNumber, status === 1 ? "occupied" : "empty", io);
        }
    }
};
```

### 3.2 Hiệu chỉnh ngưỡng qua API (Dòng 60-76)

```javascript
// PUT /api/hardware/sensor/sensor3
export const updateSensorConfig = async (req, res) => {
    const { threshold } = req.body;   // VD: 5.5
    await prisma.sensor.update({ where: { sensorId }, data: { threshold } });
};
```

### 3.3 Frontend SensorsPage — Chỉnh threshold trên Dashboard

```jsx
// source/frontend/src/pages/SensorsPage.jsx
// Auto-refresh mỗi 2 giây
useEffect(() => {
    const t = setInterval(() => api.get("/hardware/sensor").then(r => setSensors(r.data)), 2000);
    return () => clearInterval(t);
}, []);

// Admin chỉnh threshold qua UI
const saveThreshold = async (sensorId, threshold) => {
    await api.put(`/hardware/sensor/${sensorId}`, { threshold: parseFloat(threshold) });
};
```

---

## 4. DATABASE SCHEMA

```prisma
model Sensor {
  id         Int    @id @default(autoincrement())
  sensorId   String @unique        // "sensor3", "sensor4"
  slotNumber String                // "slot1", "slot2"
  status     Int    @default(0)    // 0=empty, 1=occupied
  distance   Float?                // Khoảng cách mới nhất (cm)
  threshold  Float  @default(7.0)  // NGƯỠNG RIÊNG cho từng sensor
}
```

---

## 5. HIỆU CHỈNH NGƯỠNG — HƯỚNG DẪN

### Tại sao cần hiệu chỉnh riêng?
Mỗi vị trí đặt sensor khác nhau: khoảng cách tới mặt đất, góc đặt, vật cản.

### Cách hiệu chỉnh
1. Đo khi slot **TRỐNG** → VD: 25cm
2. Đo khi **CÓ XE** → VD: 3cm
3. Đặt threshold = giữa → VD: 10cm
4. Cập nhật qua SensorsPage UI hoặc API:
   ```
   PUT /api/hardware/sensor/sensor3
   Body: { "threshold": 10.0 }
   ```

> ⚠️ **Lưu ý**: Ngưỡng trong `main.py` (`PARK_THRESHOLD = 4.0`) chỉ dùng cho hiển thị terminal. Ngưỡng thực sự để cập nhật DB là `threshold` per sensor trong backend.

---

## 6. API ENDPOINTS

| Method | Endpoint | Ai gọi | Mô tả |
|---|---|---|---|
| `POST` | `/api/hardware/sensor` | Python `main.py` (mỗi 2s) | Push sensor data |
| `GET` | `/api/hardware/sensor` | Frontend SensorsPage | Lấy tất cả config |
| `PUT` | `/api/hardware/sensor/:id` | Frontend SensorsPage | Chỉnh threshold |
| `GET` | `/api/slots` | Frontend DashboardPage | Trạng thái slot |

---

## 7. CHECKLIST PHẦN CỨNG

- [ ] HC-SR04 sensor 3: TRIG=GPIO12, ECHO=GPIO16 (Ô đỗ 1)
- [ ] HC-SR04 sensor 4: TRIG=GPIO20, ECHO=GPIO21 (Ô đỗ 2)
- [ ] **Voltage divider** trên ECHO pins
- [ ] Sensor hướng xuống về phía xe
- [ ] Hiệu chỉnh threshold phù hợp vị trí
