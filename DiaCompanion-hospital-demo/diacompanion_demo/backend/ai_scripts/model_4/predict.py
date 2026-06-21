"""
Module 4 - OCT Classification (EfficientNet-B0 style Keras model, OCT2017/Kermany)
Single-image inference. Model outputs 4 raw classes (NORMAL/CNV/DME/DRUSEN);
remapped here to the 3 classes used by DiaCompanion (Normal / DME / Others).

Usage:
    python predict.py <image_path>
"""
import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image as keras_image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(SCRIPT_DIR, "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "best_oct_scratch.keras")
IMG_SIZE = (224, 224)

# Raw 4-class order as trained
RAW_CLASS_NAMES = ["NORMAL", "CNV", "DME", "DRUSEN"]

# DiaCompanion 3-class remapping: NORMAL -> Normal, DME -> DME, CNV+DRUSEN -> Others
REMAP = {"NORMAL": "Normal", "DME": "DME", "CNV": "Others", "DRUSEN": "Others"}


def load_model():
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model weights not found at {MODEL_PATH}")
    return tf.keras.models.load_model(MODEL_PATH)


def predict(image_path):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    model = load_model()

    img = keras_image.load_img(image_path, target_size=IMG_SIZE)
    img_array = keras_image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0

    prediction = model.predict(img_array, verbose=0)[0]
    raw_idx = int(np.argmax(prediction))
    raw_label = RAW_CLASS_NAMES[raw_idx]
    final_label = REMAP[raw_label]
    confidence = float(np.max(prediction))

    # Aggregate probability mass for the 3-class view (Others = CNV + DRUSEN)
    probs_3class = {"Normal": 0.0, "DME": 0.0, "Others": 0.0}
    for name, prob in zip(RAW_CLASS_NAMES, prediction):
        probs_3class[REMAP[name]] += float(prob)

    return {
        "class": final_label,
        "confidence": round(confidence, 4),
        "rawClass": raw_label,
        "classProbabilities": {k: round(v, 4) for k, v in probs_3class.items()}
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing image path argument")
        image_path = sys.argv[1]
        result = predict(image_path)
        print(json.dumps({"module": "module4", "status": "success", "result": result}))
    except Exception as e:
        print(json.dumps({"module": "module4", "status": "error", "message": str(e)}))
        sys.exit(1)
