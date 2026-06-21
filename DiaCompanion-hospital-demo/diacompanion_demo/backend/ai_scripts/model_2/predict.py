"""
Module 2 - Lesion Segmentation (U-Net with EfficientNet-B4 encoder, PyTorch,
trained on TJDR, 5-class: background/EX/HE/MA/SE).

Single-image inference. Outputs JSON to stdout, saves a colorized lesion
mask to disk, and returns it as a base64 PNG so the frontend can render it
directly, alongside per-lesion pixel counts and connected-component counts.

Usage:
    python predict.py <image_path>
"""
import os
import sys
import json
import base64
import cv2
import numpy as np
import torch
import segmentation_models_pytorch as smp
import albumentations as A
from albumentations.pytorch import ToTensorV2

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(SCRIPT_DIR, "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "tjdr_unet_v4_best.pth")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "outputs")

# Must match training exactly (see the original evaluation script).
SIZE = 768
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)
NUM_CLASSES = 5  # 0=background, 1=EX, 2=HE, 3=MA, 4=SE

LESION_NAMES = {1: "EX", 2: "HE", 3: "MA", 4: "SE"}

# Colors matched to the original training notebook's visualization convention
# (RGB [255,50,50]=EX, [50,255,50]=HE, [50,50,255]=MA, [255,255,0]=SE),
# converted to BGR for cv2.imwrite. Green and blue are swapped between HE and
# MA versus that original mapping, per the known label mix-up between these
# two classes.
LESION_COLORS_BGR = {
    1: (50, 50, 255),    # EX  -> red
    2: (255, 50, 50),    # HE  -> blue   (swapped with MA)
    3: (50, 255, 50),    # MA  -> green  (swapped with HE)
    4: (0, 255, 255),    # SE  -> yellow
}

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Resize fully to SIZE x SIZE, no aspect-ratio preservation - matches training.
inference_tf = A.Compose([
    A.Resize(SIZE, SIZE),
    A.Normalize(mean=MEAN, std=STD),
    ToTensorV2()
])

_model = None


def load_model():
    global _model
    if _model is not None:
        return _model

    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model weights not found at {MODEL_PATH}")

    model = smp.Unet(
        encoder_name="efficientnet-b4",
        encoder_weights=None,
        in_channels=3,
        classes=NUM_CLASSES
    )
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    model.to(device)
    model.eval()
    _model = model
    return _model


def count_lesion_regions(binary_mask):
    """Count connected components for a single-lesion binary mask."""
    num_labels, _ = cv2.connectedComponents(binary_mask.astype(np.uint8))
    return max(0, num_labels - 1)  # subtract background label


def get_bounding_boxes(binary_mask, min_area=4):
    """Return a list of (x, y, w, h) bounding boxes for each connected
    component in a binary lesion mask, skipping tiny noise blobs below
    min_area pixels."""
    num_labels, labels = cv2.connectedComponents(binary_mask.astype(np.uint8))
    boxes = []
    for label_id in range(1, num_labels):  # skip background (0)
        component_mask = (labels == label_id).astype(np.uint8)
        if component_mask.sum() < min_area:
            continue
        x, y, w, h = cv2.boundingRect(component_mask)
        boxes.append((x, y, w, h))
    return boxes


