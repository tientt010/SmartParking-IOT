from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import ssl
from PIL import Image

# Bypass SSL certificate verification 
ssl._create_default_https_context = ssl._create_unverified_context

if not hasattr(Image, "ANTIALIAS") and hasattr(Image, "Resampling"):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

from utils.lpr import LPRModel
from utils.image_utils import preprocess_image

load_dotenv()

app = Flask(__name__)
CORS(app)

model_name = "easyocr"
lpr_model = LPRModel(lang=["en"])


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ai-service"})


@app.route("/api/lpr/detect", methods=["POST"])
def detect_license_plate():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        image_bytes = file.read()

        image = preprocess_image(image_bytes)

        plate_number = lpr_model.predict(image)

        return jsonify(
            {
                "success": True,
                "plate_number": plate_number,
                "confidence": 0.95,
            }
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    lpr_model.load_model()

    print(f"AI Service running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
