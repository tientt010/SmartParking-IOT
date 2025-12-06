import easyocr
import numpy as np
from PIL import Image


class LPRModel:
    def __init__(self, lang=["en"]):
        self.lang = lang
        self.reader = None

    def load_model(self):
        print("Loading EasyOCR model...")
        self.reader = easyocr.Reader(self.lang, gpu=False)
        print("EasyOCR model loaded successfully!")

    def predict(self, image: Image.Image) -> str:
        if self.reader is None:
            self.load_model()

        img_array = np.array(image)

        results = self.reader.readtext(img_array)

        if results:
            best_result = max(results, key=lambda x: x[2])
            plate_number = best_result[1]
        else:
            return ""

        plate_number = self.clean_plate_number(plate_number)

        return plate_number

    def clean_plate_number(self, text: str) -> str:
        text = text.replace(" ", "").upper()

        import re

        text = re.sub(r"[^A-Z0-9-]", "", text)

        return text
