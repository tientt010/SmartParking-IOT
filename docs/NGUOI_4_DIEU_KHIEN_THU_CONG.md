# 📙 TÀI LIỆU NGƯỜI 4 — ĐIỀU KHIỂN THỦ CÔNG & GIAO TIẾP THIẾT BỊ

> **Chức năng chính**: Lệnh mở/đóng cổng từ dashboard admin.  
> **Phần vi xử lý bắt buộc**: Giao thức lệnh giữa server và thiết bị, xử lý bất đồng bộ giữa lệnh admin và trạng thái vật lý.

---

## 1. TỔNG QUAN

### 1.1 Giao thức: HTTP Polling (không MQTT)

```
Dashboard Admin              Backend API                 Python main.py
     │                          │                              │
     │── POST /device/control ─>│                              │
     │   { action:"Open",       │── Queue lệnh ──┐            │
     │     gateId:"gate1" }     │                 │            │
     │                          │                 ▼            │
     │   ← { success }         │   pendingCommands[]          │
     │                          │                              │
     │                          │                              │── GET /device/gate-commands
     │                          │                              │   (mỗi 2 giây)
     │                          │ <─────────────────────────── │
     │                          │── { commands: [...] } ─────> │
     │                          │                              │
     │                          │                              │── servo_open()
     │                          │                              │── sleep(5s)
     │                          │                              │── servo_close()
```

**Tại sao dùng HTTP Polling thay vì MQTT?**
- Kiến trúc đơn giản: Python chỉ cần `requests` lib
- Không cần Mosquitto broker
- main.py tự poll mỗi 2 giây → đủ nhanh cho lệnh thủ công

---

## 2. CODE CHI TIẾT — Backend `source/backend/controllers/deviceController.js`

### 2.1 Command Queue — In-memory (Dòng 3-9)

```javascript
// Trạng thái cổng (in-memory, không lưu DB)
const gateStatus = {
    gate1: { status: "closed", lastUpdate: null },
    gate2: { status: "closed", lastUpdate: null },
};

const pendingCommands = [];   // ← Queue lệnh chờ Pi poll
```

### 2.2 Admin gửi lệnh — `POST /api/device/control` (Dòng 11-39)

```javascript
export const controlDevice = async (req, res) => {
    const { action, gateId } = req.body;
    // action: "Open" hoặc "Close"
    // gateId: "gate1" hoặc "gate2"

    // 1. Push vào queue
    pendingCommands.push({
        gate: gateId,
        action: action.toLowerCase(),    // "open" hoặc "close"
        ts: Date.now(),                  // timestamp để lọc lệnh cũ
    });
    if (pendingCommands.length > 10) pendingCommands.shift();  // Max 10 lệnh

    // 2. Cập nhật gateStatus + Emit Socket.IO
    const newStatus = action === "Open" ? "open" : "closed";
    gateStatus[gate] = { status: newStatus, lastUpdate: new Date() };
    io?.emit("gate:status", { gateId: gate, status: newStatus, ... });
    io?.emit("gate:command", { gate, action: action.toLowerCase() });

    res.json({ message: "success", action, gateId: gate });
};
```

### 2.3 Python poll lệnh — `GET /api/device/gate-commands` (Dòng 42-48)

```javascript
export const getGateCommands = async (req, res) => {
    const now = Date.now();
    const recent = pendingCommands.filter(c => now - c.ts < 5000);
    //                                              ↑ Chỉ lấy lệnh trong 5 giây gần nhất
    pendingCommands.splice(0, pendingCommands.length);   // ← Clear queue sau khi poll
    res.json({ commands: recent });
};
```

**Cơ chế chống bất đồng bộ:**
1. `ts: Date.now()` → mỗi lệnh có timestamp
2. `now - c.ts < 5000` → lệnh cũ hơn 5s bị bỏ (xe có thể đã ra khỏi vùng)
3. `splice()` → clear queue sau mỗi poll (Pi đã nhận rồi, không lặp lại)

---

