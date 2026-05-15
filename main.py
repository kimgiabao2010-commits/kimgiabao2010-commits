"""
main.py
-------
FastAPI application tích hợp WAF Layer 1 (ModSecurity Lite) + Deep Inspection.

Flow xử lý:
    Request POST /api/scan
        └─► Middleware WAF (waf_middleware)
                ├─► Đọc body JSON, lấy trường "text"
                ├─► waf_engine.inspect(text)
                │       ├─ normalize_payload()  → chống bypass encoding/comment
                │       ├─ OWASP_SQLi / OWASP_RFI rules
                │       ├─ extract_urls() + MALICIOUS_URL_PATTERNS
                │       └─ check_url_reputation() (domain blacklist)
                │
                ├─ is_attack=True  → log_alert + 403 BLOCKED_BY_WAF
                └─ is_attack=False → call_next (chuyển tiếp)
                        └─► Endpoint /api/scan
                                └─► Return {status: SUCCESS, waf_layer: CLEAN}
                                    (Frontend tự gọi FastText AI ở Bước 2)
"""

import json
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from waf.waf_engine import WafEngine
from waf.waf_logger import log_alert


# ---------------------------------------------------------------------------
# Schema cho Swagger UI
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    text: str

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"text": "Xin chào mọi người"},
            ]
        }
    }


# ---------------------------------------------------------------------------
# Khởi tạo ứng dụng và engine
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Multi-layer WAF",
    description=(
        "Layer 1: ModSecurity Lite (Rule-based) với normalize_payload chống bypass. "
        "Layer 2: FastText AI (gọi từ frontend sau khi qua WAF)."
    ),
    version="2.0.0",
)

# ── CORS: cho phép browser gọi API ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

waf_engine = WafEngine()

# ---------------------------------------------------------------------------
# Middleware WAF — Layer 1 (Deep Inspection)
# ---------------------------------------------------------------------------

@app.middleware("http")
async def waf_middleware(request: Request, call_next):
    """
    Middleware HTTP kiểm tra tất cả POST /api/scan request.

    Pipeline kiểm tra:
        1. normalize_payload() — giải mã encoding, xóa comment, thu gọn whitespace
        2. OWASP_SQLi, OWASP_RFI regex rules
        3. extract_urls() + MALICIOUS_URL_PATTERNS (shortener, punycode, phishing path)
        4. check_url_reputation() (domain blacklist)

    Với các request khác hoặc method không phải POST: pass-through.
    """
    # Chỉ inspect POST /api/scan
    if request.method == "POST" and request.url.path == "/api/scan":
        # Đọc raw body (phải lưu lại để FastAPI downstream còn đọc được)
        raw_body = await request.body()

        # Trích xuất trường "text" từ JSON body
        payload_text: str = ""
        try:
            body_json = json.loads(raw_body)
            payload_text = str(body_json.get("text", ""))
        except (json.JSONDecodeError, AttributeError):
            logging.getLogger("WAF").warning(
                "Could not parse JSON body from %s", request.client
            )

        # Kiểm tra payload với WAF Engine (defense-in-depth)
        if payload_text:
            result = waf_engine.inspect(payload_text)

            if result["is_attack"]:
                attack_type: str = result["attack_type"]
                log_alert(attack_type, payload_text)

                # Xây dựng response chi tiết để frontend hiển thị đúng
                response_body: dict = {
                    "status": "BLOCKED_BY_WAF",
                    "attack_type": attack_type,
                }

                # Thêm thông tin URL nếu bị chặn vì URL độc hại
                if attack_type == "SUSPICIOUS_URL" and result.get("blocked_url"):
                    response_body["blocked_url"] = result["blocked_url"]
                    response_body["detail"] = (
                        f"Phát hiện URL đáng ngờ: {result['blocked_url'][:80]}"
                    )

                response = JSONResponse(
                    status_code=403,
                    content=response_body,
                )
                
                # Bổ sung CORS header thủ công vì middleware chặn ngang sẽ bỏ qua CORSMiddleware
                origin = request.headers.get("origin")
                if origin:
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                else:
                    response.headers["Access-Control-Allow-Origin"] = "*"
                    
                response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "*"
                
                return response

    # Payload sạch hoặc route khác → chuyển tiếp bình thường
    response = await call_next(request)
    return response


# ---------------------------------------------------------------------------
# Endpoint /api/scan — trả về CLEAN sau khi qua WAF middleware
# ---------------------------------------------------------------------------

@app.post("/api/scan")
async def api_scan(body: ScanRequest):
    """
    Endpoint WAF Layer 1.

    Nếu request đến được đây, nghĩa là payload đã vượt qua toàn bộ
    pipeline kiểm tra trong waf_middleware (normalize → SQLi/RFI → URL check).

    Trả về trạng thái CLEAN để frontend biết WAF đã cho qua,
    rồi frontend tự gọi sang FastText AI (Bước 2) theo kiến trúc 2-step UI.

    Thiết kế này tách biệt trách nhiệm rõ ràng:
        - WAF (port 8000): Chặn tấn công kỹ thuật & URL lừa đảo
        - FastText AI (port 5001): Phân loại ngữ nghĩa lừa đảo
    """
    return {
        "status": "SUCCESS",
        "waf_layer": "CLEAN",
        "message": "Payload đã qua WAF. Sẵn sàng cho AI layer.",
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Kiểm tra trạng thái server và các thành phần."""
    return {
        "status": "ok",
        "waf_layer": 1,
        "version": "2.0.0",
        "features": [
            "normalize_payload (anti-bypass)",
            "OWASP_SQLi CRS v4.0",
            "OWASP_RFI CRS v4.0",
            "MALICIOUS_URL_PATTERNS",
            "domain_blacklist",
        ],
    }


# ---------------------------------------------------------------------------
# Chạy trực tiếp (dev mode)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
