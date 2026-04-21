# 📕 TÀI LIỆU NGƯỜI 2 — LUỒNG XE RA & THANH TOÁN

> **Chức năng chính**: Tính phí, xác nhận thanh toán, cho xe ra.  
> **Phần vi xử lý bắt buộc**: Điều khiển servo cổng ra, logic mở-đóng an toàn, chống mở nhầm khi xe chưa đủ điều kiện.

---

## 1. TỔNG QUAN LUỒNG XE RA

### 1.1 Sơ đồ luồng

```
Sensor2 (HC-SR04)     main.py            IP Webcam       Backend API
  │                     │                    │               │
  │── < 4cm ──────────> │                    │               │
  │  (xe đến cổng ra)   │                    │               │
  │                     │── HTTP GET ──────> │               │
  │                     │ <── JPEG bytes ─── │               │
  │                     │                    │               │
  │                     │── RapidOCR local ──┐               │
  │                     │ <── biển số ───────┘               │
  │                     │                                    │
  │                     │── POST /api/hardware/exit ───────> │
  │                     │   { plate: "59A-12345" }           │
  │                     │                                    │
  │                     │     Backend: tính phí + trừ ví     │
  │                     │                                    │
  │                     │ <── { action: "accept", fee: 5 } ─ │
  │                     │                                    │
  │                     │── Servo2: mở cổng (90°)           │
  │                     │── sleep 5s                         │
  │                     │── Servo2: đóng cổng (0°)          │
```

> 💡 **Điểm mạnh**: Cổng ra chỉ mở SAU KHI backend xác nhận thanh toán thành công → **chống mở nhầm khi xe chưa đủ điều kiện**.

---

## 2. CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ | File |
|---|---|---|
| **Sensor cổng ra** | HC-SR04 | `main.py` dòng 18-19 |
| **Servo cổng ra** | SG90/MG995 GPIO17 | `main.py` dòng 20, 84-85 |
| **AI** | RapidOCR local | `main.py` dòng 152-160 |
| **Tính phí** | Node.js + Prisma | `hardwareController.js` dòng 150-211 |
| **Thanh toán ví** | Prisma Transaction | `customerController.js` |

---

## 3. CODE CHI TIẾT — `source/pi-driver/main.py`

### 3.1 Cấu hình GPIO cổng ra (Dòng 18-20)

```python
TRIG_PIN_2  = int(os.getenv("SENSOR2_TRIG", 25))   # GPIO 25
ECHO_PIN_2  = int(os.getenv("SENSOR2_ECHO", 8))    # GPIO 8
SERVO_PIN_2 = int(os.getenv("SERVO2_PIN",   17))   # GPIO 17
```

### 3.2 Phát hiện xe tại cổng ra (Dòng 257-262)

```python
# Trong main loop — XE RA dùng CÙNG logic với xe vào:
elif 0 < dist_out < DETECT_THRESHOLD:
    if now - last_exit > COOLDOWN_SECONDS:       # Cooldown 8s
        process_lane_with_api("CỔNG RA", "exit", engine,
                              servo2_open, servo2_close)
        last_exit = time.time()
```

### 3.3 Chống mở nhầm — Logic an toàn

Cổng ra **KHÔNG BAO GIỜ mở** nếu chưa qua đủ kiểm tra:

```
1. Sensor timeout/lỗi    → return -1.0 → không trigger
2. Camera offline         → return None → print lỗi, return (không mở)
3. OCR không đọc được     → return None → print lỗi, return (không mở)
4. Backend trả "deny"     → if action != "accept" → print lỗi (không mở)
5. Backend trả "accept"   → MỞ servo → giữ 5s → ĐÓNG servo
```

### 3.4 Servo cổng ra (Dòng 84-85)

```python
def servo2_open():  servo_set(servo2_pwm, SERVO_OPEN_ANGLE)   # 90°
def servo2_close(): servo_set(servo2_pwm, SERVO_CLOSE_ANGLE)  # 0°
```

**Cơ chế an toàn servo:**
- `ChangeDutyCycle(0)` sau khi di chuyển: Tắt PWM giảm rung
- `time.sleep(0.5)`: Chờ servo đến vị trí trước khi tắt
- Cooldown 8s: Không trigger liên tục

---

## 4. CODE CHI TIẾT — Backend `source/backend/controllers/hardwareController.js`

### 4.1 handleExit — Tính phí & trừ ví (Dòng 150-211)

