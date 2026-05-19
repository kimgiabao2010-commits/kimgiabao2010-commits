"""
main.py — SWG Shield v4.0 (Code Freeze)
=========================================
Enterprise upgrades applied:
  • Task 1 : TTLCache (cachetools) + Rate Limiting (slowapi) 60 req/min/IP
  • Task 2 : Zero-Trust — X-API-Key header validation on /api/scan
  • Task 3 : WAF hot-reload via POST /api/waf/reload (zero downtime)
  • Env-var-aware upstream URLs (FASTTEXT_URL / DISTILBERT_URL)

Pipeline POST /api/scan:
  ┌────────────────────────────────────────────────────────────────┐
  │  Rate Limiter (SlowAPI)  →  X-API-Key Guard  →  TTL Cache     │
  └──────────────────────────────────┬─────────────────────────────┘
                                     │ cache miss
                            ┌────────▼──────────┐
                            │  Layer 1: WAF      │  (waf_middleware)
                            └────────┬──────────┘
                           BLOCKED   │  CLEAN
                            ◄──────  │
                        HTTP 403     ▼
                            ┌─────────────────────┐
                            │  Layer 0: Trusted    │  domain / citation bypass
                            └────────┬────────────┘
                                     │  unknown
                            ┌────────▼────────────┐
                            │  Layer 2: FastText   │  POST :5001/predict
                            └────────┬────────────┘
                         clear│      │ambiguous
                              │      ▼
                              │  ┌───────────────────┐
                              │  │ Layer 3: DistilBERT│  POST :5002/predict
                              │  └────────┬──────────┘
                              └───────────┘
                                     │
                             JSON → Cache → Response
"""

import json
import logging
import os
import re
import time
from functools import lru_cache
from urllib.parse import urlparse

import httpx
from cachetools import TTLCache
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

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
# Task 1: Rate Limiter (SlowAPI)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ---------------------------------------------------------------------------
# Task 1: TTL Cache — stores SAFE results to avoid repeat AI calls
# TTL = 3600s (1 hour), max 2048 entries
# ---------------------------------------------------------------------------
_scan_cache: TTLCache = TTLCache(maxsize=2048, ttl=3600)
_cache_lock_import = __import__("threading").Lock()

def _cache_key(text: str, url: str | None) -> str:
    """Deterministic cache key from scan inputs."""
    return f"{hash(text)}::{hash(url or '')}"

# ---------------------------------------------------------------------------
# Task 2: Zero-Trust — API Key
# ---------------------------------------------------------------------------
API_KEY = os.getenv("SWG_API_KEY", "swg-vnu-is-2026")

def verify_api_key(request: Request):
    """Dependency: validate X-API-Key header."""
    key = request.headers.get("X-API-Key", "")
    if key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail={
                "status": "UNAUTHORIZED",
                "message": "Missing or invalid X-API-Key header.",
            },
        )

# ---------------------------------------------------------------------------
# Upstream AI URLs — env-var first, localhost fallback (Dev mode)
# ---------------------------------------------------------------------------
FASTTEXT_URL   = os.getenv("FASTTEXT_URL",   "http://localhost:5001/predict")
DISTILBERT_URL = os.getenv("DISTILBERT_URL", "http://localhost:5002/predict")
FASTTEXT_HEALTH   = os.getenv("FASTTEXT_HEALTH",   "http://localhost:5001/health")
DISTILBERT_HEALTH = os.getenv("DISTILBERT_HEALTH", "http://localhost:5002/health")

HIGH_CONF_THRESHOLD = 0.75
LOW_CONF_THRESHOLD  = 0.40
AI_TIMEOUT = 10.0

