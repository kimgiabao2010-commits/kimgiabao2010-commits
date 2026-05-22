"""
waf/scam_pattern_engine.py — Tầng Rule-Based Scam Pattern Detector
===================================================================
Chạy song song với AI. Phân tích TEXT GỐC (chưa qua preprocess).
Nhắm đặc biệt vào scam diễn đàn nơi AI dễ bỏ sót:
  - Scam tuyển CTV / làm việc tại nhà
  - Scam trúng thưởng / quà tặng
  - Scam giả mạo ngân hàng / OTP
  - Scam cờ bạc / cá cược
  - Scam đầu tư tiền ảo
  - Scam hải quan / nhận hàng
  - Tổng hợp tín hiệu tiền + hành động + khẩn cấp

Trả về:
  {
    "is_scam": bool,
    "confidence": float (0.0 – 1.0),
    "matched_rules": list[str],
    "risk_score": int (0–100),
  }
"""

import re
from typing import Any

# ─── Tập hợp các quy tắc Rule-Based ───────────────────────────────────────────
# Mỗi rule là (tên_rule, regex_pattern, điểm_rủi_ro, mô_tả)
# Điểm rủi ro 1–30 mỗi rule. Tổng >= 50 → SCAM

SCAM_RULES: list[tuple[str, str, int, str]] = [
    # === NHÓM 1: Tuyển CTV / Làm việc tại nhà (rất phổ biến trên diễn đàn) ===
    ("CTV_NO_DEPOSIT",
     r"(?:ctv|cộng\s*tác\s*viên).{0,60}(?:không\s*(?:cần\s*)?cọc|0\s*đồng\s*cọc|free|miễn\s*phí)",
     35, "Tuyển CTV không cọc"),

    ("WORK_FROM_HOME_INCOME",
     r"(?:làm\s*tại\s*nhà|work\s*from\s*home|làm\s*online).{0,80}"
     r"(?:\d+[k.]\d*\s*(?:triệu|tr|đồng|vnđ|đ)|(?:triệu|tr)\s*/?\s*(?:ngày|tháng|tuần))",
     30, "Làm tại nhà thu nhập khủng"),

    ("SHOP_TASK_SCAM",
     r"(?:chốt\s*đơn|click\s*đơn|like\s*đơn|tương\s*tác).{0,50}"
     r"(?:shopee|lazada|tiki|sendo).{0,50}"
     r"(?:hoa\s*hồng|commission|lãi|kiếm)",
     30, "Scam chốt đơn sàn TMĐT"),

    # === NHÓM 2: Trúng thưởng / Quà tặng giả ===
    ("PRIZE_WIN",
     r"(?:chúc\s*mừng|congratulation).{0,80}"
     r"(?:trúng\s*thưởng|trúng\s*giải|nhận\s*thưởng|trúng\s*xe|nhận\s*xe)",
     40, "Trúng thưởng giả mạo"),

    ("PRIZE_ACTION",
     r"(?:trúng\s*thưởng|trúng\s*giải|phần\s*thưởng|quà\s*tặng).{0,100}"
     r"(?:nạp\s*thẻ|chuyển\s*khoản|nộp\s*phí|đóng\s*phí|bấm\s*vào|click|nhấp)",
     45, "Trúng thưởng + yêu cầu thanh toán"),

    ("PRIZE_DEADLINE",
     r"(?:trúng\s*thưởng|phần\s*thưởng).{0,60}"
     r"(?:trong\s*\d+\s*(?:giờ|phút|ngày)|hết\s*hạn|sắp\s*hết|ngay\s*bây\s*giờ|khẩn)",
     30, "Trúng thưởng + giới hạn thời gian"),

    # === NHÓM 3: Giả mạo Ngân hàng / OTP ===
    ("BANK_FAKE_VERIFY",
     r"(?:tài\s*khoản|account).{0,50}"
     r"(?:đăng\s*nhập\s*(?:thiết\s*bị\s*)?lạ|bị\s*(?:khóa|tạm\s*khóa|khoá|vô\s*hiệu)|đăng\s*nhập\s*sai)",
     35, "Giả mạo cảnh báo ngân hàng"),

    ("OTP_PHISHING",
     r"(?:nhập|cung\s*cấp|gửi|xác\s*nhận).{0,30}(?:mã\s*otp|otp|mã\s*xác\s*minh|mã\s*xác\s*nhận|mã\s*bảo\s*mật).{0,50}"
     r"(?:để\s*(?:xác|hủy|hoàn|khôi)|nhằm\s*|không\s*tiết\s*lộ)",
     40, "Yêu cầu OTP giả mạo"),

    ("BANK_LINK_FAKE",
     r"(?:vietcombank|techcombank|bidv|vpbank|mbbank|acb|sacombank|tpbank|agribank).{0,80}"
     r"(?:\.(?:tk|ml|xyz|club|top|click|online|site|info|cc)|/(?:login|verify|xac-thuc|update))",
     50, "Link ngân hàng giả mạo"),

    # === NHÓM 4: Cờ bạc / Cá cược ===
    ("GAMBLING_INVITE",
     r"(?:cá\s*cược|casino|baccarat|slot|nổ\s*hũ|tài\s*xỉu|xóc\s*đĩa|bắn\s*cá).{0,80}"
     r"(?:tham\s*gia|đăng\s*ký|nạp\s*(?:ngay|tiền)|kiếm\s*tiền|thắng\s*lớn|rút\s*(?:tiền|thưởng))",
     40, "Mời gọi cờ bạc/cá cược"),

    ("GAMBLING_BONUS",
     r"(?:188bet|w88|fun88|fb88|m88|bet88|vwin|jun88|new88|shbet|kubet|ok9).{0,60}"
     r"(?:tặng|thưởng|bonus|khuyến\s*mãi|nạp|đăng\s*ký)",
     45, "Khuyến mãi cá cược trực tuyến"),

    # === NHÓM 5: Đầu tư tiền ảo / Tài chính giả ===
    ("CRYPTO_SCAM",
     r"(?:đầu\s*tư|lợi\s*nhuận|profit|thu\s*nhập\s*thụ\s*động).{0,80}"
     r"(?:tiền\s*(?:ảo|điện\s*tử)|bitcoin|btc|eth|usdt|crypto).{0,60}"
     r"(?:\d+%|\d+\s*lần|\d+x|khủng|không\s*(?:rủi\s*ro|rủiro))",
     40, "Đầu tư tiền ảo hứa hẹn lợi nhuận cao"),

    ("INVESTMENT_GUARANTEED",
     r"(?:đảm\s*bảo|cam\s*kết|chắc\s*chắn).{0,50}"
     r"(?:lợi\s*nhuận|profit|lãi|hoàn\s*vốn).{0,50}"
     r"(?:\d+%|\d+\s*triệu|\d+\s*lần)",
     35, "Đầu tư đảm bảo lợi nhuận"),

    ("PONZI_PATTERN",
     r"(?:giới\s*thiệu|mời|ref(?:erral)?).{0,60}"
     r"(?:hoa\s*hồng|commission|thưởng|bonus).{0,60}"
     r"(?:cấp\s*(?:dưới|trên)|tầng|tier|level)",
     35, "Mô hình đa cấp / Ponzi"),

    # === NHÓM 6: Hải quan / Nhận hàng giả ===
    ("CUSTOMS_SCAM",
     r"(?:hải\s*quan|nhân\s*viên\s*hải\s*quan|kiện\s*hàng|gói\s*hàng|bưu\s*kiện).{0,100}"
     r"(?:phí|nộp|chuyển\s*khoản|đóng|thanh\s*toán).{0,50}"
     r"(?:thông\s*quan|nhận\s*hàng|giải\s*phóng|clearance)",
     50, "Scam giả danh hải quan"),

    # === NHÓM 7: Tín hiệu tiền + khẩn cấp tổng hợp ===
    ("MONEY_URGENCY",
     r"(?:chuyển\s*khoản|nạp\s*thẻ|nộp\s*tiền|gửi\s*tiền).{0,40}"
     r"(?:ngay|gấp|khẩn|nhanh|liền|lập\s*tức|ngay\s*bây\s*giờ)",
     30, "Yêu cầu chuyển tiền khẩn cấp"),

    ("HIGH_INCOME_UNREALISTIC",
     r"(?:kiếm|thu\s*nhập|lương|hoa\s*hồng).{0,30}"
     r"(?:\d{3,}(?:\.\d{3})*\s*(?:đồng|đ|vnđ)|[1-9]\d*\s*(?:triệu|tr)\s*/?\s*(?:ngày|tháng|tuần|ca|buổi))",
     20, "Thu nhập bất thường"),

    ("URGENCY_SIGNAL",
     r"(?:chỉ\s*còn|chỉ\s*có|giới\s*hạn|limited|hết\s*slot|slot\s*còn).{0,30}"
     r"(?:\d+\s*(?:suất|slot|chỗ)|hết\s*hạn|sắp\s*đầy)",
     20, "Tạo sự khan hiếm giả"),
]


