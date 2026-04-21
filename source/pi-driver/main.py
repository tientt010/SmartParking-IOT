import os
os.environ["OPENBLAS_CORETYPE"] = "ARMV8"

import time
import requests
import numpy as np
import cv2
from rapidocr_onnxruntime import RapidOCR
from dotenv import load_dotenv

load_dotenv()

#  CONFIG CA BỘ SENSOR & SERVO
TRIG_PIN_1        = int(os.getenv("SENSOR1_TRIG",       22))
ECHO_PIN_1        = int(os.getenv("SENSOR1_ECHO",       23))
SERVO_PIN_1       = int(os.getenv("SERVO1_PIN",         18))

TRIG_PIN_2        = int(os.getenv("SENSOR2_TRIG",       25))
ECHO_PIN_2        = int(os.getenv("SENSOR2_ECHO",       8))
SERVO_PIN_2       = int(os.getenv("SERVO2_PIN",         17))

TRIG_PIN_3        = int(os.getenv("SENSOR3_TRIG",       12))
ECHO_PIN_3        = int(os.getenv("SENSOR3_ECHO",       16))

TRIG_PIN_4        = int(os.getenv("SENSOR4_TRIG",       20))
ECHO_PIN_4        = int(os.getenv("SENSOR4_ECHO",       21))

IP_CAM_URL        = os.getenv("IP_CAM_URL",     "http://192.168.34.114:8080/shot.jpg")
BACKEND_URL       = os.getenv("BACKEND_URL",    "http://localhost:3000")

DETECT_THRESHOLD  = float(os.getenv("ENTRY_THRESHOLD",  4.0))   
PARK_THRESHOLD    = 4.0      

COUNTDOWN_SECONDS = 1        
BARRIER_OPEN_SECS = 5        
COOLDOWN_SECONDS  = 8        
ECHO_TIMEOUT      = 0.1

SERVO_OPEN_ANGLE  = int(os.getenv("SERVO_OPEN_ANGLE",   90))
SERVO_CLOSE_ANGLE = int(os.getenv("SERVO_CLOSE_ANGLE",   0))
OCR_IMG_MAX_WIDTH = 640


#  GPIO SETUP
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

servo1_pwm = None
servo2_pwm = None

if GPIO_AVAILABLE:
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    
    GPIO.setup(TRIG_PIN_1, GPIO.OUT); GPIO.setup(ECHO_PIN_1, GPIO.IN); GPIO.output(TRIG_PIN_1, False)
    GPIO.setup(SERVO_PIN_1, GPIO.OUT); servo1_pwm = GPIO.PWM(SERVO_PIN_1, 50); servo1_pwm.start(0)

    GPIO.setup(TRIG_PIN_2, GPIO.OUT); GPIO.setup(ECHO_PIN_2, GPIO.IN); GPIO.output(TRIG_PIN_2, False)
    GPIO.setup(SERVO_PIN_2, GPIO.OUT); servo2_pwm = GPIO.PWM(SERVO_PIN_2, 50); servo2_pwm.start(0)

    GPIO.setup(TRIG_PIN_3, GPIO.OUT); GPIO.setup(ECHO_PIN_3, GPIO.IN); GPIO.output(TRIG_PIN_3, False)
    GPIO.setup(TRIG_PIN_4, GPIO.OUT); GPIO.setup(ECHO_PIN_4, GPIO.IN); GPIO.output(TRIG_PIN_4, False)

    time.sleep(0.5)
else:
    print("[GPIO] Không tìm thấy RPi.GPIO — chạy MÔ PHỎNG")


#  SERVO ENGINE
def angle_to_duty(angle: int) -> float:
    return 2.0 + (angle / 180.0) * 10.0

def servo_set(servo_obj, angle: int):
    if not GPIO_AVAILABLE or servo_obj is None: return
    servo_obj.ChangeDutyCycle(angle_to_duty(angle))
    time.sleep(0.5)
    servo_obj.ChangeDutyCycle(0)

def servo1_open():  print(f"[CỔNG VÀO] 🔓 MỞ barrier"); servo_set(servo1_pwm, SERVO_OPEN_ANGLE)
def servo1_close(): print(f"[CỔNG VÀO] 🔒 ĐÓNG barrier"); servo_set(servo1_pwm, SERVO_CLOSE_ANGLE)
def servo2_open():  print(f"[CỔNG RA]  🔓 MỞ barrier"); servo_set(servo2_pwm, SERVO_OPEN_ANGLE)
def servo2_close(): print(f"[CỔNG RA]  🔒 ĐÓNG barrier"); servo_set(servo2_pwm, SERVO_CLOSE_ANGLE)