# ---------------------------------------------------------------------------
# Layer 0 — Trusted Domain Whitelist
# ---------------------------------------------------------------------------
TRUSTED_DOMAINS: set[str] = {
    "vnexpress.net", "www.vnexpress.net",
    "tuoitre.vn", "www.tuoitre.vn",
    "thanhnien.vn", "www.thanhnien.vn",
    "dantri.com.vn", "www.dantri.com.vn",
    "nhandan.vn", "www.nhandan.vn",
    "vietnamplus.vn", "www.vietnamplus.vn",
    "baomoi.com", "www.baomoi.com",
    "tienphong.vn", "www.tienphong.vn",
    "laodong.vn", "www.laodong.vn",
    "nld.com.vn", "www.nld.com.vn",
    "vtv.vn", "www.vtv.vn",
    "vov.vn", "www.vov.vn", "vov1.vn", "vov2.vn", "vov3.vn", "vov4.vn", "vov5.vn", "vov6.vn",
    "zingnews.vn", "www.zingnews.vn",
    "baochinhphu.vn", "www.baochinhphu.vn",
    "sggp.org.vn", "www.sggp.org.vn",
    "anninhthudo.vn", "www.anninhthudo.vn",
    "plo.vn", "www.plo.vn",
    "vtcnews.vn", "www.vtcnews.vn",
    "soha.vn", "www.soha.vn",
    "cafef.vn", "www.cafef.vn",
    "cafebiz.vn", "www.cafebiz.vn",
    "24h.com.vn", "www.24h.com.vn",
    "kenh14.vn", "www.kenh14.vn",
    "genk.vn", "www.genk.vn",
    "ictnews.vn", "www.ictnews.vn",
    "pcworld.com.vn", "www.pcworld.com.vn",
    "gov.vn", "chinhphu.vn",
    "mof.gov.vn", "moit.gov.vn", "moet.gov.vn",
    "mps.gov.vn", "moha.gov.vn",
    "bocongan.gov.vn",
    "suckhoedoisong.vn", "moh.gov.vn",
    "vietcombank.com.vn",
    "vietinbank.vn",
    "bidv.com.vn",
    "agribank.com.vn",
    "tpbank.vn",
    "mbbank.com.vn",
    "techcombank.com.vn",
    "acb.com.vn",
    "vpbank.com.vn",
    "sbv.gov.vn",
    "ssi.com.vn",
    "vndirect.com.vn",
    "hust.edu.vn", "uet.vnu.edu.vn",
    "hcmut.edu.vn", "uit.edu.vn",
    "neu.edu.vn", "ueh.edu.vn",
    "vnu.edu.vn", "dlu.edu.vn",
    "udn.vn",
    "wikipedia.org", "en.wikipedia.org", "vi.wikipedia.org",
    "google.com", "www.google.com",
    "youtube.com", "www.youtube.com",
    "github.com", "www.github.com",
    "stackoverflow.com",
    "mozilla.org", "developer.mozilla.org",
    "microsoft.com", "support.microsoft.com", "docs.microsoft.com",
    "apple.com", "www.apple.com",
    "bbc.com", "www.bbc.com",
    "reuters.com", "www.reuters.com",
    "apnews.com",
    "who.int",
    "un.org",
    "python.org", "docs.python.org",
    "npmjs.com",
    "pypi.org",
    "arxiv.org",
    "scholar.google.com",
}


def extract_domain(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return parsed.netloc.lower().strip() or None
    except Exception:
        return None


def is_trusted_domain(url: str | None) -> bool:
    domain = extract_domain(url)
    if not domain:
        return False
    if domain in TRUSTED_DOMAINS:
        return True
    parts = domain.split(".")
    for i in range(1, len(parts)):
        parent = ".".join(parts[i:])
        if parent in TRUSTED_DOMAINS:
            return True
    return False


def has_trusted_citation(text: str) -> str | None:
    if not text:
        return None
    citations = [
        r"(?:nguồn|theo)\s*:\s*(vov|vov1|vov2|vov3|vtv|vnexpress|tuổi trẻ|thanh niên|dân trí|nhân dân|vietnamnet|báo chính phủ|chinhphu\.vn)",
        r"(?:nguồn|theo)\s+(báo\s+)?(vov|vtv|vnexpress|tuổi trẻ|thanh niên|dân trí|nhân dân|vietnamnet|chính phủ)",
    ]
    text_lower = text.lower()
    for pattern in citations:
        match = re.search(pattern, text_lower)
        if match:
            source = match.group(1) if match.lastindex == 1 else match.group(2)
            return source.upper() if source else "TRUSTED_SOURCE"
    return None


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
class ScanRequest(BaseModel):
    text: str
    url: str | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "text": "Chúc mừng! Bạn đã trúng thưởng 50 triệu đồng!",
                    "url": "https://example-scam.com/win",
                }
            ]
        }
    }