def analyze_scam_patterns(text: str) -> dict[str, Any]:
    """
    Phân tích text bằng bộ quy tắc Rule-Based.
    Trả về dict kết quả với is_scam, confidence, matched_rules, risk_score.
    Chạy trên TEXT GỐC — không qua preprocess.
    """
    if not text or not isinstance(text, str):
        return {"is_scam": False, "confidence": 0.0, "matched_rules": [], "risk_score": 0}

    text_lower = text.lower()
    matched_rules: list[str] = []
    total_score: int = 0

    for rule_name, pattern, score, description in SCAM_RULES:
        try:
            if re.search(pattern, text_lower, re.IGNORECASE | re.UNICODE):
                matched_rules.append(f"{rule_name}: {description}")
                total_score += score
        except re.error:
            continue

    # Normalize score to 0–100
    risk_score = min(total_score, 100)

    # Confidence scale: 0 → 0.0, 50 → 0.75, 80+ → 0.95+
    if risk_score == 0:
        confidence = 0.0
    elif risk_score < 30:
        confidence = 0.3 + (risk_score / 30) * 0.2   # 0.30 – 0.50
    elif risk_score < 50:
        confidence = 0.50 + (risk_score - 30) / 20 * 0.25   # 0.50 – 0.75
    elif risk_score < 80:
        confidence = 0.75 + (risk_score - 50) / 30 * 0.20   # 0.75 – 0.95
    else:
        confidence = 0.95 + min((risk_score - 80) / 20 * 0.04, 0.04)  # 0.95 – 0.99

    is_scam = risk_score >= 40  # Ngưỡng: >= 40 điểm → SCAM

    return {
        "is_scam": is_scam,
        "confidence": round(confidence, 4),
        "matched_rules": matched_rules,
        "risk_score": risk_score,
    }
