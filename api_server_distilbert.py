"""
api_server_distilbert.py — DistilBERT Layer 3 API Server (v2.0 — XAI)
=======================================================================
Task 4: Explainable AI (XAI) via LIME Text Explainer.
When confidence > 75% and prediction is Scam, LIME extracts the top 5
keywords that most influenced the model's decision.

Response now includes: explainability_keywords: [...]
"""

import os
import sys
import time
import logging
from contextlib import asynccontextmanager
from typing import Optional

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Fix Windows console encoding ─────────────────────────────────
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("distilbert-api")

# ── Cấu hình ─────────────────────────────────────────────────────
MODEL_DIR  = os.path.join(os.path.dirname(__file__), "scam_detector_distilbert")
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
MAX_LENGTH = 512

# XAI settings
XAI_CONFIDENCE_THRESHOLD = 0.75   # Only run LIME when conf > 75%
XAI_NUM_KEYWORDS         = 3      # Top N keywords to extract
XAI_LIME_SAMPLES         = 200    # LIME samples (lower = faster, less precise)

LABEL_MAP = {0: "Legit", 1: "Scam"}

# ── Global model references ──────────────────────────────────────
tokenizer       = None
model           = None
model_load_time = None
_lime_explainer = None   # lazy-initialized


def load_model():
    """Load DistilBERT model + tokenizer from local weights directory."""
    global tokenizer, model, model_load_time

    logger.info("=" * 60)
    logger.info("Loading DistilBERT model...")
    logger.info("  Dir   : %s", MODEL_DIR)
    logger.info("  Device: %s", DEVICE)

    start = time.time()
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        logger.info("  Tokenizer loaded OK")

        model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        model.to(DEVICE)
        model.eval()

        model_load_time = round(time.time() - start, 2)
        logger.info("  Model loaded OK (%.2fs) — %s params",
                    model_load_time, f"{sum(p.numel() for p in model.parameters()):,}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error("FATAL: Failed to load model: %s", e)
        logger.error("Check scam_detector_distilbert/ for: config.json, model.safetensors, tokenizer.json")
        raise


def _get_lime_explainer():
    """Lazy-init LIME TextExplainer (imported here to avoid startup overhead if LIME is missing)."""
    global _lime_explainer
    if _lime_explainer is not None:
        return _lime_explainer
    try:
        from lime.lime_text import LimeTextExplainer  # type: ignore
        _lime_explainer = LimeTextExplainer(class_names=["Legit", "Scam"])
        logger.info("XAI: LIME TextExplainer initialized.")
    except ImportError:
        logger.warning("XAI: 'lime' package not installed. Run: pip install lime")
        _lime_explainer = None
    return _lime_explainer


def _predict_proba_for_lime(texts: list[str]) -> list[list[float]]:
    """
    LIME prediction function: takes a list of text strings,
    returns list of [P(Legit), P(Scam)] probabilities.
    """
    results = []
    for txt in texts:
        inputs = tokenizer(
            txt,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LENGTH,
            padding=True,
        )
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        with torch.no_grad():
            logits = model(**inputs).logits
        probs = torch.nn.functional.softmax(logits, dim=-1)[0].tolist()
        results.append(probs)
    return results


def _extract_keywords(text: str, target_class_idx: int) -> list[str]:
    """
    Run LIME explanation and return top N feature words for the target class.
    Returns empty list if LIME unavailable or explanation fails.
    """
    explainer = _get_lime_explainer()
    if explainer is None:
        return []

    try:
        exp = explainer.explain_instance(
            text,
            _predict_proba_for_lime,
            num_features=XAI_NUM_KEYWORDS,
            num_samples=XAI_LIME_SAMPLES,
            labels=[target_class_idx],
        )
        # exp.as_list returns [(word, weight), ...], sorted by |weight| desc
        features = exp.as_list(label=target_class_idx)
        # Keep only positive contributors (weight > 0 means supports target class)
        keywords = [word for word, weight in features if weight > 0]
        return keywords[:XAI_NUM_KEYWORDS]
    except Exception as exc:
        logger.warning("XAI: LIME explanation failed: %s", exc)
        return []


# ── Lifespan ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield
    logger.info("DistilBERT API Server shutting down...")


# ══ FastAPI App ═══════════════════════════════════════════════════
app = FastAPI(
    title="SWGGuard — DistilBERT Layer 3 API (XAI)",
    description="Deep NLP Analysis with Explainable AI (LIME) for scam detection pipeline",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schema ────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Content to analyze")


class PredictResponse(BaseModel):
    is_scam: bool
    confidence_score: float
    prediction: str
    status: str
    model: str = "DistilBERT"
    inference_time_ms: float
    explainability_keywords: list[str] = []   # XAI: top contributing keywords


# ══ Endpoints ═════════════════════════════════════════════════════
@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    DistilBERT inference pipeline:
      1. Tokenize → forward pass → softmax
      2. If prediction=Scam AND confidence > 75%:
         → Run LIME to extract top-5 explainability keywords
      3. Return full response including explainability_keywords
    """
    if model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail="Model not yet loaded. Please wait for server startup.",
        )

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be empty.")

    start = time.time()

    try:
        # ── Inference ─────────────────────────────────────────────
        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LENGTH,
            padding=True,
        )
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)

        logits = outputs.logits
        probs  = torch.nn.functional.softmax(logits, dim=-1)

        predicted_class = int(torch.argmax(probs, dim=-1).item())
        confidence      = probs[0][predicted_class].item()
        prediction      = LABEL_MAP.get(predicted_class, "Unknown")
        is_scam         = prediction == "Scam"

        inference_ms = round((time.time() - start) * 1000, 2)

        logger.info(
            "Predict: '%.50s...' -> %s (%.1f%%) [%.0fms]",
            text, prediction, confidence * 100, inference_ms,
        )

        # ── XAI: LIME keyword extraction ──────────────────────────
        keywords: list[str] = []
        if is_scam and confidence > XAI_CONFIDENCE_THRESHOLD:
            logger.info("XAI: Running LIME for high-confidence scam (%.1f%%)", confidence * 100)
            keywords = _extract_keywords(text, target_class_idx=1)  # class 1 = Scam
            if keywords:
                logger.info("XAI: Top keywords -> %s", keywords)

        return PredictResponse(
            is_scam=is_scam,
            confidence_score=round(confidence * 100, 2),
            prediction=prediction,
            status="success",
            model="DistilBERT",
            inference_time_ms=inference_ms,
            explainability_keywords=keywords,
        )

    except Exception as e:
        logger.error("Inference error: %s", e)
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.get("/health")
async def health():
    ready = model is not None and tokenizer is not None
    return {
        "status": "healthy" if ready else "loading",
        "model": "DistilBERT",
        "device": DEVICE,
        "model_loaded": ready,
        "load_time_seconds": model_load_time,
        "max_length": MAX_LENGTH,
        "xai_enabled": _lime_explainer is not None,
        "xai_confidence_threshold": XAI_CONFIDENCE_THRESHOLD,
    }


# ══ Main ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("  DISTILBERT API SERVER v2.0 — Layer 3 + XAI")
    print("=" * 60)
    print(f"  URL   : http://127.0.0.1:5002")
    print(f"  Model : {MODEL_DIR}")
    print(f"  Device: {DEVICE}")
    print("=" * 60)

    uvicorn.run(
        "api_server_distilbert:app",
        host="0.0.0.0",
        port=5002,
        reload=False,
        log_level="info",
    )
