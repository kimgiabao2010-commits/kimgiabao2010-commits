"""
╔══════════════════════════════════════════════════════════════════╗
║  SWG Shield — Admin Report API Server (Enterprise: SQLite DB)   ║
║  Port: 5003                                                     ║
║                                                                 ║
║  Endpoints:                                                     ║
║    POST /api/report      → Nhận báo cáo từ Extension           ║
║    GET  /api/reports     → Dashboard đọc danh sách chờ duyệt   ║
║    POST /api/verify/{id} → Admin xác nhận: scam / safe         ║
║    DELETE /api/report/{id} → Admin xoá report                  ║
║    GET  /api/verdict/{id}  → Extension poll verdict             ║
║    GET  /api/export      → Tải file CSV để re-train DistilBERT ║
║    GET  /health          → Health check                        ║
╚══════════════════════════════════════════════════════════════════╝

Enterprise Upgrade:
  - Thay thế pending_reports.json bằng SQLite DB (bảng pending_reports)
  - Thread-safe qua SQLAlchemy session (WAL mode)
  - Dữ liệu bền vững qua restart, không bị mất khi crash
  - Vẫn giữ CSV export cho re-train pipeline

Luồng Human-in-the-Loop:
  Extension phát hiện nghi ngờ (confidence 40-80%)
    ↓ POST /api/report
  Lưu vào SQLite DB (status: "pending")
    ↓ Admin mở VerificationQueue trong Dashboard
  GET /api/reports → hiển thị danh sách chờ
    ↓ Admin nhấn [Xác nhận Scam] hoặc [Xác nhận An toàn]
  POST /api/verify/{id}?verdict=scam|safe
    ↓ Ghi vào re_train_dataset.csv để huấn luyện lại
"""

import csv
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database import SessionLocal, PendingReport

# ── Fix Windows console encoding ──────────────────────────────────
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("admin-report-api")

# ── File paths (CSV vẫn giữ để export cho retrain pipeline) ──────
BASE_DIR = Path(__file__).parent
CSV_FILE = BASE_DIR / "re_train_dataset.csv"

if not CSV_FILE.exists():
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "url", "text_preview", "ai_fasttext_prediction",
                         "ai_fasttext_confidence", "ai_distilbert_prediction",
                         "ai_distilbert_confidence", "admin_verdict",
                         "verified_at", "reported_at"])
    logger.info(f"📊 Đã tạo: {CSV_FILE}")


# ── Pydantic Schemas ──────────────────────────────────────────────

class AIResult(BaseModel):
    """Kết quả từ một model AI."""
    is_scam: Optional[bool]      = None
    confidence: Optional[float]  = None
    prediction: Optional[str]    = None
    ok: Optional[bool]           = True


class AIPredictions(BaseModel):
    """Tập hợp kết quả từ các model AI."""
    fasttext:   Optional[AIResult] = None
    distilbert: Optional[AIResult] = None


class ReportRequest(BaseModel):
    """Payload nhận từ Extension khi người dùng báo cáo."""
    url:               str = Field(..., description="URL của trang bị báo cáo")
    page_text_preview: str = Field("", description="Đoạn text đầu trang (max 1000 ký tự)")
    ai_prediction:     Optional[AIPredictions] = Field(None, description="Kết quả AI cũ")
    user_note:         Optional[str] = Field(None, description="Ghi chú của người dùng")
    reported_at:       Optional[str] = Field(None, description="Thời điểm Extension ghi nhận")
    status:            Optional[str] = Field("pending", description="Trạng thái ban đầu")


class VerifyRequest(BaseModel):
    """Payload Admin gửi khi xác nhận."""
    verdict:    Literal["scam", "safe"]
    admin_note: Optional[str] = None


# ── Helper: Ghi CSV cho retrain pipeline ─────────────────────────
def append_to_csv(report: PendingReport, verdict: str) -> None:
    """Ghi một dòng vào re_train_dataset.csv để huấn luyện lại."""
    ai   = report.ai_prediction or {}
    ft   = ai.get("fasttext") or {}
    db   = ai.get("distilbert") or {}

    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            report.id,
            report.url,
            (report.page_text_preview or "")[:500],
            ft.get("prediction", ""),
            ft.get("confidence", ""),
            db.get("prediction", ""),
            db.get("confidence", ""),
            verdict,
            datetime.now(timezone.utc).isoformat(),
            report.reported_at.isoformat() if report.reported_at else "",
        ])
    logger.info(f"📊 CSV: Ghi nhận [{verdict.upper()}] cho {report.url[:60]}")


