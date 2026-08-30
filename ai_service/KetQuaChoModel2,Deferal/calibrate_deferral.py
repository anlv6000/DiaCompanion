"""
calibrate_deferral.py — Lấy BẰNG CHỨNG cho hai câu hỏi, không đoán:

  (1) Ánh xạ đếm-tổn-thương -> grade nên đặt ngưỡng nào? (calibrate theo QWK
      trên tập có nhãn thật, thay vì các mốc "HE>=8 -> grade 3" đặt bằng tay).
  (2) Cơ chế defer (bất đồng chéo DR_grade vs lesion_grade) CÓ THẬT SỰ bắt đúng
      ca DR đoán sai không, hay bật ở mọi ảnh? (kiểu complementarity/CoDoC).

Không có nhãn thật thì KHÔNG có bằng chứng. Script này cần bạn cung cấp nhãn.

============================================================================
NẠP DỮ LIỆU VÀO KIỂU GÌ
============================================================================
Bạn cần 2 thứ:

  A. Thư mục ảnh fundus của tập validation  (--images DIR)
  B. File nhãn CSV: mỗi dòng = 1 ảnh + grade thật (0..4)  (--labels FILE)

File nhãn chỉ cần 2 cột: TÊN ẢNH và GRADE. Tên cột đặt qua --image-col /
--grade-col (mặc định "image" / "grade"). Ví dụ theo bộ dữ liệu phổ biến:

  IDRiD:  --labels "IDRiD_Disease Grading_Training Labels.csv" \
          --image-col "Image name" --grade-col "Retinopathy grade" \
          --images ".../Original Images/Training Set"
          (tên ảnh trong CSV không có đuôi -> script tự thử .jpg/.png)

  DDR / APTOS:  CSV cột (id_code|image_name, diagnosis|grade) tương tự.

  Tự làm:  một CSV thủ công 2 cột image,grade cũng chạy.

Ảnh trong CSV có thể là tên trần ("IDRiD_001"), tên có đuôi, path tương đối,
hay path tuyệt đối — script resolve theo thứ tự đó.

============================================================================
CÁCH CHẠY (2 bước)
============================================================================
  # Bước 1 — trích đặc trưng: chạy MODEL lesion + DR trên từng ảnh, ghi CSV.
  #          (bước này CẦN weights + tensorflow/torch, chạy trên máy có model)
  python calibrate_deferral.py extract \
      --images  /duong/dan/anh \
      --labels  nhan.csv --image-col image --grade-col grade \
      --out     features.csv

  # Bước 2 — phân tích: KHÔNG cần model, chỉ đọc features.csv.
  python calibrate_deferral.py analyze --features features.csv

  # Hoặc gộp cả hai:
  python calibrate_deferral.py all --images ... --labels ... --out features.csv

Bước 1 chậm (chạy model từng ảnh); bước 2 chạy vài giây. Đã có features.csv
rồi thì chỉ cần lặp lại bước 2 để thử lại phân tích.

features.csv có các cột: image,true_grade,dr_grade,ma,he,ex,se
Nếu bạn đã có sẵn bảng đếm này từ nơi khác, tạo đúng cột đó rồi chạy thẳng
bước analyze — không cần bước extract.
"""
import os
import sys
import csv
import argparse
import itertools

import numpy as np


# ---------------------------------------------------------------------------
#  BƯỚC 1 — TRÍCH ĐẶC TRƯNG (cần model)
# ---------------------------------------------------------------------------
_IMG_EXTS = ["", ".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG", ".tif", ".tiff"]


def _resolve_image_file(name, images_dir):
    """Thử: path tuyệt đối -> path trong images_dir -> thêm đuôi ảnh thường gặp."""
    cand = []
    if os.path.isabs(name):
        cand.append(name)
    cand.append(os.path.join(images_dir, name))
    out = []
    for base in cand:
        for ext in _IMG_EXTS:
            out.append(base + ext)
    for p in out:
        if os.path.isfile(p):
            return p
    return None


def _read_labels(path, image_col, grade_col, drop_grades):
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if image_col not in reader.fieldnames or grade_col not in reader.fieldnames:
            raise SystemExit(
                f"Không thấy cột '{image_col}' hoặc '{grade_col}' trong {path}.\n"
                f"Các cột hiện có: {reader.fieldnames}\n"
                f"Chỉ định lại bằng --image-col / --grade-col."
            )
        for r in reader:
            name = (r.get(image_col) or "").strip()
            graw = (r.get(grade_col) or "").strip()
            if not name or graw == "":
                continue
            try:
                grade = int(float(graw))
            except ValueError:
                continue
            if grade in drop_grades:
                continue
            rows.append((name, grade))
    return rows


