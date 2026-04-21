"""
SmartParking Pi Driver
======================
Replaces ESP32 + ESP32-CAM firmware entirely.

Hardware connected to Raspberry Pi 4 GPIO:
  - 6x HC-SR04 ultrasonic sensors (with voltage divider on ECHO pins!)
  - 2x Servo motors (barrier gates)

Camera:
  - IP Webcam app on Android phone (HTTP snapshot)

Communication:
  - Publishes sensor data and events to local Mosquitto (MQTT)
  - Subscribes to gate control commands from backend
"""

import os
import time
import json
import threading
import requests
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

MQTT_BROKER    = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT      = int(os.getenv("MQTT_PORT", 1883))
IP_CAM_URL     = os.getenv("IP_CAM_URL", "http://192.168.1.100:8080/shot.jpg")
IP_CAM_TIMEOUT = int(os.getenv("IP_CAM_TIMEOUT", 3))
BACKEND_URL    = os.getenv("BACKEND_URL", "http://localhost:3000")

SENSOR_PUBLISH_INTERVAL = float(os.getenv("SENSOR_PUBLISH_INTERVAL", 1.0))
ENTRY_CHECK_INTERVAL    = float(os.getenv("ENTRY_CHECK_INTERVAL", 0.2))
ENTRY_REARM_DELAY       = float(os.getenv("ENTRY_REARM_DELAY", 3.0))
ENTRY_THRESHOLD         = float(os.getenv("ENTRY_THRESHOLD", 4.0))

SERVO_OPEN_ANGLE  = float(os.getenv("SERVO_OPEN_ANGLE", 90))
SERVO_CLOSE_ANGLE = float(os.getenv("SERVO_CLOSE_ANGLE", 0))

SENSOR_PINS = [
    {"trig": int(os.getenv("SENSOR1_TRIG", 23)), "echo": int(os.getenv("SENSOR1_ECHO", 24))},  # Entry sensor
    {"trig": int(os.getenv("SENSOR2_TRIG", 25)), "echo": int(os.getenv("SENSOR2_ECHO", 8))},   # Exit sensor
    {"trig": int(os.getenv("SENSOR3_TRIG", 12)), "echo": int(os.getenv("SENSOR3_ECHO", 16))},  # Slot 1
    {"trig": int(os.getenv("SENSOR4_TRIG", 20)), "echo": int(os.getenv("SENSOR4_ECHO", 21))},  # Slot 2
    {"trig": int(os.getenv("SENSOR5_TRIG", 19)), "echo": int(os.getenv("SENSOR5_ECHO", 26))},  # Slot 3
    {"trig": int(os.getenv("SENSOR6_TRIG", 13)), "echo": int(os.getenv("SENSOR6_ECHO", 6))},   # Slot 4
]
SERVO1_PIN = int(os.getenv("SERVO1_PIN", 18))
SERVO2_PIN = int(os.getenv("SERVO2_PIN", 17))

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
    print("[Driver] RPi.GPIO available — running on real hardware")
except ImportError:
    GPIO_AVAILABLE = False
    print("[Driver] ⚠️  RPi.GPIO not available — running in SIMULATION mode")

gate1_is_open   = False
gate2_is_open   = False
gate1_pwm       = None
gate2_pwm       = None
sensor1_prev    = False
sensor2_prev    = False
last_entry_time = 0.0
last_exit_time  = 0.0
mqtt_client     = None

def setup_gpio():
    global gate1_pwm, gate2_pwm
    if not GPIO_AVAILABLE:
        print("[GPIO] SIMULATION mode: GPIO calls ignored")
        return

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    for pins in SENSOR_PINS:
        GPIO.setup(pins["trig"], GPIO.OUT)
        GPIO.setup(pins["echo"], GPIO.IN)
        GPIO.output(pins["trig"], False)

    GPIO.setup(SERVO1_PIN, GPIO.OUT)
    GPIO.setup(SERVO2_PIN, GPIO.OUT)

    gate1_pwm = GPIO.PWM(SERVO1_PIN, 50)
    gate2_pwm = GPIO.PWM(SERVO2_PIN, 50)
    gate1_pwm.start(0)
    gate2_pwm.start(0)

    _set_servo_angle(gate1_pwm, SERVO_CLOSE_ANGLE)
    _set_servo_angle(gate2_pwm, SERVO_CLOSE_ANGLE)
    time.sleep(0.5)
    gate1_pwm.ChangeDutyCycle(0)  # stop jitter
    gate2_pwm.ChangeDutyCycle(0)

    print("[GPIO] Setup complete. Servos initialized to CLOSED.")

