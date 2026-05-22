"""
waf/waf_rules_set.py
-----------------------
OWASP Core Rule Set (CRS) v4.0 — Layer 1 WAF.

Các Regex được chọn lọc từ 5 file cốt lõi của CRS v4.0 để tối ưu hiệu suất Python:
  - REQUEST-930-APPLICATION-ATTACK-LFI.conf
  - REQUEST-931-APPLICATION-ATTACK-RFI.conf
  - REQUEST-932-APPLICATION-ATTACK-RCE.conf
  - REQUEST-941-APPLICATION-ATTACK-XSS.conf
  - REQUEST-942-APPLICATION-ATTACK-SQLI.conf

Đã được tối ưu để tránh lỗi Regular Expression Denial of Service (ReDoS).
"""

import re
from typing import Dict, List

# ---------------------------------------------------------------------------
# Helper: biên dịch sẵn để tái sử dụng (compiled once, used many times)
# ---------------------------------------------------------------------------

def _c(pattern: str) -> "re.Pattern[str]":
    """Compile với IGNORECASE để đồng nhất với CRS transform."""
    return re.compile(pattern, re.IGNORECASE)

# ---------------------------------------------------------------------------
# WAF_RULES
# key   : tên attack_type (giữ nguyên để waf_engine.py & waf_middleware.py dùng)
# value : list[re.Pattern] — top patterns trích từ CRS, sắp xếp theo hiệu suất
# ---------------------------------------------------------------------------

