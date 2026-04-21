import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

# ── Config ───────────────────────────────────────────────
TRIG_PIN     = int(os.getenv("SENSOR1_TRIG",  22))
ECHO_PIN     = int(os.getenv("SENSOR1_ECHO",  23))
SERVO_PIN    = int(os.getenv("SERVO1_PIN",    18))
IP_CAM_URL   = os.getenv("IP_CAM_URL",   "http://192.168.34.114:8080/shot.jpg")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:5001")

# Ngưỡng phát hiện xe (cm) — dưới ngưỡng này tính là có xe
DETECT_THRESHOLD = float(os.getenv("ENTRY_THRESHOLD", 4.0))

# ── DANH SÁCH BIỂN SỐ ĐƯỢC PHÉP VÀO ────────────────────
ALLOWED_PLATES = ["AB-42"]   # <-- thêm biển số vào đây

# Thời gian đếm ngược trước khi chụp (giây)
COUNTDOWN_SECONDS = 3

# Thời gian mở barrier sau khi nhận diện (giây)
BARRIER_OPEN_SECONDS = 5

# Thời gian cooldown giữa 2 lần phát hiện
COOLDOWN_SECONDS = 8

# Góc servo
SERVO_OPEN_ANGLE  = int(os.getenv("SERVO_OPEN_ANGLE",  90))
SERVO_CLOSE_ANGLE = int(os.getenv("SERVO_CLOSE_ANGLE",  0))

# Timeout đọc cảm biến (giây) — 100ms là đủ cho HC-SR04
ECHO_TIMEOUT = 0.1

# ── GPIO + Servo Setup ───────────────────────────────────
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

servo_pwm = None

if GPIO_AVAILABLE:
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    # Sensor
    GPIO.setup(TRIG_PIN, GPIO.OUT)
    GPIO.setup(ECHO_PIN, GPIO.IN)
    GPIO.output(TRIG_PIN, False)

    # Servo PWM 50Hz
    GPIO.setup(SERVO_PIN, GPIO.OUT)
    servo_pwm = GPIO.PWM(SERVO_PIN, 50)
    servo_pwm.start(0)

    time.sleep(0.5)  # ổn định sensor
    print(f"[GPIO] Sensor : TRIG=GPIO{TRIG_PIN}, ECHO=GPIO{ECHO_PIN}")
    print(f"[GPIO] Servo  : GPIO{SERVO_PIN} (PWM 50Hz)")
else:
    print("[GPIO] Không có RPi.GPIO — chạy chế độ MÔ PHỎNG")


# ── Servo helpers ────────────────────────────────────────
def angle_to_duty(angle: int) -> float:
    """Chuyển góc (0-180) sang duty cycle SG90: 2%=0°, 12%=180°"""
    return 2.0 + (angle / 180.0) * 10.0

def servo_set(angle: int):
    if not GPIO_AVAILABLE or servo_pwm is None:
        print(f"[Servo] SIM → {angle}°")
        return
    duty = angle_to_duty(angle)
    servo_pwm.ChangeDutyCycle(duty)
    time.sleep(0.5)          # chờ servo quay tới vị trí
    servo_pwm.ChangeDutyCycle(0)  # tắt PWM để tránh rung

def servo_open():
    print(f"[Servo] MỞ barrier → {SERVO_OPEN_ANGLE}°")
    servo_set(SERVO_OPEN_ANGLE)

def servo_close():
    print(f"[Servo] ĐÓNG barrier → {SERVO_CLOSE_ANGLE}°")
    servo_set(SERVO_CLOSE_ANGLE)


# ── Đọc khoảng cách ─────────────────────────────────────
def read_distance() -> float:
    """Trả về khoảng cách (cm). Trả -1.0 nếu lỗi/timeout."""
    if not GPIO_AVAILABLE:
        import random
        if random.random() < 0.10:
            return round(random.uniform(1.5, 3.5), 1)
        return round(random.uniform(10, 80), 1)

    # Phát xung TRIG 10µs
    GPIO.output(TRIG_PIN, False)
    time.sleep(0.000002)
    GPIO.output(TRIG_PIN, True)
    time.sleep(0.00001)
    GPIO.output(TRIG_PIN, False)

    # Chờ ECHO lên HIGH
    t0 = time.time()
    while GPIO.input(ECHO_PIN) == 0:
        if time.time() - t0 > ECHO_TIMEOUT:
            return -1.0

    # Đo độ rộng xung ECHO
    pulse_start = time.time()
    while GPIO.input(ECHO_PIN) == 1:
        if time.time() - pulse_start > ECHO_TIMEOUT:
            return -1.0

    pulse_end = time.time()
    distance = (pulse_end - pulse_start) * 34300 / 2.0
    return round(distance, 1) if 0 < distance < 400 else -1.0


