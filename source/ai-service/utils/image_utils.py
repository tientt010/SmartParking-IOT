import cv2
import numpy as np
from PIL import Image
import io


def preprocess_image(image_bytes: bytes) -> Image.Image:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")

    h, w = img.shape[:2]
    max_width = 800
    if w > max_width:
        scale = max_width / w
        img = cv2.resize(img, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(img_rgb)