```javascript
export const handleExit = async (req, res) => {
    const plate = req.body.plate?.toUpperCase().replace(/\s+/g, "");

    // 1. Tìm khách hàng
    const customer = await prisma.customer.findFirst({ where: { vehiclePlate: plate } });
    if (!customer)
        return res.json({ action: "deny", reason: "Xe chưa đăng ký" });

    // 2. Tìm bản ghi vào bãi (lấy entryTime)
    const slot = await prisma.parkingSlot.findFirst({
        where: { vehiclePlate: plate, status: "occupied" }
    });
    const entryTime = slot?.entryTime || new Date(Date.now() - 60000);

    // 3. TÍNH PHÍ (demo: 0.1 đồng/giây)
    const RATE_PER_SECOND = 0.1;
    const seconds = (Date.now() - new Date(entryTime).getTime()) / 1000;
    const fee = Math.max(1, Math.round(seconds * RATE_PER_SECOND));

    // 4. KIỂM TRA SỐ DƯ → Chống mở nhầm
    if (customer.balance < fee) {
        return res.json({ action: "deny", reason: `Số dư không đủ. Cần: ${fee}đ` });
        //                ↑ Python nhận "deny" → KHÔNG mở cổng
    }

    // 5. TRỪ TIỀN
    const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: { balance: { decrement: fee } }
    });

    // 6. GHI TRANSACTION
    await prisma.transaction.create({
        data: { customerId: customer.id, type: "payment", amount: fee,
                description: `Thanh toán – Xe ${plate} (${durationSec}s demo)` }
    });

    // 7. Cập nhật slot + Log
    if (slot) await prisma.parkingSlot.update({
        where: { id: slot.id }, data: { status: "empty", exitTime: new Date() }
    });
    await prisma.log.create({ data: { vehiclePlate: plate, action: "exit", status: "accepted", exitTime: new Date() } });

    // 8. Emit realtime + Trả response
    io?.emit("lpr:result", { action: "accept", plate, fee, balanceAfter: updated.balance, gate: "exit" });
    res.json({ action: "accept", fee, durationSec, balanceAfter: updated.balance });
    //         ↑ Python nhận "accept" → MỞ cổng
};
```

### 4.2 Customer Controller — Thanh toán từ app (`source/backend/controllers/customerController.js`)

```javascript
// POST /api/customer/pay — Khách thanh toán trước từ app
export const payFromWallet = async (req, res) => {
    const plate = req.body.vehiclePlate;
    const slot = await prisma.parkingSlot.findFirst({ where: { vehiclePlate: plate, status: "occupied" } });

    const RATE_PER_HOUR = 5000;
    const hours = (Date.now() - new Date(slot.entryTime).getTime()) / 3600000;
    const fee = Math.max(1, Math.ceil(hours)) * RATE_PER_HOUR;

    if (customer.balance < fee)
        return res.status(400).json({ message: "Số dư không đủ" });

    await prisma.customer.update({ where: { id: req.customer.id }, data: { balance: { decrement: fee } } });
    res.json({ success: true, fee, balanceAfter: updated.balance });
};
```

---

## 5. DATABASE SCHEMA LIÊN QUAN

```prisma
model Transaction {
  id          Int      @id @default(autoincrement())
  customerId  Int
  customer    Customer @relation(fields: [customerId], references: [id])
  type        String    // "topup" | "payment"
  amount      Float
  description String?
  createdAt   DateTime @default(now())
}

model ParkingSlot {
  id           Int       @id @default(autoincrement())
  slotNumber   String    @unique        // "v_59A12345" (vé ảo) hoặc "slot1"
  status       String    @default("empty")
  vehiclePlate String?
  entryTime    DateTime?                // ← Dùng để tính phí
  exitTime     DateTime?
}
```

---

## 6. API ENDPOINTS

| Method | Endpoint | Ai gọi | Mô tả |
|---|---|---|---|
| `POST` | `/api/hardware/exit` | Python `main.py` | Tính phí + trừ ví + trả accept/deny |
| `POST` | `/api/customer/pay` | Customer app | Thanh toán trước từ ví |
| `GET` | `/api/customer/vehicle` | Customer app | Tra cứu xe + phí tạm tính |

---

## 7. LƯU ĐỒ XỬ LÝ

```
Sensor2 đọc < 4cm
       │
       ▼
  Cooldown 8s OK? ──NO──> Bỏ qua
       │ YES
       ▼
  Chụp ảnh + OCR → biển số
       │
       ▼
  POST /api/hardware/exit { plate }
       │
       ▼
  Customer tồn tại? ──NO──> deny → KHÔNG mở
       │ YES
       ▼
  Tính phí (entryTime → now)
       │
       ▼
  Balance >= fee? ──NO──> deny "Số dư không đủ" → KHÔNG mở ✅
       │ YES
       ▼
  Trừ ví + ghi Transaction
       │
       ▼
  ✅ Trả { action: "accept", fee }
  ✅ Python mở servo2 (90°) → 5s → đóng (0°)
```

---

## 8. CHECKLIST PHẦN CỨNG

- [ ] HC-SR04: TRIG=GPIO25, ECHO=GPIO8, **voltage divider** trên ECHO
- [ ] Servo SG90: GPIO17
- [ ] Test servo quay đúng: 0° (đóng) ↔ 90° (mở)
