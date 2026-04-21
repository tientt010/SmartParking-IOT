# 📗 TÀI LIỆU NGƯỜI 1 — LUỒNG XE VÀO

> **Chức năng chính**: Nhận diện biển số xe và quyết định cho xe vào bãi.  
> **Phần vi xử lý bắt buộc**: Xử lý sensor cổng vào, trigger camera, chống rung tín hiệu, retry khi ảnh lỗi.

---

## 1. TỔNG QUAN KIẾN TRÚC

### 1.1 Kiến trúc thực tế (2 process duy nhất)

```
Khởi động hệ thống trên Pi:
  $ python main.py        ← XỬ LÝ CHÍNH (sensor, camera, AI, servo)
  $ npm run dev            ← Backend phụ trợ (DB, Dashboard, thanh toán)

┌────────────────────────────────────────────────────────────────────┐
│                        RASPBERRY PI 4                              │
│                                                                    │
│  ┌────────────────────────────────────────┐   ┌────────────────┐  │
│  │          Python main.py                │   │  Node.js       │  │
│  │                                        │   │  Backend       │  │
│  │  • GPIO: Sensor HC-SR04 (đọc xe)       │   │                │  │
│  │  • Camera: IP Webcam (chụp biển số)    │   │  • Prisma/DB   │  │
│  │  • AI: RapidOCR (nhận diện biển số)    │──>│  • REST API    │  │
│  │  • Servo: PWM (mở/đóng cổng)          │ HTTP POST         │  │
│  │  • Poll lệnh thủ công từ backend      │<──│  • Socket.IO   │  │
│  │                                        │ HTTP GET           │  │
│  └────────────────────────────────────────┘   └────────────────┘  │
│                                                                    │
│  HC-SR04 × 4   Servo × 2   IP Webcam (Android, WiFi)             │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Luồng xe vào

```
Sensor1 (HC-SR04)     main.py            IP Webcam       Backend API
  │                     │                    │               │
  │── < 4cm ──────────> │                    │               │
  │  (xe đến cổng vào)  │                    │               │
  │                     │── HTTP GET ──────> │               │
  │                     │   /shot.jpg        │               │
  │                     │ <── JPEG bytes ─── │               │
  │                     │                    │               │
  │                     │── RapidOCR local ──┐               │
  │                     │ <── biển số ───────┘               │
  │                     │                                    │
  │                     │── POST /api/hardware/entry ──────> │
  │                     │   { plate: "59A-12345" }           │
  │                     │                                    │
  │                     │     Backend: check customer + balance
  │                     │                                    │
  │                     │ <── { action: "accept" } ───────── │
  │                     │                                    │
  │                     │── Servo1: mở cổng (90°)           │
  │                     │── sleep 5s                         │
  │                     │── Servo1: đóng cổng (0°)          │
```

---

## 2. CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ | File |
|---|---|---|
| **Sensor cổng vào** | HC-SR04 Ultrasonic | `main.py` dòng 14-15 |
| **Camera** | IP Webcam (Android App) | `main.py` dòng 28, 137-144 |
| **AI nhận diện biển số** | RapidOCR (`rapidocr_onnxruntime`) — chạy LOCAL trên Pi | `main.py` dòng 8, 152-160 |
| **Servo cổng vào** | SG90/MG995 PWM 50Hz | `main.py` dòng 16, 82-83 |
| **Giao tiếp với backend** | HTTP REST (requests lib) | `main.py` dòng 189-198 |
| **Backend API** | Node.js Express + Prisma SQLite | `hardwareController.js` |

---

## 3. CODE CHI TIẾT — `source/pi-driver/main.py`

### 3.1 Cấu hình GPIO cổng vào (Dòng 13-16)

```python
TRIG_PIN_1  = int(os.getenv("SENSOR1_TRIG", 22))   # GPIO 22 — Trigger
ECHO_PIN_1  = int(os.getenv("SENSOR1_ECHO", 23))   # GPIO 23 — Echo
SERVO_PIN_1 = int(os.getenv("SERVO1_PIN",   18))   # GPIO 18 — PWM servo
```

### 3.2 Đọc sensor siêu âm — Chống rung (Dòng 116-133)

```python
def read_distance(trig, echo) -> float:
    """Đo khoảng cách bằng HC-SR04.
    Trả về -1.0 nếu lỗi (timeout hoặc ngoài ngưỡng)."""
    if not GPIO_AVAILABLE: return -1.0

    GPIO.output(trig, False); time.sleep(0.000002)
    GPIO.output(trig, True);  time.sleep(0.00001)    # Xung trigger 10μs
    GPIO.output(trig, False)

    t0 = time.time()
    while GPIO.input(echo) == 0:                     # Đợi echo HIGH
        if time.time() - t0 > ECHO_TIMEOUT: return -1.0   # Timeout 100ms

    pulse_start = time.time()
    while GPIO.input(echo) == 1:                     # Đo thời gian echo
        if time.time() - pulse_start > ECHO_TIMEOUT: return -1.0

    dist = (pulse_end - pulse_start) * 34300 / 2.0
    return round(dist, 1) if 0 < dist < 400 else -1.0
