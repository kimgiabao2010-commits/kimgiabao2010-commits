"""
main.py
-------
FastAPI application tích hợp WAF Layer 1 (ModSecurity Lite).

Flow xử lý:
    Request POST /api/scan
        └─► Middleware WAF
                ├─► Đọc body JSON, lấy trường "text"
                ├─► waf_engine.inspect(text)
                │       ├─ is_attack=True  → log_alert + 403 BLOCKED_BY_WAF
                │       └─ is_attack=False → call_next (chuyển tiếp bình thường)
                └─► Endpoint /api/scan → {"status": "AI_SCANNING"}
"""

import json
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
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
    description="Layer 1: ModSecurity Lite (Rule-based). Layer 2-3: AI models.",
    version="1.0.0",
)

waf_engine = WafEngine()

# ---------------------------------------------------------------------------
# Middleware WAF — Layer 1
# ---------------------------------------------------------------------------

@app.middleware("http")
async def waf_middleware(request: Request, call_next):
    """
    Middleware HTTP kiểm tra tất cả request.

    Chỉ hoạt động khi:
        - Method == POST
        - Path == /api/scan

    Với các request khác: pass-through (không kiểm tra).
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
            # Body không phải JSON hợp lệ → bỏ qua, tiếp tục xử lý bình thường
            logging.getLogger("WAF").warning(
                "Could not parse JSON body from %s", request.client
            )

        # Kiểm tra payload với WAF Engine
        if payload_text:
            result = waf_engine.inspect(payload_text)

            if result["is_attack"]:
                attack_type: str = result["attack_type"]
                log_alert(attack_type, payload_text)

                return JSONResponse(
                    status_code=403,
                    content={
                        "status": "BLOCKED_BY_WAF",
                        "attack_type": attack_type,
                    },
                )

    # Payload sạch hoặc route khác → chuyển tiếp bình thường
    response = await call_next(request)
    return response


# ---------------------------------------------------------------------------
# Dummy endpoint — kiểm tra pass-through của middleware
# ---------------------------------------------------------------------------

@app.post("/api/scan")
async def api_scan(body: ScanRequest):
    """
    Endpoint giả lập xử lý AI (Layer 2 & 3).

    Trả về {"status": "AI_SCANNING"} khi payload đã qua WAF Layer 1 thành công.
    """
    return {"status": "AI_SCANNING"}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Kiểm tra trạng thái server."""
    return {"status": "ok", "waf_layer": 1}


# ---------------------------------------------------------------------------
# Chạy trực tiếp (dev mode)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
