"""
main.py
-------
Centralized SWG Gateway Orchestrator — 4-Layer Architecture.

Pipeline xử lý tại POST /api/scan:
    ┌──────────────────────────────────────────────────────────────────┐
    │  REQUEST từ Chrome Extension                                     │
    └─────────────────────────┬────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Layer 1: WAF      │  waf_middleware (rule-based,
                    │  (waf_engine)      │  normalize_payload anti-bypass)
                    └─────────┬──────────┘
                   BLOCKED    │  CLEAN
                    ◄──────   │
               HTTP 403       │
          BLOCKED_BY_WAF      ▼
                    ┌─────────────────────┐
                    │  Layer 2: FastText  │  POST http://localhost:5001/predict
                    │  (ngữ nghĩa nhanh)  │
                    └─────────┬───────────┘
                              │
               ┌──────────────┼──────────────────┐
          confidence          │              confidence
          > 0.75              │              0.4 – 0.75
          (rõ ràng)           │              (mập mờ)
               │              │                   │
               ▼              │                   ▼
          Trả về kết          │         ┌──────────────────────┐
          quả ngay            │         │  Layer 3: DistilBERT  │
                              │         │  (phân tích sâu)      │
                              │         └──────────┬───────────┘
                              │                    │
                              └────────────────────┘
                                         │
                                         ▼
                             JSON tổng hợp: layer, label,
                             score, latency
"""

import json
import logging
import time

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from waf.waf_engine import WafEngine
from waf.waf_logger import log_alert

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("SWG-Orchestrator")

# ---------------------------------------------------------------------------
# Cấu hình upstream AI servers
# ---------------------------------------------------------------------------

FASTTEXT_URL = "http://localhost:5001/predict"
DISTILBERT_URL = "http://localhost:5002/predict"

# Ngưỡng phân loại: nếu confidence > HIGH_CONF_THRESHOLD → kết luận ngay
HIGH_CONF_THRESHOLD = 0.75
# Ngưỡng mập mờ dưới: nếu confidence < LOW_CONF_THRESHOLD → cũng kết luận ngay (chắc chắn ngược)
LOW_CONF_THRESHOLD = 0.40

# Timeout cho mỗi lần gọi AI (giây)
AI_TIMEOUT = 10.0

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    text: str

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"text": "Chúc mừng! Bạn đã trúng thưởng 50 triệu đồng!"},
            ]
        }
    }


# ---------------------------------------------------------------------------
# Khởi tạo app + engine
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SWG Shield — Multi-Layer Orchestrator",
    description=(
        "Cổng gateway bảo mật 4 lớp: WAF (Rule-based) → FastText AI → "
        "DistilBERT (phân tích sâu khi mập mờ) → HITL Report."
    ),
    version="3.0.0",
)

# ── CORS: cho phép browser extension gọi API ────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

waf_engine = WafEngine()


# ---------------------------------------------------------------------------
# Helper: thêm CORS headers vào response bị chặn (middleware bypass CORS)
# ---------------------------------------------------------------------------

def _add_cors(response: JSONResponse, request: Request) -> JSONResponse:
    origin = request.headers.get("origin")
    response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# ---------------------------------------------------------------------------
# Middleware WAF — Layer 1 (luôn chạy đầu tiên)
# ---------------------------------------------------------------------------

@app.middleware("http")
async def waf_middleware(request: Request, call_next):
    """
    Middleware HTTP kiểm tra tất cả POST /api/scan request qua WAF Engine.
    Nếu is_attack=True → trả 403 BLOCKED_BY_WAF ngay, không đi tiếp.
    Nếu sạch → call_next để Orchestrator endpoint xử lý tiếp.
    """
    if request.method == "POST" and request.url.path == "/api/scan":
        raw_body = await request.body()

        payload_text: str = ""
        try:
            body_json = json.loads(raw_body)
            payload_text = str(body_json.get("text", ""))
        except (json.JSONDecodeError, AttributeError):
            logger.warning("WAF: Không parse được JSON body từ %s", request.client)

        if payload_text:
            result = waf_engine.inspect(payload_text)

            if result["is_attack"]:
                attack_type: str = result["attack_type"]
                log_alert(attack_type, payload_text)
                logger.warning("WAF BLOCKED [%s]: %.80s", attack_type, payload_text)

                response_body: dict = {
                    "status": "BLOCKED_BY_WAF",
                    "layer": "WAF",
                    "attack_type": attack_type,
                    "label": "Blocked",
                    "score": 1.0,
                    "latency_ms": 0,
                }
                if result.get("blocked_url"):
                    response_body["blocked_url"] = result["blocked_url"]
                    response_body["detail"] = (
                        f"Phát hiện URL đáng ngờ: {result['blocked_url'][:80]}"
                    )

                response = JSONResponse(status_code=403, content=response_body)
                return _add_cors(response, request)

    return await call_next(request)


# ---------------------------------------------------------------------------
# Endpoint /api/scan — Orchestrator chính (Layer 2 & 3)
# ---------------------------------------------------------------------------