#  POLL LỆNH THỦ CÔNG TỪ BACKEND ADMIN
def poll_gate_commands():
    try:
        r = requests.get(f"{BACKEND_URL}/api/device/gate-commands", timeout=1)
        cmds = r.json().get("commands", [])
        for cmd in cmds:
            gate   = cmd.get("gate")
            action = cmd.get("action")
            print(f"\n  [ADMIN] Lệnh thủ công: {action.upper()} {gate}")
            if gate == "gate1":
                if action == "open":
                    servo1_open()
                    time.sleep(BARRIER_OPEN_SECS)
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
        pass  # Không làm gián đoạn vòng lặp chính


#  SIÊU ÂM
def read_distance(trig, echo) -> float:
    if not GPIO_AVAILABLE: return -1.0

    GPIO.output(trig, False); time.sleep(0.000002)
    GPIO.output(trig, True);  time.sleep(0.00001)
    GPIO.output(trig, False)

    t0 = time.time()
    while GPIO.input(echo) == 0:
        if time.time() - t0 > ECHO_TIMEOUT: return -1.0
    pulse_start = time.time()
    
    while GPIO.input(echo) == 1:
        if time.time() - pulse_start > ECHO_TIMEOUT: return -1.0
    pulse_end = time.time()
    
    dist = (pulse_end - pulse_start) * 34300 / 2.0
    return round(dist, 1) if 0 < dist < 400 else -1.0


#  CAMERA & AI
def capture_image() -> bytes | None:
    try:
        resp = requests.get(IP_CAM_URL, timeout=5)
        if resp.status_code == 200:
            print(f"  📸 Chụp OK! {len(resp.content):,} bytes")
            return resp.content
    except: pass
    return None

def resize_for_ocr(img):
    h, w = img.shape[:2]
    if w <= OCR_IMG_MAX_WIDTH: return img
    scale = OCR_IMG_MAX_WIDTH / w
    return cv2.resize(img, (OCR_IMG_MAX_WIDTH, int(h * scale)), interpolation=cv2.INTER_AREA)

def recognize_plate(engine: RapidOCR, image_bytes: bytes) -> str | None:
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None: return None
    img_small = resize_for_ocr(img)
    t0 = time.time()
    result, _ = engine(img_small)
    print(f"  [AI] Xử lý xong trong {time.time()-t0:.2f}s")
    if result: return max(result, key=lambda x: x[2])[1].strip().upper()
    return None


#  MAIN SUPER LOOP WITH API (VÉ/VÍ KHÁCH HÀNG)
def process_lane_with_api(label, gate_type, camera_engine, open_func, close_func):
    print(f"\n\n{'='*55}")
    print(f"  🚗 XE ĐANG DỪNG Ở {label.upper()}!")
    print(f"{'='*55}")
    
    print(f"  Chờ {COUNTDOWN_SECONDS}s ổn định rồi chụp...")
    time.sleep(COUNTDOWN_SECONDS)
    
    image = capture_image()
    if not image:
        print(f"  ⚠️ Lỗi Camera! {label} vẫn ĐÓNG")
        return
        
    print(f"  [AI] Đang đọc biển số...")
    plate = recognize_plate(camera_engine, image)
    
    print(f"\n  ┌─────────────────────────────────────┐")
    print(f"  │  BIỂN SỐ NHẬN DIỆN: {plate if plate else '(không rõ)':<16s} │")
    print(f"  └─────────────────────────────────────┘")
    
    if not plate:
        print(f"\n  ❌ Không đọc được biển số → {label} VẪN ĐÓNG")
        time.sleep(2)
        return

    api_endpoint = f"{BACKEND_URL}/api/hardware/{gate_type}"
    print(f"  [API] Đang gọi {api_endpoint} để kiểm tra ví/tài khoản...")
    
    try:
        res = requests.post(api_endpoint, json={"plate": plate}, timeout=10)
        data = res.json()
    except Exception as e:
        print(f"  [API] ⚠️ Lỗi gọi Backend: {e}")
        time.sleep(2)
        return

    if data.get("action") == "accept":
        msg = data.get("message", "Thành công")
        if gate_type == "entry":
            print(f"\n  ✅ ĐƯỢC PHÉP VÀO: Mở {label} (Số dư: {data.get('balance', 0):,}đ)")
        else:
            print(f"\n  ✅ THANH TOÁN THÀNH CÔNG: Mở {label} (-{data.get('fee', 0):,}đ, dư còn {data.get('balanceAfter', 0):,}đ)")
            
        open_func()
        print(f"  ⏳ {label} Giữ mở {BARRIER_OPEN_SECS} giây...")
        time.sleep(BARRIER_OPEN_SECS)
        close_func()
    else:
        reason = data.get("reason", "Không rõ nguyên nhân")
        print(f"\n  ❌ TỪ CHỐI ({reason}) → {label} VẪN ĐÓNG")
        time.sleep(3)


