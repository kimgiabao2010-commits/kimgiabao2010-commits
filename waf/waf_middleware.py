"""
waf_middleware.py
=================
WAF Middleware – Protection & Prevention Layer

Đồ án: Building a Web Security Monitoring, Protection, Detection, and Prevention System
Chức năng: Đóng vai trò "người gác cổng" – kiểm tra request trước khi
           cho phép đi vào lõi AI phân tích.

Luồng xử lý:
    Client Request
        │
        ▼
    [1] IP Blacklist Check  ──► BLOCKED (403)
        │ OK
        ▼
    [2] Payload Scan        ──► BLOCKED (403) + Auto-Blacklist IP
        │ CLEAN
        ▼
    [3] SAFE → Pass to AI Core
"""

import csv
import os
from datetime import datetime

# ANSI color codes (hiển thị màu trên terminal)
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


class WAFMiddleware:
    """
    Web Application Firewall Middleware.

    Attributes:
        rules_path (str)   : Đường dẫn tới file CSV chứa các luật WAF.
        ip_blacklist (set) : Tập hợp IP bị khóa (O(1) lookup).
        rules (list[dict]) : Danh sách luật đã nạp vào RAM, mỗi phần tử
                             gồm {'type': str, 'payload': str}.
    """

    def __init__(self, rules_path: str = "security_payloads.csv"):
        """
        Khởi tạo WAFMiddleware.

        Args:
            rules_path: Đường dẫn tới file CSV chứa payload rules.
        """
        self.rules_path: str = rules_path
        self.ip_blacklist: set = set()          # Blacklist IP – O(1) lookup
        self.rules: list[dict] = []             # Rules nạp từ CSV vào RAM

        self.load_rules()

    # ------------------------------------------------------------------
    # LOAD RULES
    # ------------------------------------------------------------------
    def load_rules(self) -> None:
        """
        Đọc file security_payloads.csv và nạp toàn bộ luật vào RAM.
        Mỗi luật là một dict: {'type': <loại tấn công>, 'payload': <chuỗi độc>}
        Payload được lưu dạng lowercase để tăng tốc so khớp.
        """
        if not os.path.exists(self.rules_path):
            print(f"{YELLOW}[WAF][WARN] Rules file not found: {self.rules_path}{RESET}")
            return

        self.rules.clear()
        with open(self.rules_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.rules.append({
                    "type":    row["type"].strip(),
                    "payload": row["payload"].strip().lower(),   # lowercase 1 lần khi load
                })

        print(f"{CYAN}[WAF][INFO] Loaded {len(self.rules)} rules from '{self.rules_path}'{RESET}")

    # ------------------------------------------------------------------
    # ADD / REMOVE BLACKLIST
    # ------------------------------------------------------------------
    def block_ip(self, ip: str) -> None:
        """Thêm một IP vào Blacklist."""
        self.ip_blacklist.add(ip)

    def unblock_ip(self, ip: str) -> None:
        """Gỡ một IP khỏi Blacklist."""
        self.ip_blacklist.discard(ip)

    # ------------------------------------------------------------------
    # INSPECT REQUEST  ← điểm vào chính
    # ------------------------------------------------------------------
    def inspect_request(self, client_ip: str, user_input: str) -> dict:
        """
        Kiểm tra request theo 4 bước:

        Bước 1 – IP Blacklist Check:
            Nếu IP đã bị khóa → từ chối ngay (403).

        Bước 2 – Input Sanitization:
            Chuyển user_input về lowercase để so khớp không phân biệt hoa/thường.

        Bước 3 – Payload Scan:
            Duyệt toàn bộ rules, nếu phát hiện payload → auto-blacklist IP,
            in cảnh báo đỏ, trả về lỗi 403.

        Bước 4 – Safe Pass-Through:
            Không phát hiện gì → trả về trạng thái SAFE (cho phép đi vào AI core).

        Args:
            client_ip  : Địa chỉ IP của client gửi request.
            user_input : Dữ liệu đầu vào từ client (query, form, header, v.v.).

        Returns:
            dict với cấu trúc:
            {
                "status"  : "BLOCKED" | "SAFE",
                "code"    : 403 | 200,
                "reason"  : str,           # mô tả lý do (nếu bị chặn)
                "type"    : str | None,    # loại tấn công phát hiện
                "ip"      : str,           # client IP
                "input"   : str,           # input gốc
                "timestamp": str,          # thời điểm kiểm tra
            }
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # ── Bước 1: IP Blacklist Check ──────────────────────────────────
        if client_ip in self.ip_blacklist:
            print(
                f"{RED}{BOLD}[WAF][BLOCKED] {timestamp} | "
                f"IP {client_ip} is BLACKLISTED – Request denied (403){RESET}"
            )
            return {
                "status":    "BLOCKED",
                "code":      403,
                "reason":    "IP is blacklisted",
                "type":      "BLACKLISTED_IP",
                "ip":        client_ip,
                "input":     user_input,
                "timestamp": timestamp,
            }

        # ── Bước 2: Normalize input ─────────────────────────────────────
        normalized_input = user_input.lower()

        # ── Bước 3: Payload Scan ─────────────────────────────────────────
        for rule in self.rules:
            if rule["payload"] in normalized_input:
                attack_type = rule["type"]

                # Auto-blacklist IP ngay lập tức
                self.block_ip(client_ip)

                raw_input_snippet = str(user_input)[:120]  # type: ignore
                # In cảnh báo đỏ ra terminal
                print(
                    f"{RED}{BOLD}+------------------------------------------+\n"
                    f"|  [WAF][!! ALERT] ATTACK DETECTED!        |\n"
                    f"+------------------------------------------+{RESET}\n"
                    f"{RED}  Time      : {timestamp}\n"
                    f"  IP         : {client_ip}  -> AUTO-BLACKLISTED\n"
                    f"  Type       : {attack_type}\n"
                    f"  Payload    : {rule['payload']}\n"
                    f"  Raw Input  : {raw_input_snippet}{RESET}"
                )

                return {
                    "status":    "BLOCKED",
                    "code":      403,
                    "reason":    f"Malicious payload detected: {attack_type}",
                    "type":      attack_type,
                    "ip":        client_ip,
                    "input":     user_input,
                    "timestamp": timestamp,
                }

        # ── Bước 4: Safe – cho phép đi vào AI Core ──────────────────────
        print(
            f"{GREEN}[WAF][SAFE] {timestamp} | "
            f"IP {client_ip} – Input clean, forwarding to AI core.{RESET}"
        )
        return {
            "status":    "SAFE",
            "code":      200,
            "reason":    "No threats detected",
            "type":      None,
            "ip":        client_ip,
            "input":     user_input,
            "timestamp": timestamp,
        }


# ---------------------------------------------------------------------------
# Test Cases – Giả lập 3 kịch bản thực tế
# ---------------------------------------------------------------------------
if __name__ == "__main__":

    # Khởi tạo WAF và nạp luật từ file security_payloads.csv
    waf = WAFMiddleware(rules_path="security_payloads.csv")

    print("\n" + "=" * 60)
    print("  WAF MIDDLEWARE – TEST CASES")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Kich ban 1: User binh thuong gui cau hoi xin viec
    # Ket qua mong doi: SAFE (200) – cho phep di vao AI core
    # ------------------------------------------------------------------
    print("\n[KB-1] User binh thuong hoi viec lam...")
    ket_qua_1 = waf.inspect_request(
        client_ip  = "203.113.10.5",
        user_input = "Toi muon tim viec lam lap trinh vien Python tai Ha Noi"
    )
    print(f"  Ket qua: status={ket_qua_1['status']} | HTTP {ket_qua_1['code']}")

    # ------------------------------------------------------------------
    # Kich ban 2: Hacker IP '10.0.0.9' gui payload XSS
    # Ket qua mong doi: BLOCKED (403) + IP 10.0.0.9 bi tu dong them vao Blacklist
    # ------------------------------------------------------------------
    print("\n[KB-2] Hacker '10.0.0.9' tan cong XSS...")
    ket_qua_2 = waf.inspect_request(
        client_ip  = "10.0.0.9",
        user_input = "<script>alert(1)</script>"
    )
    print(f"  Ket qua: status={ket_qua_2['status']} | HTTP {ket_qua_2['code']}")
    print(f"  Ly do  : {ket_qua_2['reason']}")
    print(f"  Loai   : {ket_qua_2['type']}")
    print(f"  Blacklist hien tai: {waf.ip_blacklist}")

    # ------------------------------------------------------------------
    # Kich ban 3: Hacker '10.0.0.9' cay cu, gui tiep tin nhan binh thuong
    # Ket qua mong doi: BLOCKED (403) ngay lap tuc vi IP da nam trong Blacklist,
    #                   khong can quet payload nua (chặn tu cua)
    # ------------------------------------------------------------------
    print("\n[KB-3] Hacker '10.0.0.9' gui tiep tin nhan binh thuong (da bi khoa)...")
    ket_qua_3 = waf.inspect_request(
        client_ip  = "10.0.0.9",
        user_input = "Chao, toi chi muon hoi ve cong viec thoi."
    )
    print(f"  Ket qua: status={ket_qua_3['status']} | HTTP {ket_qua_3['code']}")
    print(f"  Ly do  : {ket_qua_3['reason']}")

    print("\n" + "=" * 60)
    print("  TONG KET")
    print("=" * 60)
    print(f"  KB-1 (User binh thuong) : {ket_qua_1['status']} {ket_qua_1['code']}")
    print(f"  KB-2 (XSS Attack)       : {ket_qua_2['status']} {ket_qua_2['code']}"
          f" | Type: {ket_qua_2['type']}")
    print(f"  KB-3 (IP da bi khoa)    : {ket_qua_3['status']} {ket_qua_3['code']}"
          f" | Ly do: {ket_qua_3['reason']}")
    print("=" * 60 + "\n")