WAF_RULES: Dict[str, "List[re.Pattern[str]]"] = {

    # -----------------------------------------------------------------------
    # OWASP_LFI — Local File Inclusion & Path Traversal
    # Nguồn: REQUEST-930-APPLICATION-ATTACK-LFI.conf
    # Chặn duyệt thư mục (../), truy cập file hệ thống Linux/Windows, null byte.
    # -----------------------------------------------------------------------
    "OWASP_LFI": [
        # Chặn Path Traversal cơ bản: ../ hoặc .../ hoặc tương đương
        _c(r"(?:^|/|\\|\.\.)\.{2,3}(?:/|\\|%2f|%5c)"),
        
        # Chặn truy cập file hệ thống Linux phổ biến
        _c(r"/etc/(?:passwd|shadow|group|hosts|issue|motd|fstab|crontab)"),
        _c(r"/var/(?:log|adm|spool)/"),
        _c(r"/proc/(?:self|sys|net|cpuinfo|meminfo|version|mounts)"),
        _c(r"/(?:dev|sys|usr/lib)/"),

        # Chặn truy cập file cấu hình Windows phổ biến
        _c(r"windows/(?:win\.ini|system32/|repair/sam|panther/)"),
        _c(r"(?:boot\.ini|autoexec\.bat|config\.sys)"),

        # Chặn bypass bằng wrappers cục bộ (LFI)
        _c(r"(?:file|zip|zlib|bzip2|glob|ogg|phar|rar)://"),
        _c(r"php://(?:filter|input|stdin|memory|temp)"),
        
        # Chặn Null Byte (%00) dù đã normalize vẫn quét dự phòng
        _c(r"%00|\x00"),
    ],

    # -----------------------------------------------------------------------
    # OWASP_RFI — Remote File Inclusion
    # Nguồn: REQUEST-931-APPLICATION-ATTACK-RFI.conf
    # Chặn chèn URL ngoài, các protocol nguy hiểm.
    # -----------------------------------------------------------------------
    "OWASP_RFI": [
        # Chặn URL chứa địa chỉ IP tuyệt đối (IPv4 & IPv6)
        _c(r"^(?:file|ftps?|https?)://(?:\[?[0-9a-f]+:[0-:a-f]+\]?|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})"),

        # Tham số phổ biến bị RFI: include, mosConfig, path...
        _c(r"(?:\binclude\s*\([^\)]*|mosConfig_absolute_path|_(?:CONF\[path|SERVER\[DOCUMENT_ROOT))=(?:file|ftps?|https?)://"),

        # URL scheme bất thường / RFI protocol
        _c(r"(?:^|[\s\"'=,\(])(?:url|jar):(?:ftp|https?)://"),
        _c(r"(?:expect|data|dict|gopher|ldap|tftp|ssrf)://"),

        # URL với trailing question mark '?'
        _c(r"^(?:file|ftps?|https?).*?\?+$"),
    ],

    # -----------------------------------------------------------------------
    # OWASP_RCE — Remote Command Execution
    # Nguồn: REQUEST-932-APPLICATION-ATTACK-RCE.conf
    # Chặn thực thi lệnh shell, PowerShell, lạm dụng nhị phân hệ thống.
    # -----------------------------------------------------------------------
    "OWASP_RCE": [
        # Lệnh thu thập thông tin hệ thống và mạng
        _c(r"\b(?:whoami|uname|ifconfig|ipconfig|netstat|ping|traceroute|nslookup|dig|arp)\b"),
        
        # Công cụ tải file và network shell
        _c(r"\b(?:curl|wget|fetch|lwp-download|lwp-request|nc|netcat|nmap|socat)\b"),
        
        # Shell invocation
        _c(r"\b(?:bash|sh|csh|tcsh|zsh|dash|ash|ksh|powershell|pwsh|cmd)\s*(?:-i|-c|-e|-Command)"),
        
        # Các trình thông dịch thường dùng để RCE
        _c(r"\b(?:python(?:2|3)?|perl|ruby|php|awk|sed)\s*(?:-e|-r|-c)"),
        
        # Hàm thực thi mã phổ biến trong PHP/Node/Python
        _c(r"\b(?:system|exec|passthru|shell_exec|popen|proc_open|eval|assert|create_function|call_user_func)\s*\("),
        
        # Chặn kết nối đảo chiều (Reverse Shell) qua /dev/tcp hoặc /dev/udp
        _c(r"/dev/(?:tcp|udp)/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,5}"),
        
        # Thao tác file nguy hiểm
        _c(r"\b(?:chmod|chown|chgrp|rm\s+-rf|mv\s+.*?/tmp)\b"),
        
        # Lệnh lồng nhau (Command Substitution / Chaining)
        _c(r"(?:;|\&\&|\|\||\||\n|\r)\s*(?:whoami|id|uname|ifconfig|ipconfig|netstat|ping|curl|wget)\b"),
        _c(r"`\s*(?:whoami|id|uname|ifconfig|ipconfig|netstat|ping|curl|wget)\s*`"),
        _c(r"\$\(\s*(?:whoami|id|uname|ifconfig|ipconfig|netstat|ping|curl|wget)\s*\)"),
    ],

    # -----------------------------------------------------------------------
    # OWASP_XSS — Cross-Site Scripting
    # Nguồn: REQUEST-941-APPLICATION-ATTACK-XSS.conf
    # Chặn thẻ script, event handlers, javascript protocol.
    # -----------------------------------------------------------------------
    "OWASP_XSS": [
        # Script tags (nắm bắt các biến thể của <script>)
        _c(r"<\s*script[^>]*>[\s\S]*?(?:<\s*/\s*script\s*>|$)"),
        _c(r"<\s*script[^>]*>"),
        
        # JavaScript/VBScript Pseudo-protocols
        _c(r"(?:javascript|vbscript|data|jscript):"),
        
        # HTML Event Handlers (onerror, onload, onclick, v.v.)
        _c(r"\bon(?:error|load|click|mouseover|focus|blur|hashchange|submit|keydown|keyup|keypress|mouseenter|mouseleave|change|abort)\s*="),
        
        # Các thẻ HTML nhạy cảm thường dùng trong XSS
        _c(r"<\s*(?:iframe|object|embed|applet|meta|svg|base|link|style)[^>]*>"),
        
        # Truy cập Document/Window objects
        _c(r"\bdocument\.(?:cookie|location|write|URL|documentURI|domain)\b"),
        _c(r"\bwindow\.(?:location|name|eval|setTimeout|setInterval)\b"),
        
        # Hàm thực thi mã JS nguy hiểm
        _c(r"\b(?:eval|alert|prompt|confirm|atob|btoa)\s*\("),
        
        # Inline CSS expression (IE cũ) và JS trong URL/CSS
        _c(r"expression\s*\("),
        _c(r"url\s*\(\s*['\"]?(?:javascript|data):"),
    ],

    # -----------------------------------------------------------------------
    # OWASP_SQLi — SQL Injection
    # Nguồn: REQUEST-942-APPLICATION-ATTACK-SQLI.conf
    # Chặn các cú pháp SQL nguy hiểm, Time-based, Boolean-based, Error-based.
    # -----------------------------------------------------------------------
    "OWASP_SQLi": [
        # SQL Injection cơ bản: SELECT ... FROM, UNION SELECT, INSERT INTO...
        _c(r"\b(?:select\b.{1,40}\bfrom\b|union\b.{1,15}\bselect\b|insert\b.{1,15}\binto\b|update\b.{1,40}\bset\b|delete\b.{1,15}\bfrom\b)"),
        
        # UNION SELECT và ORDER BY injection
        _c(r"(?:'[\s\x0b]*)?(?:union[\s\x0b]+(?:all[\s\x0b]+)?select|order[\s\x0b]+by)[\s\x0b]+"),
        
        # Boolean-based SQLi (OR 1=1, AND 1=1)
        _c(r"(?:'[\s\x0b]*|\b)(?:or|and)[\s\x0b]+(?:'[^']*'[\s\x0b]*=[\s\x0b]*'|[0-9]+[\s\x0b]*=[\s\x0b]*[0-9]|[0-9]+[\s\x0b]*--)"),
        
        # Stacked queries (Thực thi nhiều lệnh)
        _c(r";[\s\x0b]*\b(?:drop|truncate|delete|insert|update|alter|create)\b"),
        
        # Nhắm mục tiêu Schema/Metadata
        _c(r"\b(?:information_schema|pg_catalog|mysql\.db|sysobjects|sysdatabases|sqlite_master)\b"),
        
        # Time-based SQLi (Blind)
        _c(r"\b(?:sleep|benchmark|waitfor\s+delay|pg_sleep)\s*\("),
        
        # Các hàm thao tác chuỗi/hex để bypass
        _c(r"\b(?:concat|concat_ws|group_concat|substring|substr|mid|ascii|hex|bin|char)\s*\("),
        
        # Lệnh nguy hiểm (MSSQL xp_cmdshell, MySQL INTO OUTFILE)
        _c(r"\b(?:exec(?:ute)?|xp_cmdshell|sp_executesql)\b"),
        _c(r"into\s+(?:outfile|dumpfile)"),
        
        # Conditional / Logic Bypass
        _c(r"[\s\x0b\(\)]case[\s\x0b]+when.*?then"),
        _c(r"select.*?having[\s\x0b]*?[^\s\x0b]+"),
        
        # SQL Comment Bypass (MySQL /*!50000 ... */)
        _c(r"/\*!\d{5}.*?\*/"),
    ],

    # -----------------------------------------------------------------------
    # MALICIOUS_URL_PATTERNS — URL Inspection Layer
    # Nhận diện URL rút gọn, homograph/punycode, và từ khóa lừa đảo trong path.
    # Được áp dụng CHỈ trên các URL được extract_urls() tách ra từ payload.
    # -----------------------------------------------------------------------
    "MALICIOUS_URL_PATTERNS": [
        # --- URL Rút gọn (Link Shortener) ---
        _c(
            r"https?://(?:www\.)?"
            r"(?:bit\.ly|tinyurl\.com|t\.co|ow\.ly|goo\.gl|rb\.gy|is\.gd|"
            r"shorturl\.at|cutt\.ly|tiny\.cc|s\.id|v\.gd|shorte\.st|"
            r"adf\.ly|linktr\.ee|buff\.ly|trib\.al|su\.pr|snip\.ly|"
            r"bl\.ink|lnkd\.in|bcool\.bz|bit\.do|lc\.cx|q\.gs|"
            r"1url\.com|2\.gp|4sq\.com|clck\.ru|filoops\.info|"
            r"redd\.it|yourls\.org|po\.st|2u\.pw|zi\.ma|bc\.vc)"
            r"(?:/[^\s]*)?"
        ),

        # --- Punycode / Homograph Attack ---
        _c(r"https?://(?:[a-z0-9-]*\.)*xn--[a-z0-9-]+\.[a-z]{2,}"),

        # Unicode lookalike characters trong hostname
        _c(r"https?://[^\s/]*[^\x00-\x7F][^\s/]*(?:\.[a-z]{2,})+"),

        # --- Phishing Path Keywords ---
        _c(
            r"https?://[^\s/]+/"
            r"[^\s]*(?:"
            r"login[\-_]?verify|"
            r"account[\-_]?update|"
            r"secure[\-_]?signin|"
            r"banking[\-_]?auth|"
            r"verify[\-_]?identity|"
            r"confirm[\-_]?payment|"
            r"password[\-_]?reset[\-_]?confirm|"
            r"two[\-_]?factor[\-_]?auth|"
            r"security[\-_]?check[\-_]?required|"
            r"unlock[\-_]?account|"
            r"suspended[\-_]?account|"
            r"urgent[\-_]?action[\-_]?required|"
            r"apple[\-_]?id[\-_]?locked|"
            r"paypal[\-_]?resolution|"
            r"netflix[\-_]?billing"
            r")[^\s]*"
        ),

        # --- Domain giả mạo thương hiệu lớn với subdomain thêm vào ---
        _c(
            r"https?://(?:[a-z0-9-]+\.)+"
            r"(?:paypal|apple|google|facebook|microsoft|amazon|netflix|"
            r"bankofamerica|wellsfargo|chase|citibank|hsbc|techcombank|"
            r"vietcombank|bidv|vpbank|mbbank|acb|sacombank|tpbank)"
            r"\.[a-z]{2,}\."  # tên thương hiệu KHÔNG phải TLD cuối cùng → giả mạo
            r"(?!(?:com|org|net|vn|io|co)\b)"  # loại trừ domain thật hợp lệ
        ),

        # --- IP Address trực tiếp (không phải domain) ---
        _c(
            r"https?://(?:\d{1,3}\.){3}\d{1,3}"
            r"(?::\d{1,5})?"
            r"(?:/[^\s]*)?"
        ),
    ],
}