# ══ FastAPI App ════════════════════════════════════════════════════
app = FastAPI(
    title="SWG Shield — Admin Report API (Enterprise DB)",
    description="Human-in-the-Loop: SQLite DB + CSV Export cho re-train pipeline",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Dashboard localhost:5173 + Extension
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══ ENDPOINTS ══════════════════════════════════════════════════════

@app.post("/api/report", status_code=201)
async def receive_report(body: ReportRequest):
    """
    Extension gọi endpoint này khi người dùng nhấn nút
    'Báo cáo Admin (Nghi ngờ AI nhận diện sai)'.

    Lưu báo cáo vào SQLite DB với status='pending'.
    """
    db = SessionLocal()
    try:
        # Kiểm tra duplicate (cùng URL và cùng nội dung text đã pending)
        existing = (
            db.query(PendingReport)
            .filter(
                PendingReport.url == body.url,
                PendingReport.page_text_preview == body.page_text_preview[:1000],
                PendingReport.status == "pending"
            )
            .first()
        )
        if existing:
            logger.info(f"⚠️  Duplicate report cho URL và text đã pending: {body.url[:60]}")
            return {
                "success": True,
                "message": "Nội dung này từ URL này đã có trong hàng chờ kiểm định.",
                "report_id": existing.id,
                "duplicate": True,
            }

        # Tạo bản ghi mới
        report_id = str(uuid.uuid4())[:8]
        new_report = PendingReport(
            id=report_id,
            url=body.url,
            page_text_preview=body.page_text_preview[:1000],
            ai_prediction=body.ai_prediction.model_dump() if body.ai_prediction else {},
            user_note=body.user_note or "",
            reported_at=datetime.fromisoformat(body.reported_at) if body.reported_at else datetime.now(timezone.utc),
            status="pending",
            admin_verdict=None,
            verified_at=None,
        )
        db.add(new_report)
        db.commit()

        logger.info(f"📥 Báo cáo mới [{report_id}]: {body.url[:60]}")
        return {
            "success": True,
            "message": "Báo cáo đã được lưu vào DB, chờ Admin kiểm định.",
            "report_id": report_id,
            "duplicate": False,
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"DB error in receive_report: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@app.get("/api/reports")
async def get_reports(
    status: Optional[str] = Query(None, description="Lọc theo status: pending | verified | all"),
    limit:  int           = Query(50, ge=1, le=200),
):
    """
    Dashboard Admin gọi để lấy danh sách báo cáo.
    Mặc định trả về tất cả, có thể lọc theo status.
    """
    db = SessionLocal()
    try:
        query = db.query(PendingReport)

        if status and status != "all":
            query = query.filter(PendingReport.status == status)

        # Sắp xếp: pending trước, mới nhất trước
        reports = (
            query
            .order_by(
                PendingReport.status.desc(),      # 'pending' trước 'verified'
                PendingReport.reported_at.desc(),  # Mới nhất trước
            )
            .limit(limit)
            .all()
        )

        # Đếm tổng (query riêng để chính xác)
        pending_count  = db.query(PendingReport).filter(PendingReport.status == "pending").count()
        verified_count = db.query(PendingReport).filter(PendingReport.status == "verified").count()

        return {
            "reports":        [r.to_dict() for r in reports],
            "total":          len(reports),
            "pending_count":  pending_count,
            "verified_count": verified_count,
        }
    finally:
        db.close()


@app.post("/api/verify/{report_id}")
async def verify_report(report_id: str, body: VerifyRequest):
    """
    Admin bấm [Xác nhận: Là Scam] hoặc [Xác nhận: Là An toàn].

    Kết quả:
      - Cập nhật status trong DB → 'verified'
      - Ghi một dòng vào re_train_dataset.csv để re-train
    """
    db = SessionLocal()
    try:
        report = db.query(PendingReport).filter(PendingReport.id == report_id).first()

        if not report:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy báo cáo ID={report_id}")

        if report.status == "verified":
            return {
                "success": True,
                "message": "Báo cáo này đã được xác nhận trước đó.",
                "report": report.to_dict(),
            }

        # Cập nhật
        report.status       = "verified"
        report.admin_verdict = body.verdict
        report.verified_at  = datetime.now(timezone.utc)
        report.admin_note   = body.admin_note or ""
        db.commit()

        # Ghi CSV cho retrain pipeline
        append_to_csv(report, body.verdict)

        verdict_display = "🚨 SCAM" if body.verdict == "scam" else "✅ AN TOÀN"
        logger.info(f"✔️  Admin xác nhận [{report_id}] → {verdict_display}")

        return {
            "success": True,
            "message": f"Đã xác nhận: {verdict_display}. Dữ liệu đã ghi vào CSV để re-train.",
            "report":  report.to_dict(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(f"DB error in verify_report: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@app.delete("/api/report/{report_id}")
async def delete_report(report_id: str):
    """Xóa một báo cáo khỏi danh sách chờ (Admin dismiss)."""
    db = SessionLocal()
    try:
        report = db.query(PendingReport).filter(PendingReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy báo cáo ID={report_id}")
        db.delete(report)
        db.commit()
        logger.info(f"🗑️  Đã xóa báo cáo [{report_id}]")
        return {"success": True, "message": f"Đã xóa báo cáo {report_id}."}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@app.get("/api/verdict/{report_id}")
async def get_verdict(report_id: str):
    """
    Extension polling endpoint — kiểm tra Admin đã xác nhận chưa.

    Extension gọi mỗi 10 giây sau khi gửi báo cáo.
    Trả về:
      - status='pending'  → Admin chưa xem
      - status='verified' → Admin đã xác nhận (kèm admin_verdict: 'scam' | 'safe')
    """
    db = SessionLocal()
    try:
        report = db.query(PendingReport).filter(PendingReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy báo cáo ID={report_id}")

        return {
            "report_id":     report_id,
            "status":        report.status,
            "admin_verdict": report.admin_verdict,
            "admin_note":    report.admin_note or "",
            "verified_at":   report.verified_at.isoformat() if report.verified_at else None,
            "url":           report.url,
        }
    finally:
        db.close()


@app.get("/api/export")
async def export_csv():
    """
    Tải file re_train_dataset.csv — dùng để huấn luyện lại DistilBERT.
    """
    if not CSV_FILE.exists() or CSV_FILE.stat().st_size == 0:
        raise HTTPException(status_code=404, detail="Chưa có dữ liệu CSV. Admin cần xác nhận ít nhất 1 báo cáo.")
    return FileResponse(
        path=str(CSV_FILE),
        media_type="text/csv",
        filename="re_train_dataset.csv",
    )


@app.get("/health")
async def health():
    """Health check endpoint — đọc trực tiếp từ DB."""
    db = SessionLocal()
    try:
        pending_cnt  = db.query(PendingReport).filter(PendingReport.status == "pending").count()
        verified_cnt = db.query(PendingReport).filter(PendingReport.status == "verified").count()
    finally:
        db.close()

    csv_rows = 0
    if CSV_FILE.exists():
        with open(CSV_FILE, encoding="utf-8") as f:
            csv_rows = max(0, sum(1 for _ in f) - 1)  # trừ header

    return {
        "status":           "healthy",
        "service":          "Admin Report API (Enterprise DB)",
        "port":             5003,
        "database":         "SQLite (swg_shield.db)",
        "csv_file":         str(CSV_FILE),
        "pending_reports":  pending_cnt,
        "verified_reports": verified_cnt,
        "csv_rows":         csv_rows,
    }


# ══ MAIN ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    print("=" * 62)
    print("  🛡️  SWG SHIELD — ADMIN REPORT API SERVER (Enterprise DB)")
    print("=" * 62)
    print(f"  📡 URL:       http://127.0.0.1:5003")
    print(f"  💾 Database:  SQLite → swg_shield.db")
    print(f"  📊 CSV file:  {CSV_FILE}")
    print("=" * 62)
    print("  Endpoints:")
    print("    POST /api/report          ← Extension gửi báo cáo")
    print("    GET  /api/reports         ← Dashboard đọc danh sách")
    print("    POST /api/verify/{id}     ← Admin xác nhận verdict")
    print("    GET  /api/export          ← Tải CSV re-train")
    print("    GET  /health              ← Health check")
    print("=" * 62)

    uvicorn.run(
        "api_server_report:app",
        host="0.0.0.0",
        port=5003,
        reload=True,
        log_level="info",
    )