```

**Cơ chế chống rung (debounce):**
- `ECHO_TIMEOUT = 0.1s` (100ms): Nếu sensor không phản hồi → trả `-1.0`, không treo
- `0 < dist < 400`: Lọc giá trị ngoài phạm vi HC-SR04
- `COOLDOWN_SECONDS = 8`: Sau khi phát hiện xe, chờ 8 giây mới phát hiện tiếp (dòng 252)

### 3.3 Main loop — Phát hiện xe vào (Dòng 238-255)

```python
while True:
    dist_in = read_distance(TRIG_PIN_1, ECHO_PIN_1)   # Đọc sensor cổng vào
    now = time.time()

    # Xe đến cổng vào: distance < 4cm VÀ đã qua cooldown 8s
    if 0 < dist_in < DETECT_THRESHOLD:
        if now - last_entry > COOLDOWN_SECONDS:
            process_lane_with_api("CỔNG VÀO", "entry", engine,
                                  servo1_open, servo1_close)
            last_entry = time.time()

    time.sleep(0.3)   # Quét mỗi 300ms
```

### 3.4 Chụp ảnh từ IP Webcam (Dòng 137-144)

```python
def capture_image() -> bytes | None:
    try:
        resp = requests.get(IP_CAM_URL, timeout=5)   # Timeout 5 giây
        if resp.status_code == 200:
            print(f"  📸 Chụp OK! {len(resp.content):,} bytes")
            return resp.content
    except: pass
    return None        # ← Trả None nếu lỗi → main loop tiếp tục, KHÔNG crash
```

### 3.5 Nhận diện biển số — RapidOCR local (Dòng 146-160)

```python
OCR_IMG_MAX_WIDTH = 640

def resize_for_ocr(img):
    """Resize ảnh về max 640px width để tăng tốc OCR trên Pi."""
    h, w = img.shape[:2]
    if w <= OCR_IMG_MAX_WIDTH: return img
    scale = OCR_IMG_MAX_WIDTH / w
    return cv2.resize(img, (OCR_IMG_MAX_WIDTH, int(h * scale)),
                      interpolation=cv2.INTER_AREA)

def recognize_plate(engine: RapidOCR, image_bytes: bytes) -> str | None:
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None: return None
    img_small = resize_for_ocr(img)
    result, _ = engine(img_small)        # ← RapidOCR chạy local trên Pi
    if result:
        return max(result, key=lambda x: x[2])[1].strip().upper()
    return None
```

### 3.6 Gọi Backend API — Quyết định cho vào (Dòng 164-214)

```python
def process_lane_with_api(label, gate_type, camera_engine, open_func, close_func):
    time.sleep(COUNTDOWN_SECONDS)              # 1. Chờ 1s ổn định

    image = capture_image()                    # 2. Chụp ảnh
    if not image:
        print(f"  ⚠️ Lỗi Camera! {label} vẫn ĐÓNG")
        return                                 #    → Camera lỗi → KHÔNG mở

    plate = recognize_plate(camera_engine, image)  # 3. OCR local
    if not plate:
        print(f"  ❌ Không đọc được biển số → {label} VẪN ĐÓNG")
        return                                 #    → OCR lỗi → KHÔNG mở

    # 4. Gọi Backend API
    api_endpoint = f"{BACKEND_URL}/api/hardware/{gate_type}"
    res = requests.post(api_endpoint, json={"plate": plate}, timeout=10)
    data = res.json()

    if data.get("action") == "accept":         # 5. Backend chấp nhận
        open_func()                            #    → Mở servo
        time.sleep(BARRIER_OPEN_SECS)          #    → Giữ 5 giây
        close_func()                           #    → Đóng servo
    else:
        reason = data.get("reason")
        print(f"  ❌ TỪ CHỐI ({reason}) → {label} VẪN ĐÓNG")
```

### 3.7 Servo cổng vào (Dòng 72-83)

```python
def angle_to_duty(angle: int) -> float:
    return 2.0 + (angle / 180.0) * 10.0        # 0°→2%, 180°→12%

def servo_set(servo_obj, angle: int):
    if not GPIO_AVAILABLE or servo_obj is None: return
    servo_obj.ChangeDutyCycle(angle_to_duty(angle))
    time.sleep(0.5)                             # Chờ servo di chuyển
    servo_obj.ChangeDutyCycle(0)                # Tắt PWM giảm rung

