# 📓 TÀI LIỆU NGƯỜI 5 — ĐỘ ỔN ĐỊNH HỆ THỐNG

> **Chức năng chính**: Giám sát, khởi động, cấu hình, triển khai production.  
> **Phần vi xử lý bắt buộc**: Auto-recovery khi crash, graceful shutdown, environment setup.

---

## 1. KIẾN TRÚC VẬN HÀNH

### 1.1 Khởi động hệ thống (2 lệnh duy nhất)

```bash
# SSH vào Raspberry Pi 4:
ssh viethuy@192.168.34.107

# Terminal 1: Khởi động backend (DB + API + Dashboard)
cd /home/viethuy/smartparking/source/backend
npm run dev
# → Chạy: node --watch server.js (port 3000)

# Terminal 2: Khởi động main driver (Sensor + AI + Servo)
cd /home/viethuy/smartparking/source/pi-driver
python main.py
# → Khởi tạo RapidOCR → Đóng cả 2 cổng → Bắt đầu quét sensor
```

### 1.2 Kiến trúc 2 process

```
┌────────────────────────────────────────────────────────────────┐
│                      RASPBERRY PI 4                            │
│                                                                │
│  Terminal 1:                     Terminal 2:                    │
│  ┌────────────────────┐         ┌────────────────────┐        │
│  │  npm run dev       │         │  python main.py    │        │
│  │  (Node.js backend) │  HTTP   │  (Pi driver)       │        │
│  │                    │◄───────►│                    │        │
│  │  • Express :3000   │  REST   │  • GPIO sensors    │        │
│  │  • Prisma/SQLite   │         │  • RapidOCR AI     │        │
│  │  • Socket.IO       │         │  • Servo control   │        │
│  │  • Serve frontend  │         │  • Camera capture  │        │
│  └────────────────────┘         └────────────────────┘        │
│                                                                │
│  KHÔNG SỬ DỤNG:                                               │
│  ❌ PM2 (chạy trực tiếp thủ công)                              │
│  ❌ MQTT / Mosquitto                                           │
│  ❌ Flask AI Service (RapidOCR chạy local trong main.py)       │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. GRACEFUL SHUTDOWN — `main.py` (Dòng 294-303)

```python
try:
    while True:
        # ... main loop ...
        time.sleep(0.3)
except KeyboardInterrupt:
    print("\n\n[!] TẮT HỆ THỐNG.")
finally:
    servo1_close()                # Đóng cổng vào an toàn
    servo2_close()                # Đóng cổng ra an toàn
    if GPIO_AVAILABLE:
        if servo1_pwm: servo1_pwm.stop()     # Tắt PWM
        if servo2_pwm: servo2_pwm.stop()
        GPIO.cleanup()                        # Giải phóng GPIO pins
        print("[GPIO] Cleanup done.")
```

**Đảm bảo khi tắt:**
- Cả 2 cổng ĐÓNG (servo về 0°)
- PWM tắt hoàn toàn
- GPIO pins được giải phóng (`GPIO.cleanup()`)
- Nhấn `Ctrl+C` bất kỳ lúc nào đều an toàn

---

## 3. AUTO-RECOVERY & ERROR HANDLING

### 3.1 Camera offline — Không crash (Dòng 137-144)

```python
def capture_image() -> bytes | None:
    try:
        resp = requests.get(IP_CAM_URL, timeout=5)
        return resp.content if resp.status_code == 200 else None
    except: pass
    return None   # ← Camera lỗi → trả None → main loop tiếp tục
```

### 3.2 Backend offline — Không crash

```python
# Sensor push: timeout 1s, except pass
try:
    requests.post(f"{BACKEND_URL}/api/hardware/sensor", json={...}, timeout=1)
except Exception: pass

# Gate commands poll: except pass
def poll_gate_commands():
    try:
        r = requests.get(f"{BACKEND_URL}/api/device/gate-commands", timeout=1)
        # ...
    except Exception: pass
```

### 3.3 GPIO không có — Chế độ mô phỏng (Dòng 45-69)

```python
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("[GPIO] Không tìm thấy RPi.GPIO — chạy MÔ PHỎNG")

# Tất cả hàm GPIO đều check:
def read_distance(trig, echo):
    if not GPIO_AVAILABLE: return -1.0    # Trả -1 thay vì crash

def servo_set(servo_obj, angle):
    if not GPIO_AVAILABLE or servo_obj is None: return
```

---

## 4. BACKEND HEALTH — `source/backend/server.js`

### 4.1 Health endpoint (Dòng 33-35)

```javascript
app.get("/health", (req, res) =>
    res.json({ status: "ok", service: "smartparking-pi-backend", uptime: process.uptime() })
);
```

Kiểm tra: `curl http://localhost:3000/health`

### 4.2 Auto-restart backend (dev mode)

```json
// package.json
"scripts": {
    "dev": "node --watch server.js"    // ← --watch: tự restart khi file thay đổi
}
```

---

## 5. CẤU HÌNH MÔI TRƯỜNG

### 5.1 Pi-Driver `.env` (`source/pi-driver/.env.example`)

