"""
waf/modsec_rules_set.py
-----------------------
ModSecurity Lite Ruleset — Layer 1 WAF.

Tất cả regex được thiết kế ReDoS-safe:
  - Không dùng nested quantifier (e.g. (a+)+)
  - Không dùng alternation kết hợp với quantifier lồng nhau
  - Dùng re.IGNORECASE | re.ASCII để giới hạn phạm vi khớp
"""

import re
from typing import Dict, Pattern

# ---------------------------------------------------------------------------
# Helper: biên dịch sẵn để tái sử dụng (compiled once, used many times)
# ---------------------------------------------------------------------------

def _c(pattern: str) -> "re.Pattern[str]":
    """Compile với IGNORECASE + ASCII để an toàn và nhanh hơn."""
    return re.compile(pattern, re.IGNORECASE | re.ASCII)


# ---------------------------------------------------------------------------
# MODSEC_RULES
# key   : tên loại tấn công (attack_type)
# value : list[re.Pattern] — danh sách các pattern biên dịch sẵn
# ---------------------------------------------------------------------------

MODSEC_RULES: Dict[str, "list[re.Pattern[str]]"] = {

    # -----------------------------------------------------------------------
    # 1. SQL Injection
    #    - Keywords SQL phổ biến
    #    - Boolean inference: ' OR 1=1, ' OR '1'='1
    #    - Inline comment: -- , #, /*!...*/
    # -----------------------------------------------------------------------
    "SQL_Injection": [
        # Từ khóa SQL cơ bản (dùng \b để khớp từ nguyên vẹn, tránh FP)
        _c(r"\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|EXEC|EXECUTE|UNION|HAVING|CAST|CONVERT)\b"),

        # Boolean inference: dấu nháy đơn + OR/AND + giá trị
        # Ví dụ: ' OR 1=1, ' OR 'a'='a
        # Pattern tuyến tính, không nested quantifier
        _c(r"'\s{0,10}(OR|AND)\s{0,10}[\w']{1,20}\s{0,5}=\s{0,5}[\w']{1,20}"),

        # Inline SQL comment: -- hoặc # (comment kiểu MySQL)
        _c(r"(-{2,}|#)\s{0,5}\w{0,30}$"),

        # Block comment kiểu C: /* ... */ — giới hạn độ dài nội dung 0-50 ký tự
        _c(r"/\*[\w\s=',]{0,50}\*/"),

        # SLEEP/BENCHMARK (Time-based blind SQLi)
        _c(r"\b(SLEEP|BENCHMARK|WAITFOR\s+DELAY)\s*\("),

        # Stacked queries: dấu chấm phẩy trước keyword SQL
        _c(r";\s{0,5}\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b"),
    ],

    # -----------------------------------------------------------------------
    # 2. XSS Attack
    #    - Thẻ <script>, onXxx event handlers
    #    - javascript: URI scheme
    #    - Các thẻ nguy hiểm: <iframe>, <img>, <svg>, <object>, <embed>
    # -----------------------------------------------------------------------
    "XSS_Attack": [
        # <script ...> hoặc </script>
        _c(r"<\s{0,5}script[\s>]"),
        _c(r"<\s{0,5}/\s{0,5}script\s{0,5}>"),

        # javascript: (trong href, src, v.v.)
        _c(r"javascript\s{0,5}:"),

        # Event handler trực tiếp: on + tên sự kiện + =
        # Giới hạn tên sự kiện 3-20 ký tự, tránh backtrack
        _c(r"\bon[a-z]{3,20}\s{0,5}="),

        # Thẻ nguy hiểm phổ biến
        _c(r"<\s{0,5}(iframe|object|embed|applet|base|form|input|link|meta)[\s/>]"),

        # <img src=x onerror=...> — kết hợp thẻ img với event handler
        _c(r"<\s{0,5}img[^>]{0,100}onerror\s{0,5}="),

        # <svg onload=...>
        _c(r"<\s{0,5}svg[^>]{0,100}onload\s{0,5}="),

        # data: URI (base64 payload nhúng)
        _c(r"data\s{0,5}:\s{0,5}text/html"),

        # HTML entity encoding bypass cơ bản: &#x / &#
        _c(r"&#x?[0-9a-f]{1,6};"),
    ],

    # -----------------------------------------------------------------------
    # 3. OS Command Injection
    #    - Command separator: ; | && || `
    #    - Common binaries: ls, cat, wget, curl, bash, sh, nc, python, perl
    # -----------------------------------------------------------------------
    "OS_Command_Injection": [
        # Command separator + khoảng trắng tùy chọn + binary phổ biến
        # Tuyến tính: separator rồi binary, không lồng quantifier
        _c(r"[;|`]\s{0,10}\b(ls|cat|wget|curl|bash|sh|nc|netcat|python|perl|ruby|php|id|whoami|uname|pwd)\b"),

        # && hoặc || + binary
        _c(r"&&\s{0,10}\b(ls|cat|wget|curl|bash|sh|nc|netcat|python|perl|ruby|php|id|whoami|uname|pwd)\b"),
        _c(r"\|\|\s{0,10}\b(ls|cat|wget|curl|bash|sh|nc|netcat|python|perl|ruby|php|id|whoami|uname|pwd)\b"),

        # Backtick command substitution: `cmd`
        _c(r"`[^`]{1,80}`"),

        # $() command substitution
        _c(r"\$\([^)]{1,80}\)"),

        # /bin/ hoặc /usr/bin/ path trực tiếp
        _c(r"/(bin|usr/bin|sbin|usr/sbin)/[a-z]{1,20}"),
    ],

    # -----------------------------------------------------------------------
    # 4. Path Traversal
    #    - ../  ..\  (%2e%2e%2f encoded)
    #    - Các file nhạy cảm: /etc/passwd, /etc/shadow, boot.ini, win.ini
    # -----------------------------------------------------------------------
    "Path_Traversal": [
        # ../ hoặc ..\ (Unix/Windows)
        _c(r"\.\.[/\\]"),

        # URL-encoded: %2e%2e%2f hoặc %2e%2e%5c
        _c(r"%2e{1,2}%2[ef]"),

        # Double-encoded: ..%2f hoặc ..%5c
        _c(r"\.\.((%2f)|(%5c))"),

        # File nhạy cảm Linux
        _c(r"/etc/(passwd|shadow|hosts|group|sudoers|ssh/sshd_config)"),

        # File nhạy cảm Windows
        _c(r"(boot\.ini|win\.ini|system\.ini|ntds\.dit)"),

        # Traversal tuyệt đối tới thư mục hệ thống Windows
        _c(r"[Cc]:\\(windows|winnt|system32|users)\\"),
    ],
}