def draw_annotated_overlay(original_bgr, pred_mask, original_w, original_h):
    """Draws colored bounding boxes (no text) on a copy of the original
    fundus photo, one box per detected lesion instance, plus a legend strip
    above the image mapping each color to its lesion name."""
    scale_x = original_w / SIZE
    scale_y = original_h / SIZE

    overlay = original_bgr.copy()
    thickness = max(2, int(round(min(original_w, original_h) / 400)))

    for cls, color in LESION_COLORS_BGR.items():
        binary = (pred_mask == cls).astype(np.uint8)
        boxes = get_bounding_boxes(binary)
        for (x, y, w, h) in boxes:
            x0 = int(round(x * scale_x))
            y0 = int(round(y * scale_y))
            x1 = int(round((x + w) * scale_x))
            y1 = int(round((y + h) * scale_y))
            cv2.rectangle(overlay, (x0, y0), (x1, y1), color, thickness)

    # Build a legend strip (swatch + name per lesion type) and stack it
    # above the annotated image, rather than writing any text on the photo.
    legend_height = max(50, int(round(original_h * 0.07)))
    legend = np.full((legend_height, original_w, 3), 255, dtype=np.uint8)

    swatch_size = int(legend_height * 0.45)
    font_scale = max(0.5, original_w / 1400)
    font_thickness = max(1, int(round(font_scale * 2)))
    gap = int(legend_height * 0.25)
    x_cursor = gap

    for cls, name in LESION_NAMES.items():
        color = LESION_COLORS_BGR[cls]
        y0 = (legend_height - swatch_size) // 2
        cv2.rectangle(
            legend,
            (x_cursor, y0),
            (x_cursor + swatch_size, y0 + swatch_size),
            color,
            thickness=-1
        )
        x_cursor += swatch_size + gap // 2

        text_size, _ = cv2.getTextSize(name, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
        text_y = (legend_height + text_size[1]) // 2
        cv2.putText(
            legend, name, (x_cursor, text_y),
            cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), font_thickness, cv2.LINE_AA
        )
        x_cursor += text_size[0] + gap * 2

    annotated = np.vstack([legend, overlay])
    return annotated


def predict(image_path):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    model = load_model()

    image_bgr = cv2.imread(image_path)
    if image_bgr is None:
        raise ValueError("Could not decode image file")

    original_h, original_w = image_bgr.shape[:2]
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    transformed = inference_tf(image=image_rgb)
    x = transformed["image"].unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(x)
        pred_mask = logits.argmax(dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
    # pred_mask shape: (SIZE, SIZE), values in {0,1,2,3,4}

    # Per-lesion pixel counts and connected-component (lesion instance) counts,
    # computed directly on the SIZE x SIZE prediction grid.
    lesion_counts = {}
    pixel_counts = {}
    for cls, name in LESION_NAMES.items():
        binary = (pred_mask == cls).astype(np.uint8)
        lesion_counts[name] = count_lesion_regions(binary)
        pixel_counts[name] = int(binary.sum())

    # 1) Filled colorized mask (existing annotation image), resized back to
    # the original image size.
    color_mask = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    for cls, color in LESION_COLORS_BGR.items():
        color_mask[pred_mask == cls] = color
    color_mask_resized = cv2.resize(color_mask, (original_w, original_h), interpolation=cv2.INTER_NEAREST)

    mask_filename = f"mask_{os.path.basename(image_path)}.png"
    mask_path = os.path.join(OUTPUT_DIR, mask_filename)
    cv2.imwrite(mask_path, color_mask_resized)

    with open(mask_path, "rb") as f:
        mask_base64 = base64.b64encode(f.read()).decode("utf-8")

    # 2) New: bounding-box overlay drawn directly on the original fundus
    # photo (lesion regions are outlined, not filled), with a legend strip
    # above mapping each box color to its lesion name.
    annotated_overlay = draw_annotated_overlay(image_bgr, pred_mask, original_w, original_h)

    annotated_filename = f"annotated_{os.path.basename(image_path)}.png"
    annotated_path = os.path.join(OUTPUT_DIR, annotated_filename)
    cv2.imwrite(annotated_path, annotated_overlay)

    with open(annotated_path, "rb") as f:
        annotated_base64 = base64.b64encode(f.read()).decode("utf-8")

    return {
        "lesionCounts": lesion_counts,
        "pixelCounts": pixel_counts,
        "maskImageBase64": f"data:image/png;base64,{mask_base64}",
        "annotatedImageBase64": f"data:image/png;base64,{annotated_base64}"
    }


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing image path argument")
        image_path = sys.argv[1]
        result = predict(image_path)
        print(json.dumps({"module": "module2", "status": "success", "result": result}))
    except Exception as e:
        print(json.dumps({"module": "module2", "status": "error", "message": str(e)}))
        sys.exit(1)