# ---------------------------------------------------------------------------
# App Init
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SWG Shield — Multi-Layer Orchestrator v4.0",
    description=(
        "Enterprise SWG: WAF → Trusted Bypass → FastText → DistilBERT.\n"
        "v4.0: TTL Cache · Rate Limiting · Zero-Trust API Key · WAF Hot-Reload · XAI"
    ),
    version="4.0.0",
)

# Register SlowAPI rate-limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

waf_engine = WafEngine()


# ---------------------------------------------------------------------------
# CORS helper for middleware-blocked responses
# ---------------------------------------------------------------------------
def _add_cors(response: JSONResponse, request: Request) -> JSONResponse:
    origin = request.headers.get("origin")
    response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# ---------------------------------------------------------------------------
# Middleware WAF — Layer 1
# ---------------------------------------------------------------------------
@app.middleware("http")
async def waf_middleware(request: Request, call_next):
    """WAF pre-scan all POST /api/scan requests before business logic."""
    if request.method == "POST" and request.url.path == "/api/scan":
        raw_body = await request.body()

        payload_text: str = ""
        payload_url: str = ""
        try:
            body_json = json.loads(raw_body)
            payload_text = str(body_json.get("text", ""))
            payload_url = str(body_json.get("url", ""))
        except (json.JSONDecodeError, AttributeError):
            logger.warning("WAF: Cannot parse JSON body from %s", request.client)

        # 1. WAF scans URL (detect SQLi / XSS / path traversal in the address bar)
        if payload_url and payload_url != "None":
            url_result = waf_engine.inspect(payload_url)
            if url_result["is_attack"]:
                attack_type: str = url_result["attack_type"]
                log_alert(attack_type, payload_url)
                logger.warning("WAF BLOCKED URL [%s]: %.80s", attack_type, payload_url)
                return _add_cors(JSONResponse(status_code=403, content={
                    "status": "BLOCKED_BY_WAF",
                    "layer": "WAF",
                    "attack_type": attack_type,
                    "label": "Blocked",
                    "score": 1.0,
                    "latency_ms": 0,
                    "blocked_url": url_result.get("blocked_url", payload_url),
                    "detail": f"URL contains attack payload ({attack_type}).",
                }), request)

        # 2. WAF scans highlighted text content
        if payload_text:
            result = waf_engine.inspect(payload_text)
            if result["is_attack"]:
                attack_type = result["attack_type"]
                log_alert(attack_type, payload_text)
                logger.warning("WAF BLOCKED TEXT [%s]: %.80s", attack_type, payload_text)

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
                    response_body["detail"] = f"Suspicious URL detected: {result['blocked_url'][:80]}"

                return _add_cors(JSONResponse(status_code=403, content=response_body), request)

    return await call_next(request)


# ---------------------------------------------------------------------------
# Task 3: WAF Hot-Reload Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/waf/reload")
async def waf_hot_reload(request: Request, _: None = Depends(verify_api_key)):
    """
    Reload WAF rules from waf_rules.json at runtime — zero downtime.
    Requires X-API-Key header.
    """
    try:
        status = waf_engine.reload_rules()
        logger.info("WAF hot-reload triggered via API: %s", status)
        return {
            "status": "ok",
            "message": "WAF rules reloaded successfully.",
            "details": status,
        }
    except Exception as exc:
        logger.error("WAF hot-reload failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Reload failed: {str(exc)}")


