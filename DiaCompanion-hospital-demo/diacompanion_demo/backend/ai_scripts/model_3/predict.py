"""
Module 3 - Fractal Dimension Analysis (vessel U-Net + box-counting)
Single-image inference. Outputs JSON to stdout with FD_total, FD_thick, FD_thin,
delta_FD, plus base64 images of the vessel mask and skeleton for the frontend.

IMPORTANT: the vessel segmentation model was trained at 512x512 (this is the
size used by the active, non-commented inference code in the original
script). Do not change this to 256 - that value only appears in the
original script's commented-out exploratory block and does not match the
actual trained model's expected input shape.

Usage:
    python predict.py <image_path>
"""
import os
import sys
import json
import base64
import cv2
import numpy as np
import tensorflow as tf
from skimage.morphology import skeletonize

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(SCRIPT_DIR, "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "best_model.keras")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "outputs")
IMG_SIZE = 512  # must match the trained model's input shape (None, 512, 512, 3)


def dice_coef(y_true, y_pred):
    y_true = tf.keras.backend.flatten(y_true)
    y_pred = tf.keras.backend.flatten(y_pred)
    intersection = tf.reduce_sum(y_true * y_pred)
    return (2.0 * intersection + 1) / (tf.reduce_sum(y_true) + tf.reduce_sum(y_pred) + 1)


def dice_loss(y_true, y_pred):
    return 1 - dice_coef(y_true, y_pred)


def fractal_dimension_boxcount(binary_image):
    """Standard box-counting fractal dimension on a binary (skeleton) image."""
    binary_image = binary_image > 0
    sizes = np.array([64, 32, 16, 8, 4, 2])
    counts = []

    for size in sizes:
        count = 0
        for y in range(0, binary_image.shape[0], size):
            for x in range(0, binary_image.shape[1], size):
                block = binary_image[y:y + size, x:x + size]
                if np.any(block):
                    count += 1
        counts.append(count)

    counts = np.array(counts)
    # Guard against zero counts (would break log)
    valid = counts > 0
    coeffs = np.polyfit(np.log(1.0 / sizes[valid]), np.log(counts[valid]), 1)
    fd = coeffs[0]
    return float(fd), sizes, counts


def classify_vessel_caliber(mask):
    """Split a binary vessel mask into 'thick' and 'thin' subsets via morphological erosion.
    Thick vessels survive erosion; thin vessels are what's lost after erosion."""
    mask_u8 = (mask > 0).astype(np.uint8)
    kernel = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(mask_u8, kernel, iterations=1)
    thick = eroded
    thin = cv2.subtract(mask_u8, eroded)
    return thick, thin


def load_model():
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model weights not found at {MODEL_PATH}")
    return tf.keras.models.load_model(
        MODEL_PATH,
        custom_objects={"dice_coef": dice_coef, "dice_loss": dice_loss}
    )


def encode_png_base64(binary_img_0_1, out_path):
    img_255 = (binary_img_0_1 * 255).astype(np.uint8)
    cv2.imwrite(out_path, img_255)
    with open(out_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def predict(image_path):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    model = load_model()

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not decode image file")

    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    x = cv2.resize(image_rgb, (IMG_SIZE, IMG_SIZE))
    x = x / 255.0
    x = np.expand_dims(x, axis=0)

    pred = model.predict(x, verbose=0)[0]
    mask = (pred > 0.5).astype(np.uint8)
    mask_2d = mask[:, :, 0] if mask.ndim == 3 else mask

    # Skeletonize full vessel mask -> FD_total
    skeleton_total = skeletonize(mask_2d > 0)
    fd_total, _, _ = fractal_dimension_boxcount(skeleton_total)

    # Caliber-separated FD
    thick_mask, thin_mask = classify_vessel_caliber(mask_2d)
    skeleton_thick = skeletonize(thick_mask > 0)
    skeleton_thin = skeletonize(thin_mask > 0)

    fd_thick, _, _ = fractal_dimension_boxcount(skeleton_thick) if np.any(skeleton_thick) else (float("nan"), None, None)
    fd_thin, _, _ = fractal_dimension_boxcount(skeleton_thin) if np.any(skeleton_thin) else (float("nan"), None, None)
    delta_fd = (fd_thick - fd_thin) if not (np.isnan(fd_thick) or np.isnan(fd_thin)) else None

    base_name = os.path.basename(image_path)
    mask_path = os.path.join(OUTPUT_DIR, f"vessel_mask_{base_name}.png")
    skeleton_path = os.path.join(OUTPUT_DIR, f"skeleton_{base_name}.png")

    mask_b64 = encode_png_base64(mask_2d, mask_path)
    skeleton_b64 = encode_png_base64(skeleton_total.astype(np.uint8), skeleton_path)

    return {
        "FD_total": round(fd_total, 4),
        "FD_thick": round(fd_thick, 4) if not np.isnan(fd_thick) else None,
        "FD_thin": round(fd_thin, 4) if not np.isnan(fd_thin) else None,
        "delta_FD": round(delta_fd, 4) if delta_fd is not None else None,
        "vesselMaskBase64": f"data:image/png;base64,{mask_b64}",
        "skeletonImageBase64": f"data:image/png;base64,{skeleton_b64}"
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing image path argument")
        image_path = sys.argv[1]
        result = predict(image_path)
        print(json.dumps({"module": "module3", "status": "success", "result": result}))
    except Exception as e:
        print(json.dumps({"module": "module3", "status": "error", "message": str(e)}))
        sys.exit(1)
