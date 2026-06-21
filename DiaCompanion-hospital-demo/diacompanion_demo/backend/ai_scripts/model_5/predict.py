"""
Module 5 - OCT Layer Segmentation with DME Localization
(U-Net 8-class boundary segmentation + Random Forest DME classifier on thickness features)
Single-image inference. Outputs JSON to stdout plus base64 boundary overlay
and (if DME detected) a base64 heatmap image.

Usage:
    python predict.py <image_path>
"""
import os
import sys
import json
import base64
import io
import cv2
import torch
import joblib
import numpy as np
import pandas as pd
import segmentation_models_pytorch as smp
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(SCRIPT_DIR, "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "best_unet.pth")
RF_PATH = os.path.join(WEIGHTS_DIR, "rf_dme_classifier.pkl")
CSV_PATH = os.path.join(WEIGHTS_DIR, "normal_thickness_reference.csv")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "outputs")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_unet():
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"U-Net weights not found at {MODEL_PATH}")
    unet = smp.Unet(encoder_name="resnet18", encoder_weights=None, in_channels=1, classes=8)
    unet.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    unet.to(device)
    unet.eval()
    return unet


def load_rf():
    if not os.path.exists(RF_PATH):
        raise RuntimeError(f"Random Forest weights not found at {RF_PATH}")
    return joblib.load(RF_PATH)


def largest_connected_thickness(mask_column, cls):
    ys = np.where(mask_column == cls)[0]
    if len(ys) == 0:
        return np.nan
    groups = np.split(ys, np.where(np.diff(ys) != 1)[0] + 1)
    return max(len(g) for g in groups)


def retina_thickness_column(mask_column):
    ys = np.where(mask_column > 0)[0]
    if len(ys) == 0:
        return np.nan
    return ys.max() - ys.min()


def central_thickness(pred_mask):
    h, w = pred_mask.shape
    center = w // 2
    region = pred_mask[:, max(0, center - 25):center + 25]
    values = []
    for x in range(region.shape[1]):
        ys = np.where(region[:, x] > 0)[0]
        if len(ys) > 0:
            values.append(ys.max() - ys.min())
    return np.array(values) if values else np.array([np.nan])


def retina_thickness_curve(pred_mask):
    curve = []
    for col in range(pred_mask.shape[1]):
        ys = np.where(pred_mask[:, col] > 0)[0]
        curve.append(ys.max() - ys.min() if len(ys) else np.nan)
    return np.array(curve)


def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def predict(image_path):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    unet = load_unet()
    rf = load_rf()

    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Could not decode image file")

    img_resize = cv2.resize(img, (768, 496))
    x = img_resize.astype(np.float32) / 255.0
    x = torch.tensor(x).unsqueeze(0).unsqueeze(0).to(device)

    with torch.no_grad():
        pred = unet(x)
    pred_mask = torch.argmax(pred, dim=1).squeeze().cpu().numpy()

    # Thickness reference (normative) for DME localization
    if os.path.exists(CSV_PATH):
        curve_ref = pd.read_csv(CSV_PATH)
        normal_mean = curve_ref["Mean"].values
    else:
        normal_mean = np.zeros(pred_mask.shape[1])

    patient_curve = retina_thickness_curve(pred_mask)
    diff = patient_curve - normal_mean
    center = len(diff) // 2

    abnormal_region = diff > 20
    valid_region = np.zeros(len(diff), dtype=bool)
    lo, hi = max(0, center - 150), min(len(diff), center + 150)
    valid_region[lo:hi] = True
    abnormal_region = abnormal_region & valid_region

    num_abnormal = np.sum(abnormal_region)
    percent_abnormal = (num_abnormal / len(abnormal_region) * 100) if len(abnormal_region) else 0.0
    max_diff = float(np.nanmax(diff)) if len(diff) else 0.0
    mean_diff = float(np.nanmean(diff[abnormal_region])) if np.any(abnormal_region) else 0.0

    # Per-layer thickness features (classes 1..7)
    row = {}
    for cls in range(1, 8):
        thickness = np.array([largest_connected_thickness(pred_mask[:, col], cls)
                               for col in range(pred_mask.shape[1])])
        row[f"L{cls}_Mean"] = np.nanmean(thickness)
        row[f"L{cls}_Median"] = np.nanmedian(thickness)
        row[f"L{cls}_P95"] = np.nanpercentile(thickness, 95)
        row[f"L{cls}_Std"] = np.nanstd(thickness)

    retina = np.array([retina_thickness_column(pred_mask[:, col]) for col in range(pred_mask.shape[1])])
    row["Retina_Mean"] = np.nanmean(retina)
    row["Retina_Median"] = np.nanmedian(retina)
    row["Retina_P95"] = np.nanpercentile(retina, 95)
    row["Retina_Std"] = np.nanstd(retina)

    central = central_thickness(pred_mask)
    row["Central_Mean"] = np.nanmean(central)
    row["Central_Median"] = np.nanmedian(central)
    row["Central_Max"] = np.nanmax(central)
    row["Central_Std"] = np.nanstd(central)

    X = pd.DataFrame([row])
    prediction = int(rf.predict(X)[0])
    prob = rf.predict_proba(X)[0]
    is_dme = prediction == 1

    # Boundary overlay image
    fig1 = plt.figure(figsize=(14, 7))
    plt.imshow(img_resize, cmap="gray")
    for cls in range(1, 8):
        boundary = []
        for col in range(pred_mask.shape[1]):
            ys = np.where(pred_mask[:, col] == cls)[0]
            boundary.append(np.min(ys) if len(ys) else np.nan)
        plt.plot(boundary, linewidth=2)
    plt.title(f"Prediction = {'DME' if is_dme else 'NORMAL'}")
    plt.axis("off")
    boundary_b64 = fig_to_base64(fig1)

    heatmap_b64 = None
    if is_dme:
        fig2 = plt.figure(figsize=(14, 7))
        plt.imshow(img_resize, cmap="gray")
        for col in range(len(abnormal_region)):
            if abnormal_region[col]:
                ys = np.where(pred_mask[:, col] > 0)[0]
                if len(ys):
                    plt.fill_betweenx([ys.min(), ys.max()], col - 0.5, col + 0.5, alpha=0.35)
        plt.title("Suspicious DME Region")
        plt.axis("off")
        heatmap_b64 = fig_to_base64(fig2)

    result = {
        "diagnosis": "DME" if is_dme else "NORMAL",
        "confidence": round(float(prob[1] if is_dme else prob[0]) * 100, 2),
        "maxThicknessIncreasePx": round(max_diff, 1),
        "avgThicknessIncreasePx": round(mean_diff, 1),
        "suspiciousRegionPercent": round(float(percent_abnormal), 1),
        "boundaryOverlayBase64": f"data:image/png;base64,{boundary_b64}"
    }
    if heatmap_b64:
        result["heatmapBase64"] = f"data:image/png;base64,{heatmap_b64}"

    return result


if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            raise ValueError("Missing image path argument")
        image_path = sys.argv[1]
        result = predict(image_path)
        print(json.dumps({"module": "module5", "status": "success", "result": result}))
    except Exception as e:
        print(json.dumps({"module": "module5", "status": "error", "message": str(e)}))
        sys.exit(1)
