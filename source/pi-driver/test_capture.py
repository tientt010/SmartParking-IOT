#!/usr/bin/env python3
"""
Test script: Chụp 1 ảnh từ IP Webcam → Gửi cho AI Service → In kết quả → Dừng.
Usage: python3 test_capture.py
"""

import requests
import sys
import os
import time
from dotenv import load_dotenv

load_dotenv()

IP_CAM_URL = os.getenv("IP_CAM_URL", "http://192.168.34.114:8080/shot.jpg")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:5001")

print("=" * 50)
print("  TEST: IP Webcam → AI Service (LPR)")
print("=" * 50)

# ── Bước 1: Chụp ảnh từ điện thoại ──────────────────────
print(f"Bắt đầu đếm ngược 5 giây để bạn chuẩn bị Camera...")
for i in range(5, 0, -1):
    print(f"{i}...")
    time.sleep(1)
print("CHỤP!")

print(f"\n[1] Chụp ảnh từ: {IP_CAM_URL}")
try:
    resp = requests.get(IP_CAM_URL, timeout=5)
    if resp.status_code != 200:
        print(f"    FAIL! HTTP {resp.status_code}")
        sys.exit(1)
    image_bytes = resp.content
    print(f"    OK! Nhận được {len(image_bytes):,} bytes ({len(image_bytes)/1024:.1f} KB)")
except Exception as e:
    print(f"    FAIL! {e}")
    print(f"\n    Kiểm tra lại:")
    print(f"    - App IP Webcam đã bật chưa?")
    print(f"    - Điện thoại và Mac cùng mạng WiFi chưa?")
    print(f"    - Thử mở link trên trình duyệt: {IP_CAM_URL}")
    sys.exit(1)

# Lưu ảnh ra file để bạn xem lại
save_path = "test_capture.jpg"
with open(save_path, "wb") as f:
    f.write(image_bytes)
print(f"    Ảnh đã lưu: {save_path}")

# ── Bước 2: Gửi cho AI Service nhận diện ─────────────────
print(f"\n[2] Gửi ảnh cho AI Service: {AI_SERVICE_URL}/api/lpr/detect")
try:
    files = {"image": ("plate.jpg", image_bytes, "image/jpeg")}
    resp = requests.post(f"{AI_SERVICE_URL}/api/lpr/detect", files=files, timeout=30)
    data = resp.json()

    if data.get("success"):
        plate = data["plate_number"]
        print(f"    THÀNH CÔNG!")
        print(f"    ┌─────────────────────────────┐")
        print(f"    │  Biển số: {plate:<18s} │")
        print(f"    └─────────────────────────────┘")
    else:
        print(f"    Không nhận diện được biển số.")
        print(f"    Lý do: {data.get('error', 'unknown')}")
        print(f"    Thử chĩa camera vào biển số rõ hơn.")

except requests.exceptions.ConnectionError:
    print(f"    FAIL! Không kết nối được AI Service.")
    print(f"    Bạn cần chạy AI Service trước:")
    print(f"    cd source/ai-service && source venv/bin/activate && python3 app.py")
except Exception as e:
    print(f"    FAIL! {e}")

print("\n" + "=" * 50)
print("  TEST HOÀN TẤT")
print("=" * 50)