def cleanup_gpio():
    if not GPIO_AVAILABLE:
        return
    if gate1_pwm: gate1_pwm.stop()
    if gate2_pwm: gate2_pwm.stop()
    GPIO.cleanup()
    print("[GPIO] Cleanup done.")

def _set_servo_angle(pwm_obj, angle):
    if not GPIO_AVAILABLE or pwm_obj is None:
        print(f"[Servo] SIM: angle={angle}°")
        return
    duty = 2.5 + (angle / 180.0) * 10.0   # maps 0°→2.5%, 180°→12.5%
    pwm_obj.ChangeDutyCycle(duty)
    time.sleep(0.4)                         # give servo time to move
    pwm_obj.ChangeDutyCycle(0)              # stop signal to reduce jitter

def open_gate1(auto_close=False):
    global gate1_is_open
    if gate1_is_open:
        print("[Gate1] Already open")
        return
    gate1_is_open = True
    _set_servo_angle(gate1_pwm, SERVO_OPEN_ANGLE)
    publish_gate_status("gate1_open")
    print(f"[Gate1] OPENED {'(auto-close 5s)' if auto_close else ''}")
    if auto_close:
        threading.Timer(5.0, close_gate1).start()

def close_gate1():
    global gate1_is_open
    if not gate1_is_open:
        return
    gate1_is_open = False
    _set_servo_angle(gate1_pwm, SERVO_CLOSE_ANGLE)
    publish_gate_status("gate1_closed")
    print("[Gate1] CLOSED")

def open_gate2(auto_close=False):
    global gate2_is_open
    if gate2_is_open:
        print("[Gate2] Already open")
        return
    gate2_is_open = True
    _set_servo_angle(gate2_pwm, SERVO_OPEN_ANGLE)
    publish_gate_status("gate2_open")
    print(f"[Gate2] OPENED {'(auto-close 5s)' if auto_close else ''}")
    if auto_close:
        threading.Timer(5.0, close_gate2).start()

def close_gate2():
    global gate2_is_open
    if not gate2_is_open:
        return
    gate2_is_open = False
    _set_servo_angle(gate2_pwm, SERVO_CLOSE_ANGLE)
    publish_gate_status("gate2_closed")
    print("[Gate2] CLOSED")

def read_distance(sensor_idx) -> float:
    if not GPIO_AVAILABLE:
        import random
        if random.random() < 0.05:
            return round(random.uniform(1.0, 3.5), 1)
        return round(random.uniform(10, 30), 1)

    pins = SENSOR_PINS[sensor_idx]
    trig, echo = pins["trig"], pins["echo"]

    GPIO.output(trig, False)
    time.sleep(0.000002)
    GPIO.output(trig, True)
    time.sleep(0.00001)
    GPIO.output(trig, False)

    timeout_start = time.time()
    while GPIO.input(echo) == 0:
        if time.time() - timeout_start > 0.03:
            return -1.0

    pulse_start = time.time()
    while GPIO.input(echo) == 1:
        if time.time() - pulse_start > 0.03:
            return -1.0

    pulse_end = time.time()
    distance = (pulse_end - pulse_start) * 34300 / 2.0
    return round(distance, 1) if 0 < distance < 400 else -1.0

def capture_image_from_ipcam() -> bytes | None:
    try:
        resp = requests.get(IP_CAM_URL, timeout=IP_CAM_TIMEOUT)
        if resp.status_code == 200:
            print(f"[Camera] Captured {len(resp.content)} bytes from IP Webcam")
            return resp.content
        print(f"[Camera] HTTP {resp.status_code}")
        return None
    except Exception as e:
        print(f"[Camera] Error: {e}")
        return None

# ─── MQTT PUBLISHING ───────────────────────────────────────────────────────────
def publish_sensor_data(distances: list):
    """Publish all 6 sensor distances as JSON."""
    def val(d): return d if d > 0 else None
    payload = {
        "sensor1": val(distances[0]),
        "sensor2": val(distances[1]),
        "sensor3": val(distances[2]),
        "sensor4": val(distances[3]),
        "sensor5": val(distances[4]),
        "sensor6": val(distances[5]),
        "ts": int(time.time()),
    }
    mqtt_client.publish("parking/sensor", json.dumps(payload), qos=1, retain=True)

def publish_event(event_type: str):
    payload = {"event": event_type, "ts": int(time.time())}
    topic = "parking/entry" if event_type == "entry" else "parking/exit"
    mqtt_client.publish(topic, json.dumps(payload), qos=1)
    print(f"[MQTT] Published {topic}")