@app.post("/api/scan")
async def api_scan(body: ScanRequest, request: Request):
    """
    Orchestrator Pipeline:
      1. WAF đã CLEAN (qua middleware) → gọi FastText
      2. FastText rõ ràng (>0.75 hoặc <0.40) → trả kết quả ngay
      3. FastText mập mờ (0.40-0.75) → escalate sang DistilBERT
    """
    t_start = time.monotonic()
    text = body.text

    # ── Layer 2: Gọi FastText Server ────────────────────────────────────────
    fasttext_result = None
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            ft_resp = await client.post(FASTTEXT_URL, json={"message": text})
            ft_resp.raise_for_status()
            fasttext_result = ft_resp.json()
    except httpx.ConnectError:
        logger.error("Layer 2: FastText server không kết nối được tại %s", FASTTEXT_URL)
    except httpx.TimeoutException:
        logger.error("Layer 2: FastText server timeout sau %.1fs", AI_TIMEOUT)
    except Exception as exc:
        logger.error("Layer 2: FastText lỗi không xác định: %s", exc)

    # Nếu FastText không phản hồi → vẫn trả CLEAN (WAF đã pass)
    if fasttext_result is None:
        latency = round((time.monotonic() - t_start) * 1000, 2)
        logger.warning("Layer 2: FastText unavailable, fallback CLEAN.")
        return {
            "status": "SUCCESS",
            "layer": "WAF",
            "label": "Safe",
            "score": None,
            "latency_ms": latency,
            "detail": "FastText server unavailable, WAF layer passed.",
        }

    ft_label: str = fasttext_result.get("prediction", "Unknown")
    ft_confidence: float = float(fasttext_result.get("confidence", 0.0))

    logger.info(
        "Layer 2 FastText → label=%s confidence=%.4f", ft_label, ft_confidence
    )

    # ── Đánh giá confidence ngưỡng ──────────────────────────────────────────
    is_clear = ft_confidence > HIGH_CONF_THRESHOLD or ft_confidence < LOW_CONF_THRESHOLD

    if is_clear:
        # Kết quả rõ ràng → trả ngay
        latency = round((time.monotonic() - t_start) * 1000, 2)
        logger.info("Layer 2: Kết quả rõ ràng (%.4f) → trả kết quả.", ft_confidence)
        return {
            "status": "SUCCESS",
            "layer": "FastText",
            "label": ft_label,
            "score": ft_confidence,
            "latency_ms": latency,
            "fasttext": fasttext_result,
        }

    # ── Vùng mập mờ → Layer 3: DistilBERT ──────────────────────────────────
    logger.info(
        "Layer 2: Confidence mập mờ (%.4f) → Escalate sang DistilBERT.", ft_confidence
    )

    distilbert_result = None
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            db_resp = await client.post(DISTILBERT_URL, json={"text": text})
            db_resp.raise_for_status()
            distilbert_result = db_resp.json()
    except httpx.ConnectError:
        logger.error("Layer 3: DistilBERT server không kết nối được tại %s", DISTILBERT_URL)
    except httpx.TimeoutException:
        logger.error("Layer 3: DistilBERT server timeout sau %.1fs", AI_TIMEOUT)
    except Exception as exc:
        logger.error("Layer 3: DistilBERT lỗi không xác định: %s", exc)

    latency = round((time.monotonic() - t_start) * 1000, 2)

    # Nếu DistilBERT cũng không phản hồi → fallback về FastText
    if distilbert_result is None:
        logger.warning("Layer 3: DistilBERT unavailable, fallback về FastText.")
        return {
            "status": "SUCCESS",
            "layer": "FastText (DistilBERT fallback)",
            "label": ft_label,
            "score": ft_confidence,
            "latency_ms": latency,
            "fasttext": fasttext_result,
            "distilbert": None,
        }

    db_label: str = distilbert_result.get("prediction", "Unknown")
    db_confidence: float = float(distilbert_result.get("confidence", 0.0))

    logger.info(
        "Layer 3 DistilBERT → label=%s confidence=%.4f", db_label, db_confidence
    )

    return {
        "status": "SUCCESS",
        "layer": "DistilBERT",
        "label": db_label,
        "score": db_confidence,
        "latency_ms": latency,
        "fasttext": fasttext_result,
        "distilbert": distilbert_result,
    }


# ---------------------------------------------------------------------------
# Health check — kiểm tra tất cả các layer
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Kiểm tra trạng thái của Gateway và các upstream AI servers."""
    services: dict = {
        "waf": "ok",
        "fasttext": "unknown",
        "distilbert": "unknown",
    }

    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            r = await client.get("http://localhost:5001/health")
            services["fasttext"] = "ok" if r.status_code == 200 else f"error:{r.status_code}"
        except Exception:
            services["fasttext"] = "unreachable"

        try:
            r = await client.get("http://localhost:5002/health")
            services["distilbert"] = "ok" if r.status_code == 200 else f"error:{r.status_code}"
        except Exception:
            services["distilbert"] = "unreachable"

    overall = "ok" if all(v == "ok" for v in services.values()) else "degraded"

    return {
        "status": overall,
        "version": "3.0.0",
        "layers": {
            "layer_1_waf": services["waf"],
            "layer_2_fasttext": services["fasttext"],
            "layer_3_distilbert": services["distilbert"],
        },
        "thresholds": {
            "high_confidence": HIGH_CONF_THRESHOLD,
            "low_confidence": LOW_CONF_THRESHOLD,
        },
    }


# ---------------------------------------------------------------------------
# Chạy trực tiếp (dev mode)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
