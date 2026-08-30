"""
calibrate_lesion_grade.py
=========================
Tái lập việc HIỆU CHỈNH ngưỡng cho hàm `_imply_grade_from_lesions` trong
model_runners.py (Module 2 — suy "mức DR ngụ ý từ tổn thương").

Ý tưởng: luật suy grade là một họ luật ngưỡng theo số đếm tổn thương
(MA/HE/EX/SE). Ta chọn bộ ngưỡng TỐI ĐA HOÁ quadratic-weighted-kappa (QWK) so
với nhãn thật của IDRiD — không đặt tay. Script này:

  1. Nạp features.csv  (cột: image,true_grade,dr_grade,ma,he,ex,se)
  2. Tính QWK của bộ ngưỡng HIỆN TẠI đang chạy trong production.
  3. Grid-search trên họ luật để tìm QWK tối đa -> xác nhận bộ hiện tại có
     gần tối ưu không.
  4. In vài baseline "chưa hiệu chỉnh" để thấy mức cải thiện.
  5. In ma trận nhầm lẫn của bộ hiện tại.

Chạy:
    pip install scikit-learn numpy
    python calibrate_lesion_grade.py --csv features.csv

Lưu ý trung thực: PDR (grade 4) cần TÂN MẠCH — không suy được từ 4 loại tổn
thương này, nên họ luật chặn trần ở grade 3 (severe NPDR). Đây là giới hạn có
chủ đích, không phải lỗi. Nhánh DR (Model 1) mới là nơi được phép ra grade 4.
"""

import argparse
import csv
import itertools
from collections import Counter

import numpy as np
from sklearn.metrics import cohen_kappa_score, confusion_matrix


# --- Bộ ngưỡng ĐANG CHẠY trong model_runners.py ----------------------------
# (he3, ex3, se3) -> ngưỡng lên grade 3 (severe)
# (he2, ex2, ma2) -> ngưỡng lên grade 2 (moderate)
CURRENT = dict(he3=15, ex3=30, se3=3, he2=8, ex2=5, ma2=5)


def imply_grade(ma, he, ex, se, he3, ex3, se3, he2, ex2, ma2):
    """Đúng cấu trúc luật của _imply_grade_from_lesions (chặn trần grade 3)."""
    if ma + he + ex + se == 0:
        return 0
    if he >= he3 or ex >= ex3 or se >= se3:
        return 3          # severe NPDR
    if he >= he2 or ex >= ex2 or ma >= ma2:
        return 2          # moderate NPDR
    return 1              # mild NPDR


def qwk(pred, true):
    return cohen_kappa_score(pred, true, weights="quadratic")


def load(csv_path):
    rows = []
    with open(csv_path, newline="") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    true = [int(r["true_grade"]) for r in rows]
    lesions = [(int(r["ma"]), int(r["he"]), int(r["ex"]), int(r["se"])) for r in rows]
    dr = [int(r["dr_grade"]) for r in rows] if "dr_grade" in rows[0] else None
    return rows, true, lesions, dr


def eval_params(lesions, true, p):
    pred = [imply_grade(*x, **p) for x in lesions]
    return qwk(pred, true), pred


def grid_search(lesions, true):
    best = (-1.0, None)
    space = itertools.product(
        range(10, 25),      # he3
        range(20, 45, 2),   # ex3
        (2, 3, 4),          # se3
        range(4, 12),       # he2
        range(3, 9),        # ex2
        range(3, 8),        # ma2
    )
    for he3, ex3, se3, he2, ex2, ma2 in space:
        p = dict(he3=he3, ex3=ex3, se3=se3, he2=he2, ex2=ex2, ma2=ma2)
        k, _ = eval_params(lesions, true, p)
        if k > best[0]:
            best = (k, p)
    return best


# --- vài baseline "chưa hiệu chỉnh" để so sánh -----------------------------
def baseline_naive_round(ma, he, ex, se):
    """Ngưỡng tròn đặt tay, không hiệu chỉnh."""
    if ma + he + ex + se == 0:
        return 0
    if he >= 10 or ex >= 10:
        return 3
    if he >= 5 or ex >= 5 or ma >= 5:
        return 2
    return 1


def baseline_presence(ma, he, ex, se):
    """Chỉ xét có/không tổn thương — baseline yếu nhất."""
    return 0 if ma + he + ex + se == 0 else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="features.csv")
    ap.add_argument("--no-grid", action="store_true", help="Bỏ grid-search cho nhanh")
    args = ap.parse_args()

    rows, true, lesions, dr = load(args.csv)
    n = len(rows)

    print(f"Dữ liệu: {n} ảnh IDRiD  (nguồn: {args.csv})")
    print("Phân bố true_grade:", dict(sorted(Counter(true).items())))
    print("-" * 64)

    # 1) Bộ hiện tại
    k_cur, pred_cur = eval_params(lesions, true, CURRENT)
    print("BỘ NGƯỠNG HIỆN TẠI", CURRENT)
    print(f"  QWK (lesion-implied vs true) = {k_cur:.4f}")

    # 2) Baselines
    print("-" * 64)
    print("Baseline chưa hiệu chỉnh:")
    for name, fn in [
        ("  presence (có/không)      ", baseline_presence),
        ("  ngưỡng tròn đặt tay      ", baseline_naive_round),
    ]:
        print(f"{name} QWK = {qwk([fn(*x) for x in lesions], true):.4f}")

    # 3) Grid search
    if not args.no_grid:
        print("-" * 64)
        k_best, p_best = grid_search(lesions, true)
        print("Grid-search (cùng họ luật):")
        print(f"  QWK tối đa = {k_best:.4f}  tại {p_best}")
        print(f"  Bộ hiện tại đạt {k_cur:.4f}  ->  cách tối ưu {k_best - k_cur:+.4f}")

    # 4) Cột dr_grade (Model 1) để tham chiếu
    if dr is not None:
        print("-" * 64)
        print(f"Tham chiếu — QWK cột dr_grade (Model 1) vs true = {qwk(dr, true):.4f}")

    # 5) Ma trận nhầm lẫn của bộ hiện tại
    print("-" * 64)
    labels = [0, 1, 2, 3, 4]
    cm = confusion_matrix(true, pred_cur, labels=labels)
    print("Ma trận nhầm lẫn (hàng = true 0..4, cột = implied 0..4):")
    print("        implied:  0    1    2    3    4")
    for i, row in zip(labels, cm):
        print(f"  true {i}:        " + " ".join(f"{v:4d}" for v in row))
    print("\nGhi chú: cột implied=4 luôn rỗng — luật chặn trần grade 3 (PDR cần "
          "tân mạch). Các ca true=4 rơi vào implied=3 là ĐÚNG thiết kế: vẫn "
          "referable, vẫn chuyển bác sĩ.")


if __name__ == "__main__":
    main()