def cmd_extract(args):
    # import model_runners CHỈ ở bước này (bước analyze không cần model).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import model_runners as mr

    labels = _read_labels(args.labels, args.image_col, args.grade_col,
                          set(args.drop_grades))
    if args.limit:
        labels = labels[: args.limit]
    print(f"[extract] {len(labels)} ảnh có nhãn. Bắt đầu chạy model...")

    written = 0
    failed = 0
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["image", "true_grade", "dr_grade", "ma", "he", "ex", "se"])
        for i, (name, true_grade) in enumerate(labels, 1):
            path = _resolve_image_file(name, args.images)
            if path is None:
                failed += 1
                print(f"  [{i}/{len(labels)}] KHÔNG thấy file: {name}")
                continue
            try:
                les = mr.run_lesion(path)
                dr = mr.run_dr(path)
                w.writerow([
                    name, true_grade, dr["dr_grade"],
                    les["count_ma"], les["count_he"], les["count_ex"], les["count_se"],
                ])
                written += 1
            except Exception as e:  # noqa: BLE001 — một ảnh lỗi không dừng cả mẻ
                failed += 1
                print(f"  [{i}/{len(labels)}] LỖI {name}: {e}")
            if i % 25 == 0:
                print(f"  ...{i}/{len(labels)} (ok={written}, lỗi={failed})")
    print(f"[extract] Xong. Ghi {written} dòng vào {args.out} (lỗi/không thấy={failed}).")
    if written == 0:
        raise SystemExit("Không trích được dòng nào — kiểm tra --images/--labels.")


# ---------------------------------------------------------------------------
#  Chỉ số đánh giá (thuần numpy — không cần sklearn)
# ---------------------------------------------------------------------------
def confusion(y_true, y_pred, k):
    m = np.zeros((k, k), dtype=np.int64)
    np.add.at(m, (y_true, y_pred), 1)
    return m


def quadratic_weighted_kappa(y_true, y_pred, k=5):
    """QWK: 1 = trùng khớp hoàn hảo, 0 = như đoán ngẫu nhiên, âm = tệ hơn ngẫu nhiên."""
    O = confusion(y_true, y_pred, k).astype(float)
    i = np.arange(k)
    W = (i[:, None] - i[None, :]) ** 2 / (k - 1) ** 2
    act = O.sum(1)
    pred = O.sum(0)
    N = O.sum()
    if N == 0:
        return 0.0
    E = np.outer(act, pred) / N
    denom = (W * E).sum()
    if denom == 0:
        return 1.0
    return 1.0 - (W * O).sum() / denom


# ---------------------------------------------------------------------------
#  Heuristic đếm -> grade
# ---------------------------------------------------------------------------
def imply_current(ma, he, ex, se):
    """Bản ĐANG DÙNG trong model_runners._imply_grade_from_lesions (để so sánh)."""
    total = ma + he + ex + se
    g = np.where(total > 0, 1, 0)
    g = np.where((ma >= 5) | (he >= 1) | (ex >= 1), 2, g)
    g = np.where((he >= 8) | (ex >= 8), 3, g)
    g = np.where((se >= 1) | (he >= 20), 4, g)
    return g.astype(np.int64)


def imply_param(ma, he, ex, se, p, max_grade):
    """Heuristic tham số hoá, chặn trần max_grade (mặc định 3 theo ICDR:
    PDR cần tân mạch — không suy được từ MA/HE/EX/SE)."""
    total = ma + he + ex + se
    g = np.where(total > 0, 1, 0)
    mod = (he >= p[0]) | (ex >= p[1]) | (se >= p[2]) | (ma >= p[3])
    g = np.where(mod, 2, g)
    sev = (he >= p[4]) | (ex >= p[5]) | (se >= p[6])
    g = np.where(sev, 3, g)
    g = np.minimum(g, max_grade)
    g = np.where(total == 0, 0, g)
    return g.astype(np.int64)


# Lưới tìm kiếm — thứ tự p = (he2, ex2, se2, ma2, he3, ex3, se3).
# Ràng buộc đơn điệu heN3 >= heN2 để cắt tổ hợp vô nghĩa.
GRID = {
    "he2": [1, 2, 3, 5, 8],
    "ex2": [1, 2, 3, 5, 8],
    "se2": [1, 2, 3],
    "ma2": [5, 10, 15, 20],
    "he3": [8, 12, 15, 20, 30],
    "ex3": [8, 12, 15, 20, 30],
    "se3": [2, 3, 5],
}