def main():
    print("\n" + "=" * 65)
    print(" 🔥 BÃI XE THÔNG MINH ĐẦY ĐỦ: TÍCH HỢP HỆ THỐNG VÍ KHÁCH HÀNG")
    print("=" * 65)

    print("\n[AI] Khởi tạo AI Engine (RapidOCR)...")
    engine = RapidOCR()
    print("[AI] ✅ Đã nạp xong!\n")

    servo1_close()
    servo2_close()

    print("\n=== HỆ THỐNG SẴN SÀNG QUÉT ===")
    print("Nhấn Ctrl+C để thoát...\n")

    last_entry = 0
    last_exit  = 0
    last_sensor_push = 0   # Throttle: chỉ push lên backend mỗi 2 giây
    last_cmd_poll    = 0   # Throttle: poll lệnh thủ công mỗi 2 giây

    try:
        while True:
            # 1. Quét toàn bộ 4 Sensor
            dist_in   = read_distance(TRIG_PIN_1, ECHO_PIN_1)
            dist_out  = read_distance(TRIG_PIN_2, ECHO_PIN_2)
            dist_lot1 = read_distance(TRIG_PIN_3, ECHO_PIN_3)
            dist_lot2 = read_distance(TRIG_PIN_4, ECHO_PIN_4)
            now = time.time()

            # 2. Xử lý Trạng thái 2 Ô Đỗ Tiên Quyết
            status_lot1 = "🔴 ĐẦY" if (0 < dist_lot1 < PARK_THRESHOLD) else "🟢 TRỐNG"
            status_lot2 = "🔴 ĐẦY" if (0 < dist_lot2 < PARK_THRESHOLD) else "🟢 TRỐNG"

            # 3. Xử lý Cổng Vào
            if 0 < dist_in < DETECT_THRESHOLD:
                if now - last_entry > COOLDOWN_SECONDS:
                    process_lane_with_api("CỔNG VÀO", "entry", engine, servo1_open, servo1_close)
                    last_entry = time.time()
                    print("\n=== QUAY LẠI QUÉT ===")
            
            # 4. Xử lý Cổng Ra
            elif 0 < dist_out < DETECT_THRESHOLD:
                if now - last_exit > COOLDOWN_SECONDS:
                    process_lane_with_api("CỔNG RA", "exit", engine, servo2_open, servo2_close)
                    last_exit = time.time()
                    print("\n=== QUAY LẠI QUÉT ===")

            # 5. Đẩy trạng thái cảm biến + Poll lệnh thủ công (mỗi 2 giây)
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
                    pass  

            if now - last_cmd_poll > 2.0:
                poll_gate_commands()
                last_cmd_poll = now

            try:
                s_in  = f"{dist_in:4.1f}cm" if dist_in > 0 else "--- "
                s_out = f"{dist_out:4.1f}cm" if dist_out > 0 else "--- "
                log_gate = f"[VÀ] {s_in} | [RA] {s_out}"
                log_lot  = f"[Ô 1]: {status_lot1} | [Ô 2]: {status_lot2}"
                print(f"\r  {log_gate}  ║  {log_lot}        ", end="", flush=True)
            except:
                pass

            time.sleep(0.3)

    except KeyboardInterrupt:
        print("\n\n[!] TẮT HỆ THỐNG.")
    finally:
        servo1_close()
        servo2_close()
        if GPIO_AVAILABLE:
            if servo1_pwm: servo1_pwm.stop()
            if servo2_pwm: servo2_pwm.stop()
            GPIO.cleanup()
            print("[GPIO] Cleanup done.")

if __name__ == "__main__":
    main()
