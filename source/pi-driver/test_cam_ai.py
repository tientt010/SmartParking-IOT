import os
import cv2
import time
import requests
import numpy as np
from rapidocr_onnxruntime import RapidOCR

IP_CAM_URL        = os.getenv("IP_CAM_URL", "http://192.168.34.114:8080/shot.jpg")
TARGET_PLATE      = "AB-42"
OCR_IMG_MAX_WIDTH = 640   # Resize trước OCR → tăng tốc thêm

def capture_image() -> bytes | None:
    print(f"[Camera] Đang lấy ảnh từ {IP_CAM_URL} ...")
    try:
        resp = requests.get(IP_CAM_URL, timeout=5)
        if resp.status_code == 200:
            print(f"[Camera] ✅ {len(resp.content):,} bytes")
            return resp.content
        print(f"[Camera] ❌ HTTP {resp.status_code}")
        return None
    except Exception as e:
        print(f"[Camera] ❌ {e}")
        return None

# ── Resize trước OCR ──────────────────────────────────────────────────
def resize_for_ocr(img):
    h, w = img.shape[:2]
    if w <= OCR_IMG_MAX_WIDTH:
        return img
    scale = OCR_IMG_MAX_WIDTH / w
    resized = cv2.resize(img, (OCR_IMG_MAX_WIDTH, int(h * scale)), interpolation=cv2.INTER_AREA)
    print(f"[OCR] Resize: {w}x{h} → {OCR_IMG_MAX_WIDTH}x{int(h*scale)}")
    return resized

# ── So khớp biển số
def check_plate(detected: str, target: str) -> bool:
    d = detected.replace("-", "").replace(" ", "").upper()
    t = target.replace("-", "").replace(" ", "").upper()
    return t in d

# ── Main ──────────────────────────────────────────────────────────────
def main():
    print("=" * 52)
    print("  🚗 TEST CAM + RAPIDOCR → NHẬN DIỆN BIỂN SỐ")
    print(f"  Camera        : {IP_CAM_URL}")
    print(f"  Biển kiểm tra : {TARGET_PLATE}")
    print("=" * 52)

    print("\n[AI] Đang khởi tạo RapidOCR...")
    t0 = time.time()
    engine = RapidOCR()
    print(f"[AI] ✅ Sẵn sàng! ({time.time()-t0:.1f}s)\n")

    # Chụp ảnh
    image_bytes = capture_image()
    if not image_bytes:
        print("[!] Không lấy được ảnh. Kiểm tra lại IP Camera.")
        return

    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)

    # Lưu ảnh gốc để debug
    cv2.imwrite("test_ai_capture.jpg", img)
    print("[Camera] Lưu ảnh → test_ai_capture.jpg")

    # Resize trước OCR
    img_small = resize_for_ocr(img)

    # Chạy RapidOCR
    print("\n[AI] 🔍 Đang nhận diện...")
    t0 = time.time()
    result, elapse = engine(img_small)
    elapsed = time.time() - t0
    print(f"[AI] ⏱️  {elapsed:.2f}s\n")

    # In kết quả
    print("=== CHỮ TÌM THẤY ===")
    if not result:
        print("  (Không tìm thấy chữ nào!)")
        print("  → Gợi ý: Đưa biển số gần camera hơn, đủ sáng")
    
    found = None
    if result:
        for item in result:
            text  = item[1].strip().upper() if item[1] else ""
            score = float(item[2]) if item[2] is not None else 0.0   # Fix: cast về float
            hit   = check_plate(text, TARGET_PLATE)
            tag   = "✅" if hit else "  "
            print(f"  {tag} '{text}'  ({score:.2%})")
            if hit and not found:
                found = text

    # Kết quả cuối
    print(f"\n{'='*44}")
    if found:
        print(f"  ✅ HỢP LỆ: \"{found}\" ≈ \"{TARGET_PLATE}\"")
        print(f"  → MỞ BARRIER! 🚦")
    else:
        print(f"  ❌ Không nhận diện được \"{TARGET_PLATE}\"")
        print(f"  → Barrier vẫn ĐÓNG.")
        print(f"  → Xem ảnh debug: python -m http.server 8000")
    print('='*44)


if __name__ == "__main__":
    main()
