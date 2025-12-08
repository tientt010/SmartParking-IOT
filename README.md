# SmartParking IoT

Hệ thống quản lý bãi đỗ xe thông minh sử dụng IoT, nhận diện biển số tự động và giám sát thời gian thực.

## Tổng quan

SmartParking là giải pháp quản lý bãi xe tích hợp:
- **Nhận diện biển số (LPR)** tự động bằng AI
- **Cảm biến siêu âm** phát hiện xe tại từng slot
- **Điều khiển barrier** tự động/thủ công
- **Dashboard giám sát** thời gian thực

## Kiến trúc hệ thống

```
┌─────────────┐     MQTT      ┌─────────────┐     HTTP      ┌─────────────┐
│   ESP32 +   │ ───────────▶  │   Backend   │ ◀──────────▶  │  Frontend   │
│  ESP32-CAM  │ ◀───────────  │  (Node.js)  │               │   (React)   │
└─────────────┘               └──────┬──────┘               └─────────────┘
                                     │
                              ┌──────▼──────┐
                              │ AI Service  │
                              │  (Python)   │
                              └─────────────┘
```

## Cấu trúc thư mục

```
source/
├── backend/          # API server (Express + MongoDB + MQTT)
├── frontend/         # Web dashboard (React + Vite + Tailwind)
├── ai-service/       # Nhận diện biển số (Flask + EasyOCR)
└── firmware/         # Code ESP32 (Arduino)
```

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Backend | Node.js, Express, MongoDB, Socket.IO, MQTT |
| Frontend | React 19, Vite, Tailwind CSS, Zustand |
| AI Service | Python, Flask, EasyOCR |
| Hardware | ESP32, ESP32-CAM, Cảm biến siêu âm HC-SR04, Servo |

## Tính năng chính

**Quản lý xe ra/vào**
- Nhận diện biển số tự động khi xe đến cổng
- Kiểm tra whitelist và mở barrier tự động
- Ghi log chi tiết với ảnh biển số

**Quản lý slot**
- Theo dõi trạng thái từng slot (trống/có xe)
- Cảm biến siêu âm đo khoảng cách
- Cấu hình threshold cho từng sensor

**Dashboard**
- Thống kê xe vào/ra theo ngày/tuần/tháng
- Cảnh báo xe không hợp lệ
- Điều khiển barrier thủ công
- Cập nhật real-time qua WebSocket

**Quản lý hệ thống**
- Whitelist biển số được phép
- Cấu hình sensor threshold
- Quản lý người dùng (admin)

## Cài đặt

### Yêu cầu
- Node.js >= 18
- Python >= 3.12
- MongoDB
- MQTT Broker

### Backend
```bash
cd source/backend
npm install
cp .env.example .env  # Cấu hình environment
npm run dev
```

### Frontend
```bash
cd source/frontend
npm install
npm run dev
```

### AI Service
```bash
cd source/ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Cấu hình

### Backend (.env)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/smartparking
JWT_SECRET=your-secret-key
MQTT_URL=mqtt://localhost:1883
AI_SERVICE_URL=http://localhost:5001
```

### MQTT Topics

| Topic | Mô tả |
|-------|-------|
| `esp32/parking/sensor` | Data từ cảm biến |
| `esp32/parking/entry` | Sự kiện xe vào |
| `esp32/parking/exit` | Sự kiện xe ra |
| `esp32/parking/gate1/control` | Điều khiển barrier |

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/slots` | Danh sách slot |
| GET | `/api/logs` | Nhật ký ra/vào |
| GET/POST | `/api/whitelist` | Quản lý whitelist |
| GET | `/api/stats` | Thống kê |
| POST | `/api/device/control` | Điều khiển barrier |
| GET/PUT | `/api/hardware/sensor/:id` | Cấu hình sensor |

## Đóng góp

1. Fork repository
2. Tạo branch mới (`git checkout -b feature/TenTinhNang`)
3. Commit changes (`git commit -m 'Thêm tính năng X'`)
4. Push branch (`git push origin feature/TenTinhNang`)
5. Tạo Pull Request

## License

MIT License
