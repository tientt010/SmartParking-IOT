import cv2
import numpy as np
from PIL import Image
import io


def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB if needed
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Resize if too large
    max_size = 1920
    if max(image.size) > max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    return image


def enhance_plate_region(image):
    # Convert PIL to OpenCV format
    img_array = np.array(image)
    img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

    # Grayscale
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

    return Image.fromarray(cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB))
