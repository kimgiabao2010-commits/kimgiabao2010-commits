"""
waf/waf_logger.py
-----------------
Hệ thống ghi log cảnh báo WAF.

Format log:
    [YYYY-MM-DD HH:MM:SS] [WAF_ALERT] Type: {attack_type} | Payload: {snippet}

Payload snippet được cắt ở 120 ký tự để tránh log quá dài.
"""

import logging
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Cấu hình đường dẫn log
# ---------------------------------------------------------------------------

_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOG_FILE = _LOG_DIR / "waf_alerts.log"

# Tạo thư mục logs nếu chưa tồn tại
_LOG_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Khởi tạo logger chuyên dụng cho WAF
# ---------------------------------------------------------------------------

_logger = logging.getLogger("WAF_ALERT")
_logger.setLevel(logging.WARNING)

# Chỉ thêm handler nếu chưa có (tránh duplicate log khi reload module)
if not _logger.handlers:
    _file_handler = logging.FileHandler(_LOG_FILE, encoding="utf-8")
    _file_handler.setLevel(logging.WARNING)

    # Định dạng: [2024-01-15 10:30:00] [WAF_ALERT] Type: ... | Payload: ...
    _formatter = logging.Formatter(
        fmt="[%(asctime)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _file_handler.setFormatter(_formatter)
    _logger.addHandler(_file_handler)

    # Thêm StreamHandler để hiện log ra console trong quá trình dev
    _console_handler = logging.StreamHandler()
    _console_handler.setLevel(logging.WARNING)
    _console_handler.setFormatter(_formatter)
    _logger.addHandler(_console_handler)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_MAX_PAYLOAD_LEN = 120  # ký tự tối đa của payload trong log


def log_alert(attack_type: str, payload: str) -> None:
    """
    Ghi cảnh báo WAF vào file log.

    Tham số:
        attack_type (str): Tên loại tấn công (e.g. "SQL_Injection").
        payload     (str): Nội dung payload gốc (sẽ được cắt ngắn).
    """
    snippet = payload[:_MAX_PAYLOAD_LEN]
    if len(payload) > _MAX_PAYLOAD_LEN:
        snippet += "..."

    _logger.warning("Type: %s | Payload: %s", attack_type, snippet)
