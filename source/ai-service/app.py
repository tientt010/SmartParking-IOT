from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os

from utils.lpr import LPRModel
from utils.image_utils import preprocess_image

load_dotenv()

app = Flask(__name__)
CORS(app)

lpr_model = LPRModel()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ai-service-paddleocr"})


@app.route("/api/lpr/detect", methods=["POST"])
def detect_license_plate():
    try:
        if "image" not in request.files and "image" not in request.json if request.is_json else True:
            pass

        if request.files and "image" in request.files:
            image_bytes = request.files["image"].read()
        elif request.is_json and "image" in request.json:
            import base64
            b64 = request.json["image"]
            if b64.startswith("data:image"):
                b64 = b64.split(",")[1]
            image_bytes = base64.b64decode(b64)
        else:
            return jsonify({"error": "No image provided"}), 400

        image = preprocess_image(image_bytes)
        plate_number = lpr_model.predict(image)

        if not plate_number:
            return jsonify({"success": False, "plate_number": None, "error": "No text detected"})

        return jsonify({
            "success": True,
            "plate_number": plate_number,
            "confidence": 0.90,
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    print(f"[AI Service] Loading PaddleOCR model...")
    lpr_model.load_model()
    print(f"[AI Service] Running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
