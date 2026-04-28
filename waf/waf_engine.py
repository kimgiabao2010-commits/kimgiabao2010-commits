"""
waf/waf_engine.py
-----------------
Core Logic — WafEngine class.

Inspect payload bằng cách duyệt qua MODSEC_RULES theo thứ tự:
  - First-match: khi phát hiện vi phạm đầu tiên thì dừng ngay.
  - Trả về dict chuẩn: is_attack, attack_type, matched_pattern.
"""

from __future__ import annotations

from typing import Optional
from waf.modsec_rules_set import MODSEC_RULES


class WafEngine:
    """
    Layer 1 WAF Engine dựa trên rule-based regex.

    Sử dụng:
        engine = WafEngine()
        result = engine.inspect("SELECT * FROM users")
    """

    def inspect(self, payload: str) -> dict:
        """
        Kiểm tra payload với tập luật MODSEC_RULES.

        Tham số:
            payload (str): Chuỗi cần kiểm tra (nội dung body, query, v.v.)

        Trả về:
            dict với 3 trường:
                - is_attack      (bool)         : True nếu phát hiện tấn công.
                - attack_type    (str | None)    : Tên loại tấn công hoặc None.
                - matched_pattern(str | None)    : Pattern đã match hoặc None.
        """
        if not isinstance(payload, str):
            # Phòng trường hợp gọi nhầm kiểu dữ liệu — chuyển về str an toàn
            payload = str(payload)

        for attack_type, patterns in MODSEC_RULES.items():
            for compiled_re in patterns:
                match = compiled_re.search(payload)
                if match:
                    return {
                        "is_attack": True,
                        "attack_type": attack_type,
                        "matched_pattern": compiled_re.pattern,
                    }

        # Không có pattern nào khớp → payload sạch
        return {
            "is_attack": False,
            "attack_type": None,
            "matched_pattern": None,
        }