def calibrate(ma, he, ex, se, true, max_grade):
    best = (-2.0, None)
    combos = 0
    for he2, ex2, se2, ma2, he3, ex3, se3 in itertools.product(
        GRID["he2"], GRID["ex2"], GRID["se2"], GRID["ma2"],
        GRID["he3"], GRID["ex3"], GRID["se3"]
    ):
        if he3 < he2 or ex3 < ex2 or se3 < se2:
            continue  # ngưỡng severe phải >= moderate
        combos += 1
        p = (he2, ex2, se2, ma2, he3, ex3, se3)
        pred = imply_param(ma, he, ex, se, p, max_grade)
        qwk = quadratic_weighted_kappa(true, pred, k=5)
        if qwk > best[0]:
            best = (qwk, p)
    return best[0], best[1], combos


# ---------------------------------------------------------------------------
#  Đánh giá cơ chế defer: bất đồng chéo CÓ bắt được ca DR sai không?
# ---------------------------------------------------------------------------
def evaluate_deferral(dr_grade, lesion_grade, true_grade, base_threshold):
    """In bảng: với mỗi ngưỡng bất đồng, tỉ lệ defer, tỉ lệ DR sai trong nhóm
    defer vs nhóm giữ, và % số ca DR-sai bị bắt (error capture).

    Nếu tỉ lệ DR-sai trong nhóm defer KHÔNG cao hơn nhóm giữ ở mọi ngưỡng ->
    bất đồng KHÔNG dự báo được lỗi DR -> cơ chế (như hiện tại) chưa có cơ sở.
    """
    disagreement = np.abs(dr_grade - lesion_grade) / 4.0
    dr_error = (dr_grade != true_grade)
    n = len(dr_grade)
    total_err = int(dr_error.sum())
    base_err = total_err / n if n else 0.0

    print()
    print(f"  Tổng ca: {n} | DR-head sai (vs nhãn thật): {total_err} "
          f"({base_err:.1%})")
    print(f"  Ngưỡng gốc hiện tại (config/fallback): {base_threshold}")
    print()
    print("  ngưỡng | %defer | DR-sai/defer | DR-sai/giữ | bắt được lỗi | lift")
    print("  -------+--------+--------------+------------+--------------+------")
    for tau in [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.75]:
        deferred = disagreement > tau
        nd = int(deferred.sum())
        nk = n - nd
        err_def = dr_error[deferred].mean() if nd else 0.0
        err_keep = dr_error[~deferred].mean() if nk else 0.0
        capture = (dr_error & deferred).sum() / total_err if total_err else 0.0
        defer_rate = nd / n if n else 0.0
        lift = (err_def / base_err) if base_err > 0 else 0.0
        print(f"   {tau:0.2f}  | {defer_rate:5.1%} |   {err_def:6.1%}     |"
              f"  {err_keep:6.1%}   |   {capture:6.1%}    | {lift:4.2f}x")
    print()
    print("  Đọc bảng: cơ chế CÓ ÍCH khi 'DR-sai/defer' >> 'DR-sai/giữ' và 'bắt")
    print("  được lỗi' cao ở mức '%defer' chấp nhận được. Nếu hai cột sai xấp xỉ")
    print("  nhau ở mọi ngưỡng -> bất đồng không tách được ca sai -> cần xem lại.")


