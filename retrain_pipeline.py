"""
retrain_pipeline.py
-------------------
HITL (Human-in-the-Loop) Automated Retrain Pipeline cho FastText model.

Luồng thực thi:
    1. Đọc dữ liệu đã được admin duyệt từ `re_train_dataset.csv`.
    2. Định dạng lại theo chuẩn FastText supervised: `__label__<verdict> <text>`.
    3. Ghi tiếp (append) vào `fasttext_train.txt` (không ghi đè, giữ data cũ).
    4. Gọi `fasttext.train_supervised()` để huấn luyện lại model với tham số tối ưu.
    5. Ghi đè file `.bin` model cũ bằng model mới đã train.
    6. Gửi POST /reload tới FastText server để nạp lại model không cần restart.
    7. Log chi tiết từng bước ra console với timestamp.

Cách chạy:
    python retrain_pipeline.py

Yêu cầu:
    pip install fasttext httpx pandas
"""

import csv
import logging
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Cấu hình
# ---------------------------------------------------------------------------

# Đường dẫn các file (tương đối so với thư mục chứa script này)
BASE_DIR = Path(__file__).parent

RETRAIN_CSV = BASE_DIR / "re_train_dataset.csv"
FASTTEXT_TRAIN_TXT = BASE_DIR / "fasttext_train.txt"
MODEL_BIN_PATH = BASE_DIR / "scam_detector_distilbert" / "scam_detector_model_fasttext.bin"

# FastText server endpoint để reload model sau khi train
FASTTEXT_SERVER_RELOAD_URL = "http://localhost:5001/reload"

# Tham số huấn luyện FastText
TRAIN_PARAMS = {
    "epoch": 30,
    "lr": 0.5,
    "wordNgrams": 3,
    "dim": 100,
    "minCount": 2,
    "loss": "softmax",
}

# Cột label trong CSV (giá trị: 'safe' hoặc 'scam')
VERDICT_COLUMN = "admin_verdict"
TEXT_COLUMN = "text_preview"

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [RETRAIN] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
    force=True,  # Đảm bảo cấu hình được áp dụng ngay cả khi logger đã tồn tại
)
# Buộc stdout flush ngay lập tức — cần thiết trên Windows khi chạy background task
sys.stdout.reconfigure(line_buffering=True)  # type: ignore[attr-defined]
logger = logging.getLogger("retrain_pipeline")

# ---------------------------------------------------------------------------
# Tiền xử lý text (phải nhất quán với api_server_fasttext.py)
# ---------------------------------------------------------------------------

def preprocess_text(text: str) -> str:
    """Làm sạch text theo cùng pipeline với FastText server để nhất quán."""
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)       # Bỏ URL
    text = re.sub(r"\S+@\S+", "", text)               # Bỏ email
    text = re.sub(r"[^\w\s]", " ", text)              # Bỏ ký tự đặc biệt
    text = re.sub(r"\d+", "", text)                   # Bỏ số
    text = " ".join(text.split())                     # Thu gọn whitespace
    return text


# ---------------------------------------------------------------------------
# Bước 1 & 2: Đọc CSV và định dạng sang FastText format
# ---------------------------------------------------------------------------

