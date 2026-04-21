import numpy as np
import re
import easyocr


class LPRModel:
    def __init__(self):
        self.reader = None

    def load_model(self):
        print("[LPR] Loading EasyOCR model (first run downloads ~100MB)...")
        self.reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        print("[LPR] EasyOCR model loaded successfully!")

    def predict(self, image) -> str:
        if self.reader is None:
            self.load_model()

        img_array = np.array(image)

        results = self.reader.readtext(img_array, detail=1, paragraph=False)

        print(f"[DEBUG] EasyOCR raw: {results}")

        if not results:
            return ""

        best_text = ""
        best_conf = 0.0
        for (_, text, conf) in results:
            if conf > best_conf and str(text).strip():
                best_conf = conf
                best_text = str(text)

        print(f"[DEBUG] Best: '{best_text}' (conf={best_conf:.2f})")
        return self.clean_plate(best_text)

    def clean_plate(self, text: str) -> str:
        text = text.strip().replace(" ", "").upper()
        text = re.sub(r"[^A-Z0-9\-]", "", text)
        return text if len(text) >= 3 else ""
