"""
╔══════════════════════════════════════════════════════════════╗
║  SWGGuard — Layer 3: DistilBERT Deep Analysis API Server   ║
║  Port: 5002                                                 ║
║  Model: DistilBertForSequenceClassification (Fine-tuned)   ║
╚══════════════════════════════════════════════════════════════╝

Đây là "trùm cuối" trong pipeline 3 lớp:
  Layer 1 (WAF)      → Chặn SQL Injection, XSS, CMDi (rule-based)
  Layer 2 (FastText)  → Phân loại lừa đảo bằng N-gram embeddings
  Layer 3 (DistilBERT)→ Thẩm định sâu bằng Transformer NLP

Được gọi khi FastText phát hiện Scam HOẶC kết quả nghi ngờ (confidence thấp).
"""

import os
import sys
import time
import logging
from contextlib import asynccontextmanager

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Fix Windows console encoding ─────────────────────────────────
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8") # type: ignore

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("distilbert-api")

# ── Cấu hình ─────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "scam_detector_distilbert")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAX_LENGTH = 512  # tokenizer max_position_embeddings

# Label mapping — model config: single_label_classification, 2 classes
# Index 0 = Legit (không lừa đảo), Index 1 = Scam (lừa đảo)
LABEL_MAP = {0: "Legit", 1: "Scam"}

# ── Global model references ──────────────────────────────────────
tokenizer = None
model = None
model_load_time = None


def load_model():
    """Tải DistilBERT model và tokenizer từ thư mục trọng số."""
    global tokenizer, model, model_load_time

    logger.info("=" * 60)
    logger.info("🤖 Đang tải DistilBERT model...")
    logger.info(f"   📁 Thư mục: {MODEL_DIR}")
    logger.info(f"   🖥️  Device: {DEVICE}")

    start = time.time()

    try:
        # Tải tokenizer (BertTokenizer theo tokenizer_config.json)
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
        logger.info("   ✅ Tokenizer đã tải thành công")

        # Tải model (DistilBertForSequenceClassification)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
        model.to(DEVICE)
        model.eval()  # Chuyển sang evaluation mode — tắt dropout

        model_load_time = round(time.time() - start, 2)
        logger.info(f"   ✅ Model đã tải thành công ({model_load_time}s)")
        logger.info(f"   📊 Parameters: {sum(p.numel() for p in model.parameters()):,}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"   ❌ LỖI NGHIÊM TRỌNG khi tải model: {e}")
        logger.error("   💡 Kiểm tra thư mục scam_detector_distilbert/ có đầy đủ file:")
        logger.error("      - config.json")
        logger.error("      - model.safetensors")
        logger.error("      - tokenizer.json")
        logger.error("      - tokenizer_config.json")
        raise


# ── Lifespan — load model khi startup ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model khi server khởi động, cleanup khi tắt."""
    load_model()
    yield
    logger.info("🛑 DistilBERT API Server đang tắt...")


# ══ FastAPI App ═══════════════════════════════════════════════════
app = FastAPI(
    title="SWGGuard — DistilBERT Layer 3 API",
    description="Deep NLP Analysis cho pipeline phát hiện lừa đảo",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — cho phép frontend gọi ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Schema ─────────────────────────────────────
class PredictRequest(BaseModel):
    """Schema cho request prediction."""
    text: str = Field(..., min_length=1, max_length=10000, description="Nội dung cần phân tích")


class PredictResponse(BaseModel):
    """Schema cho response prediction."""
    is_scam: bool                       # True nếu mô hình phán là lừa đảo
    confidence_score: float             # Độ tin cậy (0-100%)
    prediction: str                     # "Scam" hoặc "Legit"
    status: str                         # "success" hoặc "error"
    model: str = "DistilBERT"           # Tên model
    inference_time_ms: float            # Thời gian xử lý (ms)


# ══ ENDPOINTS ═════════════════════════════════════════════════════

@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    Phân tích nội dung bằng DistilBERT Transformer.
    
    Pipeline nội bộ:
      1. Tokenize text → input_ids, attention_mask
      2. Forward pass qua model (torch.no_grad)
      3. Softmax → xác suất cho mỗi class
      4. Trả kết quả: is_scam, confidence_score, prediction
    """
    if model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail="Model chưa được tải. Vui lòng chờ server khởi động xong.",
        )

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text không được để trống.")

    start = time.time()

    try:
        # ── Bước 1: Tokenize ──────────────────────────────────────
        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LENGTH,
            padding=True,
        )
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

        # ── Bước 2: Inference (tắt gradient để tiết kiệm bộ nhớ) ─
        with torch.no_grad():
            outputs = model(**inputs)

        # ── Bước 3: Softmax → xác suất ───────────────────────────
        logits = outputs.logits
        probs = torch.nn.functional.softmax(logits, dim=-1)

        # Lấy class có xác suất cao nhất
        predicted_class = int(torch.argmax(probs, dim=-1).item())
        confidence = probs[0][predicted_class].item()

        # Map sang label
        prediction = LABEL_MAP.get(predicted_class, "Unknown")
        is_scam = prediction == "Scam"

        inference_ms = round((time.time() - start) * 1000, 2)

        logger.info(
            f"📝 Predict: '{text[:50]}...' → {prediction} "
            f"({confidence*100:.1f}%) [{inference_ms}ms]"
        )

        return PredictResponse(
            is_scam=is_scam,
            confidence_score=round(confidence * 100, 2),
            prediction=prediction,
            status="success",
            model="DistilBERT",
            inference_time_ms=inference_ms,
        )

    except Exception as e:
        logger.error(f"❌ Lỗi inference: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi phân tích: {str(e)}",
        )


@app.get("/health")
async def health():
    """
    Health check endpoint — kiểm tra model đã sẵn sàng chưa.
    Frontend dùng endpoint này để hiển thị trạng thái service.
    """
    ready = model is not None and tokenizer is not None
    return {
        "status": "healthy" if ready else "loading",
        "model": "DistilBERT",
        "device": DEVICE,
        "model_loaded": ready,
        "load_time_seconds": model_load_time,
        "max_length": MAX_LENGTH,
    }


# ══ MAIN ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("  🤖 DISTILBERT API SERVER — Layer 3")
    print("=" * 60)
    print(f"  📡 URL:    http://127.0.0.1:5002")
    print(f"  📁 Model:  {MODEL_DIR}")
    print(f"  🖥️  Device: {DEVICE}")
    print(f"  📏 Max Length: {MAX_LENGTH}")
    print("=" * 60)

    uvicorn.run(
        "api_server_distilbert:app",
        host="0.0.0.0",
        port=5002,
        reload=False,       # Tắt reload vì model lớn → tải lâu
        log_level="info",
    )
