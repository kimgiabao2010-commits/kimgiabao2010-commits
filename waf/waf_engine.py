"""
waf/waf_engine.py
-----------------
Core Logic — WafEngine class.
"""

from __future__ import annotations

import html
import re
import urllib.parse
from typing import Optional

from waf.modsec_rules_set import MODSEC_RULES

# Danh sách các đuôi tên miền được phép (Whitelist TLD)
TRUSTED_TLDS = ('.vn', '.com', '.com.vn', '.edu.vn', '.gov.vn', '.net', '.org')

# ---------------------------------------------------------------------------
# Regex tách URL — dùng riêng, không compile vào MODSEC_RULES
# ---------------------------------------------------------------------------
_URL_EXTRACTOR = re.compile(
    r"(?:https?|ftp)://"           # scheme
    r"[^\s\"'<>\[\]{}\(\)\\]+"    # ký tự hợp lệ trong URL
    r"[^\s\"'<>\[\]{}\(\)\\.,;:!?]",  # không kết thúc bằng dấu câu
    re.IGNORECASE,
)

def check_url_security(url: str) -> dict:
    """
    Hàm heuristic kiểm tra độ an toàn của URL (chống MitM và Phishing domain).
    """
    try:
        # Rule 1: Protocol Enforcement
        lower_url = url.lower()
        if lower_url.startswith("http://") or lower_url.startswith("ftp://"):
            return {"is_safe": False, "attack_type": "INSECURE_HTTP_PROTOCOL"}

        # Xử lý URL: Thêm https:// nếu URL không có scheme để parse được
        if not lower_url.startswith("http"):
            parse_url = "https://" + url
        else:
            parse_url = url

        parsed = urllib.parse.urlparse(parse_url)
        domain = parsed.hostname or ""
        domain = domain.lower()

        # Bỏ www. nếu có
        if domain.startswith("www."):
            domain = domain[4:]

        # Rule 2: Phishing TLD
        if not any(domain.endswith(tld) for tld in TRUSTED_TLDS):
            return {"is_safe": False, "attack_type": "SUSPICIOUS_TLD_PHISHING"}

        return {"is_safe": True}
    except Exception:
        # Xử lý Exception: URL quá dị dạng không parse được -> mặc định là Phishing
        return {"is_safe": False, "attack_type": "SUSPICIOUS_TLD_PHISHING"}

class WafEngine:
    """
    Layer 1 WAF Engine — Defense-in-Depth.
    """

    @staticmethod
    def normalize_payload(text: str) -> str:
        """
        Chuẩn hóa payload để vô hiệu hóa các kỹ thuật bypass phổ biến.
        Thực hiện đầy đủ 4 bước theo yêu cầu kiến trúc SWG:
        1. Giải mã URL Encoding vòng lặp (chống double/triple encoding) + Unicode escape.
        2. Chuyển toàn bộ về chữ thường (.lower()) để match case-insensitive.
        3. Giải mã HTML Entities (&lt; → <, &#x27; → ', v.v.).
        4. Xóa Null Byte, comment SQL, thu gọn khoảng trắng thừa thành 1 space.
        """
        if not isinstance(text, str):
            text = str(text)

        # Bước 1: Giải mã URL Encoding (Multi-pass phá double/triple encoding)
        try:
            prev = None
            while prev != text:
                prev = text
                text = urllib.parse.unquote(text)
        except Exception:
            pass

        # Bước 1b: Giải mã Unicode escape (\u0041 → A, \x3c → <)
        try:
            if "\\u" in text or "\\x" in text:
                text = text.encode("raw_unicode_escape").decode("unicode_escape")
        except Exception:
            pass

        # Bước 2: Chuyển về chữ thường — chuẩn hóa case cho regex matching
        text = text.lower()

        # Bước 3: Giải mã HTML Entities (&lt; &gt; &amp; &#x27; &#60; …)
        try:
            text = html.unescape(text)
        except Exception:
            pass

        # Bước 4a: Xóa bỏ ký tự Null Byte (%00, \x00)
        text = text.replace('\x00', '')
        text = text.replace('%00', '')

        # Bước 4b: Xóa bỏ các comment SQL (/*...*/ và --comment)
        text = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
        text = re.sub(r"(?<![:/])--[^\r\n]*", " ", text)

        # Bước 4c: Thu gọn tab, newline, nhiều space thành 1 khoảng trắng duy nhất
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    @staticmethod
    def extract_urls(text: str) -> list[str]:
        """Tách tất cả URL có trong chuỗi văn bản."""
        return _URL_EXTRACTOR.findall(text)

    def inspect(self, payload: str) -> dict:
        """
        Kiểm tra payload qua toàn bộ pipeline.
        Sử dụng cơ chế phân tích URL bằng Heuristic.
        """
        if not isinstance(payload, str):
            payload = str(payload)

        # ── Bước 1: Chuẩn hóa payload ──────────────────────────────
        normalized = self.normalize_payload(payload)

        # ── Bước 2: Quét 5 nhóm luật Regex Tấn Công ────────────────
        for attack_type, patterns in MODSEC_RULES.items():
            if attack_type == "MALICIOUS_URL_PATTERNS":
                continue  # Bỏ qua Regex URL vì dùng Heuristic URL Validation

            for compiled_re in patterns:
                if compiled_re.search(normalized):
                    return {
                        "is_attack": True,
                        "attack_type": attack_type,
                        "matched_pattern": compiled_re.pattern[:120],
                        "urls_found": [],
                        "blocked_url": None,
                        "normalized": normalized[:200],
                    }

        # ── Bước 3: Tách URL và Phân tích Heuristic ────────────────
        urls_found = self.extract_urls(payload)
        urls_found_norm = self.extract_urls(normalized)
        all_urls = list(dict.fromkeys(urls_found + urls_found_norm))

        for url in all_urls:
            result = check_url_security(url)
            if not result["is_safe"]:
                return {
                    "is_attack": True,
                    "attack_type": result["attack_type"],
                    "matched_data": url,
                    # Bổ sung key để không làm hỏng frontend hiện tại
                    "matched_pattern": result["attack_type"],
                    "urls_found": all_urls,
                    "blocked_url": url,
                    "normalized": normalized[:200],
                }

        # ── Bước 4: Payload sạch ───────────────────────────────────
        return {
            "is_attack": False,
            "attack_type": None,
            "matched_pattern": None,
            "urls_found": all_urls,
            "blocked_url": None,
            "normalized": normalized[:200],
        }