```env
# Sensor GPIO pins
SENSOR1_TRIG=22
SENSOR1_ECHO=23
SENSOR2_TRIG=25
SENSOR2_ECHO=8
SENSOR3_TRIG=12
SENSOR3_ECHO=16
SENSOR4_TRIG=20
SENSOR4_ECHO=21

# Servo GPIO pins
SERVO1_PIN=18
SERVO2_PIN=17

# Servo angles
SERVO_OPEN_ANGLE=90
SERVO_CLOSE_ANGLE=0

# Camera
IP_CAM_URL=http://192.168.34.114:8080/shot.jpg

# Backend
BACKEND_URL=http://localhost:3000

# Detection
ENTRY_THRESHOLD=4.0
```

### 5.2 Backend `.env` (`source/backend/.env.example`)

```env
PORT=3000
JWT_SECRET=smartparking-secret-key
DATABASE_URL="file:./prisma/dev.db"
```

### 5.3 Biến môi trường đặc biệt (main.py dòng 1-2)

```python
import os
os.environ["OPENBLAS_CORETYPE"] = "ARMV8"   # ← Bắt buộc cho RapidOCR trên ARM
```

---

## 6. SETUP TỪ ĐẦU TRÊN PI MỚI

```bash
# 1. Cài system packages
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv nodejs npm

# 2. Clone project
git clone <repo> /home/viethuy/smartparking
cd /home/viethuy/smartparking

# 3. Backend setup
cd source/backend
npm install
npx prisma db push         # Tạo SQLite database
node seeds.js               # Seed admin user + sample data

# 4. Frontend build (chạy 1 lần)
cd ../frontend
npm install
npm run build               # → dist/ folder → backend serve static

# 5. Pi-Driver setup
cd ../pi-driver
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# requirements.txt chứa:
#   rapidocr_onnxruntime    ← AI OCR engine
#   opencv-python-headless  ← Image processing
#   numpy
#   requests
#   python-dotenv
#   RPi.GPIO                ← GPIO control

# 6. Copy .env files
cp source/pi-driver/.env.example source/pi-driver/.env
cp source/backend/.env.example source/backend/.env
# → Chỉnh sửa IP camera, GPIO pins theo thực tế

# 7. Khởi động
# Terminal 1:
cd source/backend && npm run dev
# Terminal 2:
cd source/pi-driver && source venv/bin/activate && python main.py
```

---

## 7. TROUBLESHOOTING

### 7.1 Backend không start

```bash
# Kiểm tra port đã bị chiếm chưa
lsof -i :3000

# Prisma chưa push
cd source/backend && npx prisma db push

# Module thiếu
npm install
```

### 7.2 main.py lỗi GPIO

```bash
# Kiểm tra quyền
ls -la /dev/gpiomem
# Cần: crw-rw---- 1 root gpio

# Thêm user vào group gpio
sudo usermod -aG gpio $(whoami)

# Nếu "No access to /dev/mem"
sudo chmod 666 /dev/gpiomem
```

### 7.3 RapidOCR lỗi trên ARM

```bash
# OPENBLAS_CORETYPE phải là ARMV8
# Đã được set tự động trong main.py dòng 2
# Nếu vẫn lỗi:
export OPENBLAS_CORETYPE=ARMV8
python main.py
```

### 7.4 Camera timeout

```bash
# Test camera URL
curl -o test.jpg http://192.168.34.114:8080/shot.jpg

# Kiểm tra:
# 1. IP Webcam app đang chạy?
# 2. Cùng mạng WiFi với Pi?
# 3. IP đúng? (xem trong IP Webcam app)
```

### 7.5 Database bị lock (SQLite)

```bash
# Restart backend
# Ctrl+C → npm run dev

# Nếu vẫn lỗi, xóa lock file
rm -f source/backend/prisma/*.db-journal
```

---

## 8. CẤU TRÚC THƯ MỤC SAU DỌN DẸP

```
source/
├── backend/               # Node.js — DB + API + Dashboard
│   ├── controllers/       # 10 controllers (đã xóa lprController, exitController)
│   ├── routes/            # 11 route files
│   ├── prisma/            # Schema + SQLite DB
│   ├── config/            # Prisma client
│   ├── middleware/        # JWT auth
│   ├── server.js          # Entry point (đã xóa MQTT import)
│   ├── seeds.js
│   └── package.json       # (đã xóa mqtt, multer, form-data deps)
│
├── pi-driver/             # Python — Xử lý chính
│   ├── main.py            # Entry point duy nhất
│   ├── requirements.txt
│   └── .env.example
│
├── ai-service/            # Flask EasyOCR (KHÔNG SỬ DỤNG — giữ tham khảo)
│   ├── app.py
│   └── requirements.txt
│
└── frontend/              # React Dashboard
    ├── src/
    └── dist/              # Build output → backend serve
```

---

## 9. CHECKLIST TRIỂN KHAI

### Trước khi chạy
- [ ] `.env` files đã cấu hình đúng
- [ ] `npx prisma db push` đã chạy
- [ ] `npm run build` cho frontend đã chạy
- [ ] IP Webcam app đang chạy trên Android
- [ ] Raspberry Pi kết nối cùng WiFi với điện thoại

### Kiểm tra hoạt động
- [ ] `curl http://localhost:3000/health` → `{ "status": "ok" }`
- [ ] Dashboard web truy cập được: `http://<PI_IP>:3000`
- [ ] Terminal main.py in sensor data liên tục
- [ ] Đặt vật trước sensor → cổng mở + đóng tự động
- [ ] Dashboard hiển thị trạng thái ô đỗ realtime
- [ ] Nút mở/đóng cổng trên admin dashboard hoạt động