# ── Chụp ảnh từ IP Webcam ────────────────────────────────
def capture_image() -> bytes | None:
    try:
        resp = requests.get(IP_CAM_URL, timeout=5)
        if resp.status_code == 200:
            print(f"[Camera] Chụp OK! {len(resp.content):,} bytes")
            return resp.content
        print(f"[Camera] Lỗi HTTP {resp.status_code}")
        return None
    except Exception as e:
        print(f"[Camera] Lỗi kết nối: {e}")
        return None


# ── Gửi ảnh cho AI nhận diện ─────────────────────────────
def recognize_plate(image_bytes: bytes) -> str | None:
    try:
        files = {"image": ("plate.jpg", image_bytes, "image/jpeg")}
        resp = requests.post(f"{AI_SERVICE_URL}/api/lpr/detect", files=files, timeout=30)
        data = resp.json()
        if data.get("success"):
            return data["plate_number"]
        else:
            print(f"[AI] Không nhận diện được: {data.get('error', 'unknown')}")
            return None
    except requests.exceptions.ConnectionError:
        print("[AI] Không kết nối được AI Service! (bỏ qua, tiếp tục)")
        return None
    except Exception as e:
        print(f"[AI] Lỗi: {e}")
        return None


# ── Main Loop ────────────────────────────────────────────
def main():
    print("=" * 57)
    print("  TEST: Sensor + Servo + IP Webcam + AI")
    print(f"  Ngưỡng phát hiện : < {DETECT_THRESHOLD} cm")
    print(f"  Servo GPIO       : {SERVO_PIN} (Pin 12)")
    print(f"  Camera           : {IP_CAM_URL}")
    print("=" * 57)
    print("\nĐang đo khoảng cách... (Ctrl+C để dừng)\n")

    # Đảm bảo barrier đóng lúc khởi động
    servo_close()

    last_trigger = 0

    try:
        while True:
            dist = read_distance()
            now = time.time()

            if dist < 0:
                print(f"\r  Sensor: TIMEOUT    ", end="", flush=True)

            elif dist < DETECT_THRESHOLD:
                # ── Cooldown check ──
                if now - last_trigger < COOLDOWN_SECONDS:
                    remaining = COOLDOWN_SECONDS - (now - last_trigger)
                    print(f"\r  Sensor: {dist:5.1f} cm ← XE! cooldown {remaining:.0f}s  ",
                          end="", flush=True)
                    time.sleep(0.3)
                    continue

                # ══ PHÁT HIỆN XE! ══
                print(f"\n\n{'='*45}")
                print(f"  🚗 XE PHÁT HIỆN! Khoảng cách: {dist} cm")
                print(f"{'='*45}")

                # Barrier ĐÓNG — chờ AI xác nhận mới mở

                # Đếm ngược rồi chụp ảnh
                print(f"\n  Chụp ảnh sau {COUNTDOWN_SECONDS} giây...")
                for i in range(COUNTDOWN_SECONDS, 0, -1):
                    print(f"  {i}...")
                    time.sleep(1)
                print("  📸 CHỤP!")

                image = capture_image()
                if image:
                    filename = f"capture_{int(now)}.jpg"
                    with open(filename, "wb") as f:
                        f.write(image)

                    # Gửi AI nhận diện
                    print("[AI] Nhận diện biển số...")
                    plate = recognize_plate(image)

                    if plate:
                        print(f"\n  ┌──────────────────────────────┐")
                        print(f"  │  BIỂN SỐ: {plate:<18s}│")
                        print(f"  └──────────────────────────────┘")

                        # Kiểm tra whitelist
                        plate_clean = plate.strip().upper()
                        allowed_clean = [p.strip().upper() for p in ALLOWED_PLATES]
                        if plate_clean in allowed_clean:
                            print(f"  ✅ BIỂN SỐ HỢP LỆ — Mở barrier!")
                            servo_open()
                            print(f"[Servo] Giữ mở {BARRIER_OPEN_SECONDS}s...")
                            time.sleep(BARRIER_OPEN_SECONDS)
                            servo_close()
                        else:
                            print(f"  ❌ [{plate}] KHÔNG HỢP LỆ — Barrier vẫn đóng!")
                    else:
                        print("  ⚠️  Không nhận diện được biển số — Barrier vẫn đóng!")
                else:
                    print("  ⚠️  Không chụp được ảnh — Barrier vẫn đóng!")

                last_trigger = time.time()
                print("\nTiếp tục đo khoảng cách...\n")

            else:
                print(f"\r  Sensor: {dist:5.1f} cm (trống)    ", end="", flush=True)

            time.sleep(0.3)

    except KeyboardInterrupt:
        print("\n\nĐã dừng.")
    finally:
        servo_close()
        if GPIO_AVAILABLE:
            if servo_pwm:
                servo_pwm.stop()
            GPIO.cleanup()
            print("[GPIO] Cleanup done.")


if __name__ == "__main__":
    main()