# ---------------------------------------------------------------------------
# Task 1+2: Main Scan Endpoint — Rate-limited + Zero-Trust
# ---------------------------------------------------------------------------
@app.post("/api/scan")
@limiter.limit("60/minute")
async def api_scan(
    request: Request,
    body: ScanRequest,
    _: None = Depends(verify_api_key),
):
    """
    Orchestrator Pipeline (4 layers):
      0. TTL Cache hit → return immediately
      1. Trusted Domain / Citation → SAFE bypass
      2. FastText (semantic speed layer)
      3. DistilBERT (deep analysis for ambiguous cases)
    """
    t_start = time.monotonic()
    text = body.text
    url  = body.url

    # ── Task 1: Cache Check ───────────────────────────────────────────
    cache_key = _cache_key(text, url)
    with _cache_lock_import:
        cached = _scan_cache.get(cache_key)
    if cached is not None:
        logger.info("Cache HIT for key=%s", cache_key[:16])
        return {**cached, "cache_hit": True}

    # ── LAYER 0: Trusted Domain Bypass ───────────────────────────────
    if is_trusted_domain(url):
        domain = extract_domain(url)
        latency = round((time.monotonic() - t_start) * 1000, 2)
        logger.info("Layer 0 TRUSTED DOMAIN BYPASS: %s → SAFE", domain)
        result = {
            "status": "SUCCESS",
            "layer": "TRUSTED_DOMAIN",
            "label": "Safe",
            "score": 1.0,
            "latency_ms": latency,
            "detail": f"Domain '{domain}' is whitelisted. AI pipeline bypassed.",
            "trusted_domain": domain,
        }
        with _cache_lock_import:
            _scan_cache[cache_key] = result
        return result

    # ── LAYER 0: Trusted Citation Bypass ─────────────────────────────
    cited_source = has_trusted_citation(text)
    if cited_source:
        latency = round((time.monotonic() - t_start) * 1000, 2)
        logger.info("Layer 0 TRUSTED CITATION BYPASS: %s → SAFE", cited_source)
        result = {
            "status": "SUCCESS",
            "layer": "TRUSTED_CITATION",
            "label": "Safe",
            "score": 1.0,
            "latency_ms": latency,
            "detail": f"Text cites trusted source ({cited_source}). AI pipeline bypassed.",
            "trusted_citation": cited_source,
        }
        with _cache_lock_import:
            _scan_cache[cache_key] = result
        return result

    # ── Layer 2: FastText ─────────────────────────────────────────────
    fasttext_result = None
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            ft_resp = await client.post(FASTTEXT_URL, json={"message": text})
            ft_resp.raise_for_status()
            fasttext_result = ft_resp.json()
    except httpx.ConnectError:
        logger.error("Layer 2: FastText unreachable at %s", FASTTEXT_URL)
    except httpx.TimeoutException:
        logger.error("Layer 2: FastText timeout (%.1fs)", AI_TIMEOUT)
    except Exception as exc:
        logger.error("Layer 2: FastText unknown error: %s", exc)

    if fasttext_result is None:
        latency = round((time.monotonic() - t_start) * 1000, 2)
        return {
            "status": "SUCCESS",
            "layer": "WAF",
            "label": "Safe",
            "score": None,
            "latency_ms": latency,
            "detail": "FastText server unavailable. WAF layer passed.",
        }

    ft_label: str = fasttext_result.get("prediction", "Unknown")
    ft_confidence: float = float(fasttext_result.get("confidence", 0.0))

    logger.info("Layer 2 FastText → label=%s confidence=%.4f", ft_label, ft_confidence)

    is_clear = ft_confidence > HIGH_CONF_THRESHOLD or ft_confidence < LOW_CONF_THRESHOLD

    if is_clear:
        latency = round((time.monotonic() - t_start) * 1000, 2)
        result = {
            "status": "SUCCESS",
            "layer": "FastText",
            "label": ft_label,
            "score": ft_confidence,
            "latency_ms": latency,
            "fasttext": fasttext_result,
        }
        # Cache only SAFE results
        if ft_label in ("Safe", "Legit"):
            with _cache_lock_import:
                _scan_cache[cache_key] = result
        return result

    # ── Layer 3: DistilBERT (ambiguous zone) ─────────────────────────
    logger.info("Layer 2: Ambiguous (%.4f) → Escalating to DistilBERT.", ft_confidence)

    distilbert_result = None
    try:
        async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
            db_resp = await client.post(DISTILBERT_URL, json={"text": text})
            db_resp.raise_for_status()
            distilbert_result = db_resp.json()
    except httpx.ConnectError:
        logger.error("Layer 3: DistilBERT unreachable at %s", DISTILBERT_URL)
    except httpx.TimeoutException:
        logger.error("Layer 3: DistilBERT timeout (%.1fs)", AI_TIMEOUT)
    except Exception as exc:
        logger.error("Layer 3: DistilBERT unknown error: %s", exc)

    latency = round((time.monotonic() - t_start) * 1000, 2)

    if distilbert_result is None:
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
    db_confidence: float = float(distilbert_result.get("confidence_score", distilbert_result.get("confidence", 0.0)))

    logger.info("Layer 3 DistilBERT → label=%s confidence=%.4f", db_label, db_confidence)

    result = {
        "status": "SUCCESS",
        "layer": "DistilBERT",
        "label": db_label,
        "score": db_confidence,
        "latency_ms": latency,
        "fasttext": fasttext_result,
        "distilbert": distilbert_result,
    }

    # Cache SAFE results only
    if db_label in ("Safe", "Legit"):
        with _cache_lock_import:
            _scan_cache[cache_key] = result

    return result