## 3. CODE CHI TIẾT — Python `source/pi-driver/main.py`

### 3.1 Poll lệnh thủ công (Dòng 88-112)

```python
def poll_gate_commands():
    try:
        r = requests.get(f"{BACKEND_URL}/api/device/gate-commands", timeout=1)
        cmds = r.json().get("commands", [])
        for cmd in cmds:
            gate   = cmd.get("gate")     # "gate1" hoặc "gate2"
            action = cmd.get("action")   # "open" hoặc "close"
            
            print(f"\n  [ADMIN] Lệnh thủ công: {action.upper()} {gate}")
            
            if gate == "gate1":
                if action == "open":
                    servo1_open()
                    time.sleep(BARRIER_OPEN_SECS)   # Giữ 5s
                    servo1_close()
                else:
                    servo1_close()
            elif gate == "gate2":
                if action == "open":
                    servo2_open()
                    time.sleep(BARRIER_OPEN_SECS)
                    servo2_close()
                else:
                    servo2_close()
    except Exception:
        pass   # Backend offline → không crash
```

### 3.2 Tích hợp vào main loop (Dòng 279-281)

```python
# Poll lệnh thủ công mỗi 2 giây
if now - last_cmd_poll > 2.0:
    poll_gate_commands()
    last_cmd_poll = now
```

---

## 4. FRONTEND — Nút điều khiển

### 4.1 Giao diện admin — DashboardPage hoặc DevicesPage

```jsx
const handleGateControl = async (gateId, action) => {
    await api.post("/device/control", { gateId, action });
    // Backend emit socket → UI tự cập nhật trạng thái
};

// Nút mở/đóng:
<button onClick={() => handleGateControl("gate1", "Open")}>🔓 Mở cổng vào</button>
<button onClick={() => handleGateControl("gate1", "Close")}>🔒 Đóng cổng vào</button>
<button onClick={() => handleGateControl("gate2", "Open")}>🔓 Mở cổng ra</button>
<button onClick={() => handleGateControl("gate2", "Close")}>🔒 Đóng cổng ra</button>
```

### 4.2 Socket.IO listener — Hiển thị trạng thái realtime

```jsx
socket.on("gate:status", ({ gateId, status }) => {
    // Cập nhật UI: "gate1" → "open"/"closed"
});
```

---

## 5. LƯU ĐỒ XỬ LÝ

```
Admin bấm "Mở cổng vào"
       │
       ▼
POST /api/device/control
{ action: "Open", gateId: "gate1" }
       │
       ▼
Backend:
  1. Push vào pendingCommands[]
  2. gateStatus = "open"
  3. Socket.IO emit → Dashboard cập nhật
       │
       ▼
Python main.py (mỗi 2s):
GET /api/device/gate-commands
       │
       ▼
Nhận { commands: [{ gate:"gate1", action:"open" }] }
       │
       ▼
  servo1_open()   → Servo quay 90°
  sleep(5s)       → Giữ mở
  servo1_close()  → Servo quay 0°
```

---

## 6. API ENDPOINTS

| Method | Endpoint | Auth | Ai gọi | Mô tả |
|---|---|---|---|---|
| `POST` | `/api/device/control` | ✅ JWT | Admin Dashboard | Gửi lệnh mở/đóng |
| `GET` | `/api/device/gate-commands` | ❌ | Python `main.py` (mỗi 2s) | Poll lệnh |
| `GET` | `/api/device/gate-status` | ✅ JWT | Admin Dashboard | Xem trạng thái |

> ⚠️ `/api/device/gate-commands` không cần auth vì chỉ chạy trên localhost (Pi). Nhưng cần bảo mật nếu expose ra network.

---

## 7. CHECKLIST

- [ ] Admin login hoạt động (JWT)
- [ ] Nút mở/đóng trên Dashboard hoạt động
- [ ] Python poll thành công (log: `[ADMIN] Lệnh thủ công: OPEN gate1`)
- [ ] Servo phản hồi đúng gate