def cmd_analyze(args):
    # đọc features.csv
    with open(args.features, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise SystemExit("features.csv rỗng.")
    need = {"true_grade", "dr_grade", "ma", "he", "ex", "se"}
    if not need.issubset(rows[0].keys()):
        raise SystemExit(f"features.csv thiếu cột. Cần: {sorted(need)}")

    def col(name, cast=int):
        return np.array([cast(r[name]) for r in rows])

    true = col("true_grade")
    dr = col("dr_grade")
    ma, he, ex, se = col("ma"), col("he"), col("ex"), col("se")
    n = len(true)

    print("=" * 70)
    print(f"  PHÂN TÍCH {n} ảnh có nhãn thật")
    print("=" * 70)

    # --- Phân bố grade thật + grade DR
    print("\n  Phân bố grade (thật vs DR-head):")
    for g in range(5):
        print(f"    grade {g}: thật={int((true==g).sum()):5d}   dr={int((dr==g).sum()):5d}")

    # --- Heuristic hiện tại
    cur = imply_current(ma, he, ex, se)
    qwk_cur = quadratic_weighted_kappa(true, cur, k=5)
    print(f"\n  QWK heuristic ĐANG DÙNG vs nhãn thật: {qwk_cur:+.4f}")

    # --- Calibrate
    print(f"\n  Đang calibrate (trần grade = {args.max_grade})... có thể mất chút.")
    qwk_best, p_best, combos = calibrate(ma, he, ex, se, true, args.max_grade)
    print(f"  Đã thử {combos} tổ hợp ngưỡng.")
    print(f"  QWK TỐT NHẤT: {qwk_best:+.4f}  (so với hiện tại {qwk_cur:+.4f}, "
          f"đổi {qwk_best - qwk_cur:+.4f})")
    print(f"  Ngưỡng tối ưu (he2,ex2,se2,ma2,he3,ex3,se3) = {p_best}")

    cal = imply_param(ma, he, ex, se, p_best, args.max_grade)

    print("\n  Ma trận nhầm lẫn heuristic đã calibrate (hàng=thật, cột=suy ra):")
    cm = confusion(true, cal, 5)
    hdr = "        " + "".join(f"  g{j} " for j in range(5))
    print(hdr)
    for i in range(5):
        print(f"    g{i} | " + "".join(f"{cm[i,j]:4d} " for j in range(5)))

    # --- Bằng chứng cho việc chặn trần grade 3:
    n_true4 = int((true == 4).sum())
    if n_true4:
        print(f"\n  Lưu ý ICDR: có {n_true4} ảnh grade 4 (PDR) thật. Heuristic chặn")
        print("  trần 3 nên KHÔNG bao giờ chạm 4 — đây là giới hạn ĐÚNG (không có")
        print("  kênh tân mạch), khác với 'sai'. DR-head vẫn được phép ra 4.")

    # --- Đánh giá defer với heuristic hiện tại và đã calibrate
    print("\n" + "-" * 70)
    print("  (1) CƠ CHẾ DEFER — dùng heuristic ĐANG DÙNG:")
    print("-" * 70)
    evaluate_deferral(dr, cur, true, args.base_threshold)

    print("\n" + "-" * 70)
    print("  (2) CƠ CHẾ DEFER — dùng heuristic ĐÃ CALIBRATE:")
    print("-" * 70)
    evaluate_deferral(dr, cal, true, args.base_threshold)

    # --- In sẵn hàm để dán (CHỈ dùng nếu QWK cải thiện & bạn chấp nhận)
    he2, ex2, se2, ma2, he3, ex3, se3 = p_best
    print("\n" + "=" * 70)
    print("  Nếu QWK trên đủ tốt, đây là _imply_grade_from_lesions calibrated:")
    print("=" * 70)
    print(f'''
def _imply_grade_from_lesions(counts: dict) -> int:
    ma = counts.get("MA", 0); he = counts.get("HE", 0)
    ex = counts.get("EX", 0); se = counts.get("SE", 0)
    if ma + he + ex + se == 0:
        return 0
    # Trần grade 3: PDR (4) cần tân mạch, không suy được từ MA/HE/EX/SE (ICDR).
    if he >= {he3} or ex >= {ex3} or se >= {se3}:
        return 3
    if he >= {he2} or ex >= {ex2} or se >= {se2} or ma >= {ma2}:
        return 2
    return 1  # chỉ vài tổn thương nhẹ
''')
    print("  ^ Các số trên do CALIBRATE trên nhãn thật của bạn, KHÔNG đặt tay.")


def cmd_all(args):
    cmd_extract(args)
    args.features = args.out
    cmd_analyze(args)


# ---------------------------------------------------------------------------
def build_parser():
    ap = argparse.ArgumentParser(
        description="Calibrate ánh xạ đếm->grade và đánh giá cơ chế defer bằng dữ liệu có nhãn.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add_extract_args(p):
        p.add_argument("--images", required=True, help="Thư mục ảnh fundus.")
        p.add_argument("--labels", required=True, help="CSV nhãn (image,grade).")
        p.add_argument("--image-col", default="image")
        p.add_argument("--grade-col", default="grade")
        p.add_argument("--drop-grades", type=int, nargs="*", default=[5],
                       help="Grade cần loại (mặc định 5 = không đánh giá được).")
        p.add_argument("--limit", type=int, default=0, help="Chỉ chạy N ảnh đầu (thử nhanh).")
        p.add_argument("--out", default="features.csv")

    pe = sub.add_parser("extract", help="Chạy model, ghi features.csv (cần weights).")
    add_extract_args(pe)

    pa = sub.add_parser("analyze", help="Phân tích features.csv (không cần model).")
    pa.add_argument("--features", default="features.csv")
    pa.add_argument("--max-grade", type=int, default=3,
                    help="Trần grade cho heuristic lesion (mặc định 3 theo ICDR).")
    pa.add_argument("--base-threshold", type=float, default=0.35,
                    help="Ngưỡng bất đồng gốc đang dùng (chỉ để in tham chiếu).")

    pl = sub.add_parser("all", help="extract rồi analyze.")
    add_extract_args(pl)
    pl.add_argument("--max-grade", type=int, default=3)
    pl.add_argument("--base-threshold", type=float, default=0.35)

    return ap


def main():
    args = build_parser().parse_args()
    if args.cmd == "extract":
        cmd_extract(args)
    elif args.cmd == "analyze":
        cmd_analyze(args)
    elif args.cmd == "all":
        cmd_all(args)


if __name__ == "__main__":
    main()