# ---------------------------------------------------------------------------
# Cache Stats Endpoint (Operational visibility)
# ---------------------------------------------------------------------------
@app.get("/api/cache/stats")
async def cache_stats(_: None = Depends(verify_api_key)):
    """Return current TTL cache statistics."""
    with _cache_lock_import:
        size = len(_scan_cache)
        maxsize = _scan_cache.maxsize
        ttl = _scan_cache.ttl
    return {
        "cache_entries": size,
        "max_entries": maxsize,
        "ttl_seconds": ttl,
        "utilization_pct": round(size / maxsize * 100, 1),
    }


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    services: dict = {"waf": "ok", "fasttext": "unknown", "distilbert": "unknown"}

    async with httpx.AsyncClient(timeout=3.0) as client:
        try:
            r = await client.get(FASTTEXT_HEALTH)
            services["fasttext"] = "ok" if r.status_code == 200 else f"error:{r.status_code}"
        except Exception:
            services["fasttext"] = "unreachable"

        try:
            r = await client.get(DISTILBERT_HEALTH)
            services["distilbert"] = "ok" if r.status_code == 200 else f"error:{r.status_code}"
        except Exception:
            services["distilbert"] = "unreachable"

    overall = "ok" if all(v == "ok" for v in services.values()) else "degraded"

    return {
        "status": overall,
        "version": "4.0.0",
        "layers": {
            "layer_1_waf": services["waf"],
            "layer_2_fasttext": services["fasttext"],
            "layer_3_distilbert": services["distilbert"],
        },
        "thresholds": {
            "high_confidence": HIGH_CONF_THRESHOLD,
            "low_confidence": LOW_CONF_THRESHOLD,
        },
        "upstream_urls": {
            "fasttext": FASTTEXT_URL,
            "distilbert": DISTILBERT_URL,
        },
    }


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