def load_and_format_retrain_data() -> list[str]:
    """
    Đọc re_train_dataset.csv, lọc các dòng đã có admin_verdict,
    rồi định dạng thành chuỗi FastText: '__label__<verdict> <processed_text>'.

    Returns:
        Danh sách các dòng FastText format (rỗng nếu không có dữ liệu hợp lệ).
    """
    if not RETRAIN_CSV.exists():
        logger.error("Không tìm thấy file: %s", RETRAIN_CSV)
        return []

    formatted_lines: list[str] = []
    skipped = 0
    total = 0

    logger.info("Đọc dữ liệu từ: %s", RETRAIN_CSV)

    with open(RETRAIN_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            total += 1
            verdict: str = row.get(VERDICT_COLUMN, "").strip().lower()
            text: str = row.get(TEXT_COLUMN, "").strip()

            # Chỉ xử lý dòng đã có verdict rõ ràng
            if verdict not in ("safe", "scam"):
                logger.debug(
                    "Bỏ qua dòng %d: verdict không hợp lệ '%s'", total, verdict
                )
                skipped += 1
                continue

            processed = preprocess_text(text)
            if not processed:
                logger.debug("Bỏ qua dòng %d: text rỗng sau xử lý.", total)
                skipped += 1
                continue

            # FastText label format: __label__safe hoặc __label__scam
            # Ánh xạ: 'safe' → 'legit' (khớp với nhãn model hiện tại)
            ft_label = "legit" if verdict == "safe" else "scam"
            formatted_lines.append(f"__label__{ft_label} {processed}")

    logger.info(
        "Đọc xong: %d dòng tổng | %d hợp lệ | %d bỏ qua",
        total, len(formatted_lines), skipped,
    )
    return formatted_lines


# ---------------------------------------------------------------------------
# Bước 3: Ghi append vào fasttext_train.txt
# ---------------------------------------------------------------------------

def append_to_train_file(lines: list[str]) -> int:
    """
    Ghi tiếp (append) các dòng mới vào cuối fasttext_train.txt.

    Returns:
        Số dòng đã ghi thành công.
    """
    if not lines:
        logger.warning("Không có dòng nào để ghi vào train file.")
        return 0

    logger.info("Ghi %d dòng mới vào: %s", len(lines), FASTTEXT_TRAIN_TXT)

    with open(FASTTEXT_TRAIN_TXT, "a", encoding="utf-8") as f:
        f.write("\n")  # Ngăn cách với data cũ
        f.write("\n".join(lines))
        f.write("\n")

    logger.info("✓ Đã ghi xong %d dòng vào train file.", len(lines))
    return len(lines)


# ---------------------------------------------------------------------------
# Bước 4 & 5: Train FastText và lưu model
# ---------------------------------------------------------------------------

def train_and_save_model() -> bool:
    """
    Gọi fasttext.train_supervised() với file train hiện tại,
    sau đó ghi đè model .bin cũ.

    Returns:
        True nếu train và lưu thành công, False nếu có lỗi.
    """
    try:
        import fasttext  # Import ở đây để tránh lỗi nếu thư viện chưa cài
    except ImportError:
        print("❌ [BACKGROUND TASK] Thư viện 'fasttext' chưa được cài!", flush=True)
        logger.error("Thư viện 'fasttext' chưa được cài. Chạy: pip install fasttext")
        return False

    if not FASTTEXT_TRAIN_TXT.exists():
        print(f"❌ [BACKGROUND TASK] Không tìm thấy file train: {FASTTEXT_TRAIN_TXT}", flush=True)
        logger.error("Không tìm thấy file train: %s", FASTTEXT_TRAIN_TXT)
        return False

    # ── PRINT NỔI BẬT: Bắt đầu train ────────────────────────────────────
    print("", flush=True)
    print("=" * 65, flush=True)
    print("🚀 [BACKGROUND TASK] ĐANG BẮT ĐẦU HUẤN LUYỆN LẠI FASTTEXT", flush=True)
    print(f"   Epoch    : {TRAIN_PARAMS['epoch']}", flush=True)
    print(f"   LR       : {TRAIN_PARAMS['lr']}", flush=True)
    print(f"   wordNgrams: {TRAIN_PARAMS['wordNgrams']}", flush=True)
    print(f"   dim      : {TRAIN_PARAMS['dim']}", flush=True)
    print(f"   Train file: {FASTTEXT_TRAIN_TXT}", flush=True)
    print("=" * 65, flush=True)
    print("", flush=True)

    logger.info("Bắt đầu train FastText model với tham số: %s", TRAIN_PARAMS)
    t_start = time.monotonic()

    try:
        model = fasttext.train_supervised(
            input=str(FASTTEXT_TRAIN_TXT),
            **TRAIN_PARAMS,
        )
        elapsed = round(time.monotonic() - t_start, 2)
        print(f"⏱️  [BACKGROUND TASK] Train FastText hoàn tất trong {elapsed:.2f}s.", flush=True)
        logger.info("✓ Train hoàn tất trong %.2fs.", elapsed)
    except Exception as exc:
        print(f"❌ [BACKGROUND TASK] LỖI khi train model: {exc}", flush=True)
        logger.error("LỖI khi train model: %s", exc, exc_info=True)
        return False

    # Lưu đè model cũ
    try:
        MODEL_BIN_PATH.parent.mkdir(parents=True, exist_ok=True)
        model.save_model(str(MODEL_BIN_PATH))
        size_mb = MODEL_BIN_PATH.stat().st_size / 1_048_576
        print("", flush=True)
        print("=" * 65, flush=True)
        print("✅ [BACKGROUND TASK] HUẤN LUYỆN XONG VÀ ĐÃ LƯU MODEL MỚI!", flush=True)
        print(f"   Đường dẫn: {MODEL_BIN_PATH}", flush=True)
        print(f"   Kích thước: {size_mb:.1f} MB", flush=True)
        print("=" * 65, flush=True)
        print("", flush=True)
        logger.info("✓ Model đã lưu vào: %s (%.1f MB)", MODEL_BIN_PATH, size_mb)
    except Exception as exc:
        print(f"❌ [BACKGROUND TASK] LỖI khi lưu model: {exc}", flush=True)
        logger.error("LỖI khi lưu model: %s", exc, exc_info=True)
        return False

    return True


# ---------------------------------------------------------------------------
# Bước 6: Thông báo FastText server reload model
# ---------------------------------------------------------------------------

def notify_server_reload() -> bool:
    """
    Gửi POST /reload tới FastText server để server nạp lại model mới
    mà không cần restart thủ công.

    Returns:
        True nếu server xác nhận reload, False nếu thất bại.
    """
    logger.info("Gửi yêu cầu reload tới FastText server: %s", FASTTEXT_SERVER_RELOAD_URL)
    try:
        resp = httpx.post(FASTTEXT_SERVER_RELOAD_URL, timeout=15.0)
        if resp.status_code == 200:
            logger.info(
                "✓ FastText server đã reload model thành công. Response: %s",
                resp.json(),
            )
            return True
        else:
            logger.error(
                "FastText server trả về HTTP %d khi reload: %s",
                resp.status_code, resp.text[:200],
            )
            return False
    except httpx.ConnectError:
        logger.warning(
            "FastText server không kết nối được tại %s. "
            "Model đã lưu đĩa — server sẽ dùng model mới khi restart.",
            FASTTEXT_SERVER_RELOAD_URL,
        )
        return False
    except httpx.TimeoutException:
        logger.warning("FastText server timeout khi reload. Có thể reload đang chạy ngầm.")
        return False
    except Exception as exc:
        logger.error("LỖI khi gửi reload: %s", exc, exc_info=True)
        return False


# ---------------------------------------------------------------------------
# Pipeline tổng hợp
# ---------------------------------------------------------------------------

def run_pipeline() -> None:
    """
    Chạy toàn bộ HITL retrain pipeline theo thứ tự 6 bước.
    In tóm tắt kết quả cuối cùng ra console.
    """
    banner = "=" * 65
    print("", flush=True)
    print(banner, flush=True)
    print("  🔄 SWG HITL RETRAIN PIPELINE — BACKGROUND TASK", flush=True)
    print(f"  Bắt đầu lúc: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(banner, flush=True)
    print("", flush=True)
    logger.info(banner)
    logger.info("  SWG HITL RETRAIN PIPELINE")
    logger.info("  Bắt đầu lúc: %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info(banner)

    # ── Bước 1 & 2: Đọc & format dữ liệu ───────────────────────────────────
    logger.info("[Bước 1/4] Đọc và định dạng dữ liệu từ CSV...")
    new_lines = load_and_format_retrain_data()

    if not new_lines:
        logger.warning("Không có dữ liệu mới hợp lệ để retrain. Pipeline dừng.")
        return

    # ── Bước 3: Append vào train file ───────────────────────────────────────
    logger.info("[Bước 2/4] Ghi dữ liệu mới vào fasttext_train.txt...")
    written = append_to_train_file(new_lines)
    if written == 0:
        logger.error("Ghi dữ liệu thất bại. Pipeline dừng.")
        return

    # ── Bước 4 & 5: Train + lưu model ───────────────────────────────────────
    logger.info("[Bước 3/4] Train và lưu FastText model...")
    success = train_and_save_model()
    if not success:
        logger.error("Train model thất bại. Pipeline dừng.")
        return

    # ── Bước 6: Reload server ────────────────────────────────────────────────
    logger.info("[Bước 4/4] Thông báo FastText server reload model mới...")
    reloaded = notify_server_reload()

    # ── Tóm tắt ─────────────────────────────────────────────────────────────
    print("", flush=True)
    print(banner, flush=True)
    print("  📊 KẾT QUẢ PIPELINE", flush=True)
    print(f"  Dòng dữ liệu mới đã ghi : {written}", flush=True)
    print(f"  Train model              : {'✅ Thành công' if success else '❌ Thất bại'}", flush=True)
    print(f"  Server reload            : {'✅ Thành công' if reloaded else '⚠️  Cần restart server thủ công'}", flush=True)
    print(f"  Kết thúc lúc             : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(banner, flush=True)
    print("", flush=True)
    logger.info(banner)
    logger.info("  KẾT QUẢ PIPELINE")
    logger.info("  Dòng dữ liệu mới đã ghi: %d", written)
    logger.info("  Train model: %s", "✓ Thành công" if success else "✗ Thất bại")
    logger.info("  Server reload: %s", "✓ Thành công" if reloaded else "⚠ Cần restart server thủ công")
    logger.info("  Kết thúc lúc:  %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info(banner)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_pipeline()