def servo1_open():  servo_set(servo1_pwm, SERVO_OPEN_ANGLE)   # 90°
def servo1_close(): servo_set(servo1_pwm, SERVO_CLOSE_ANGLE)  # 0°
```

---

## 4. CODE CHI TIẾT — Backend `source/backend/controllers/hardwareController.js`

### 4.1 handleEntry — Nhận biển số từ Python, kiểm tra & trả kết quả (Dòng 109-148)

```javascript
export const handleEntry = async (req, res) => {
    const plate = req.body.plate?.toUpperCase().replace(/\s+/g, "");

    // 1. Emit scanning event → Dashboard hiển thị đang quét
    io?.emit("lpr:scanning", { gate: "entry", plate });

    // 2. Tìm khách hàng theo biển số
    const customer = await prisma.customer.findFirst({ where: { vehiclePlate: plate } });
    if (!customer)
        return res.json({ action: "deny", reason: "Xe chưa đăng ký ví điện tử" });

    // 3. Kiểm tra số dư tối thiểu (5000đ)
    if (customer.balance < 5000)
        return res.json({ action: "deny", reason: "Ví không đủ số dư (Cần >= 5000đ)" });

    // 4. Ghi log + tạo vé ảo
    await prisma.log.create({ data: { vehiclePlate: plate, action: "entry", status: "accepted", entryTime } });
    await prisma.parkingSlot.upsert({
        where: { slotNumber: "v_" + plate },
        update: { status: "occupied", vehiclePlate: plate, entryTime },
        create: { slotNumber: "v_" + plate, status: "occupied", vehiclePlate: plate, entryTime }
    });

    // 5. Emit kết quả → Dashboard + Trả response cho Python
    io?.emit("lpr:result", { action: "accept", plate, name: customer.name, balance: customer.balance, gate: "entry" });
    res.json({ action: "accept", message: "Mời vào", balance: customer.balance });
};
```

**Phân vai rõ ràng:**
- Python quyết định MỞ/ĐÓNG cổng dựa trên `action` trả về
- Backend chỉ kiểm tra DB và trả kết quả, KHÔNG điều khiển phần cứng

---

## 5. CẤU HÌNH MÔI TRƯỜNG (`source/pi-driver/.env.example`)

```env
SENSOR1_TRIG=22           # GPIO pin TRIG (mặc định 22)
SENSOR1_ECHO=23           # GPIO pin ECHO (cần voltage divider 5V→3.3V)
SERVO1_PIN=18             # GPIO PWM servo cổng vào

IP_CAM_URL=http://192.168.34.114:8080/shot.jpg
BACKEND_URL=http://localhost:3000

ENTRY_THRESHOLD=4.0       # Khoảng cách phát hiện xe (cm)
SERVO_OPEN_ANGLE=90       # Góc mở servo
SERVO_CLOSE_ANGLE=0       # Góc đóng servo
```

---

## 6. LƯU ĐỒ XỬ LÝ LỖI

```
Sensor1 đọc khoảng cách
       │
       ▼
  0 < distance < 4cm ? ──NO──> Tiếp tục quét (300ms)
       │ YES
       ▼
  Cooldown 8s OK? ──NO──> Bỏ qua (tránh trigger trùng)
       │ YES
       ▼
  Chờ 1s ổn định
       │
       ▼
  Chụp ảnh IP Webcam (timeout 5s)
       │
       ▼
  Thành công? ──NO──> "Lỗi Camera!" → KHÔNG mở cổng
       │ YES
       ▼
  RapidOCR nhận diện biển số (local trên Pi)
       │
       ▼
  Đọc được? ──NO──> "Không đọc được" → KHÔNG mở cổng
       │ YES
       ▼
  POST /api/hardware/entry { plate }
       │
       ▼
  Backend: customer tồn tại? ──NO──> deny "Xe chưa đăng ký"
       │ YES
       ▼
  Backend: balance >= 5000đ? ──NO──> deny "Ví không đủ"
       │ YES
       ▼
  ✅ Backend trả { action: "accept" }
  ✅ Python mở servo1 (90°)
  ✅ Giữ 5 giây
  ✅ Python đóng servo1 (0°)
```

---

## 7. CHECKLIST PHẦN CỨNG

- [ ] HC-SR04: TRIG=GPIO22, ECHO=GPIO23, **voltage divider** trên ECHO
- [ ] Servo SG90: GPIO18 (PWM)
- [ ] IP Webcam app cài trên Android, cùng WiFi với Pi
- [ ] `OPENBLAS_CORETYPE=ARMV8` (đã set tự động trong main.py dòng 2)