def publish_gate_status(status: str):
    """Publish gate open/closed status."""
    payload = {"status": status, "ts": int(time.time())}
    mqtt_client.publish("parking/gate/status", json.dumps(payload), qos=1, retain=True)

def publish_image(image_bytes: bytes):
    """Publish raw JPEG bytes to MQTT for backend LPR processing."""
    mqtt_client.publish("parking/image", image_bytes, qos=1)
    print(f"[MQTT] Image published ({len(image_bytes)} bytes)")

# ─── MQTT CALLBACKS ────────────────────────────────────────────────────────────
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print(f"[MQTT] Connected to broker {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe("parking/gate1/control", qos=1)
        client.subscribe("parking/gate2/control", qos=1)
        client.subscribe("parking/camera/capture", qos=1)
        print("[MQTT] Subscribed to gate control topics")
    else:
        print(f"[MQTT] Connection failed: rc={rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode("utf-8").strip().lower()
    print(f"[MQTT] Received [{topic}]: {payload}")

    if topic == "parking/gate1/control":
        if payload == "open": open_gate1(auto_close=False)
        elif payload == "close": close_gate1()
        elif payload == "open_then_close": open_gate1(auto_close=True)

    elif topic == "parking/gate2/control":
        if payload == "open": open_gate2(auto_close=False)
        elif payload == "close": close_gate2()
        elif payload == "open_then_close": open_gate2(auto_close=True)

    elif topic == "parking/camera/capture":
        print("[Camera] Capture command received")
        def capture_and_publish():
            img = capture_image_from_ipcam()
            if img:
                publish_image(img)
            else:
                print("[Camera] Failed to capture image")
        threading.Thread(target=capture_and_publish, daemon=True).start()

def on_disconnect(client, userdata, rc, properties=None):
    print(f"[MQTT] Disconnected (rc={rc}), will retry...")

# ─── MAIN LOOPS ────────────────────────────────────────────────────────────────
def entry_exit_loop():
    """Fast loop (200ms) to detect vehicle entry/exit events."""
    global sensor1_prev, sensor2_prev, last_entry_time, last_exit_time

    while True:
        d1 = read_distance(0)  # Entry sensor
        time.sleep(0.01)
        d2 = read_distance(1)  # Exit sensor

        s1 = (d1 > 0 and d1 < ENTRY_THRESHOLD)
        s2 = (d2 > 0 and d2 < ENTRY_THRESHOLD)
        now = time.time()

        # Entry: sensor1 detects car → publish event → backend will trigger LPR
        if s1 and not sensor1_prev and (now - last_entry_time > ENTRY_REARM_DELAY):
            print(f"[Entry] Car detected at sensor1: {d1}cm")
            publish_event("entry")
            last_entry_time = now

        # Exit: sensor2 detects car → open gate2 immediately
        if s2 and not sensor2_prev and (now - last_exit_time > ENTRY_REARM_DELAY):
            print(f"[Exit] Car detected at sensor2: {d2}cm")
            publish_event("exit")
            open_gate2(auto_close=False)  # backend will auto-close after 5s
            last_exit_time = now

        sensor1_prev = s1
        sensor2_prev = s2

        time.sleep(ENTRY_CHECK_INTERVAL)

def sensor_publish_loop():
    """Slow loop (1s) to publish all 6 sensor distances."""
    while True:
        distances = []
        for i in range(6):
            distances.append(read_distance(i))
            time.sleep(0.01)  # small delay between sensors

        publish_sensor_data(distances)
        time.sleep(SENSOR_PUBLISH_INTERVAL)

# ─── ENTRY POINT ────────────────────────────────────────────────────────────────
def main():
    global mqtt_client

    print("=" * 50)
    print("  SmartParking Pi Driver v2.0")
    print("  Replacing: ESP32 + ESP32-CAM")
    print("=" * 50)

    setup_gpio()

    # Setup MQTT client (paho v2 API)
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="smartparking-pi-driver")
    mqtt_client.on_connect    = on_connect
    mqtt_client.on_message    = on_message
    mqtt_client.on_disconnect = on_disconnect

    print(f"[MQTT] Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    mqtt_client.loop_start()

    # Wait for MQTT connection
    time.sleep(2)

    # Start sensor loops in background threads
    t_entry  = threading.Thread(target=entry_exit_loop,    daemon=True, name="entry-exit")
    t_sensor = threading.Thread(target=sensor_publish_loop, daemon=True, name="sensor-publish")

    t_entry.start()
    t_sensor.start()

    print("[Driver] All loops started. Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Driver] Stopping...")
    finally:
        close_gate1()
        close_gate2()
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        cleanup_gpio()
        print("[Driver] Stopped cleanly.")

if __name__ == "__main__":
    main()
