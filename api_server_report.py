"""
╔══════════════════════════════════════════════════════════════════╗
║  SWG Shield — Admin Report API Server                          ║
║  Port: 5003                                                    ║
║                                                                ║
║  Endpoints:                                                    ║
║    POST /api/report      → Nhận báo cáo từ Extension          ║
║    GET  /api/reports     → Dashboard đọc danh sách chờ duyệt  ║
║    POST /api/verify/{id} → Admin xác nhận: scam / safe        ║
║    GET  /api/export      → Tải file CSV để re-train DistilBERT ║
║    GET  /health          → Health check                       ║
╚══════════════════════════════════════════════════════════════════╝

Luồng Human-in-the-Loop:
  Extension phát hiện nghi ngờ (confidence 40-80%)
    ↓ POST /api/report
  Lưu vào pending_reports.json (status: "pending")
    ↓ Admin mở VerificationQueue trong Dashboard
  GET /api/reports → hiển thị danh sách chờ
    ↓ Admin nhấn [Xác nhận Scam] hoặc [Xác nhận An toàn]
  POST /api/verify/{id}?verdict=scam|safe
    ↓ Ghi vào re_train_dataset.csv để huấn luyện lại DistilBERT
"""

import csv
import json
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

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

# ── File paths ────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
REPORTS_FILE  = BASE_DIR / "pending_reports.json"
CSV_FILE      = BASE_DIR / "re_train_dataset.csv"

# Tạo file nếu chưa có
if not REPORTS_FILE.exists():
    REPORTS_FILE.write_text("[]", encoding="utf-8")
    logger.info(f"📄 Đã tạo: {REPORTS_FILE}")

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


# ── Helper: đọc/ghi JSON ──────────────────────────────────────────
def read_reports() -> list[dict]:
    """Đọc danh sách báo cáo từ file JSON."""
    try:
        text = REPORTS_FILE.read_text(encoding="utf-8")
        return json.loads(text) if text.strip() else []
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def write_reports(reports: list[dict]) -> None:
    """Ghi danh sách báo cáo vào file JSON (atomic write)."""
    tmp = REPORTS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(REPORTS_FILE)


def append_to_csv(report: dict, verdict: str) -> None:
    """Ghi một dòng vào re_train_dataset.csv để huấn luyện lại."""
    ai   = report.get("ai_prediction") or {}
    ft   = ai.get("fasttext") or {}
    db   = ai.get("distilbert") or {}

    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            report.get("id", ""),
            report.get("url", ""),
            report.get("page_text_preview", "")[:500],
            ft.get("prediction", ""),
            ft.get("confidence", ""),
            db.get("prediction", ""),
            db.get("confidence", ""),
            verdict,
            datetime.now().isoformat(),
            report.get("reported_at", ""),
        ])
    logger.info(f"📊 CSV: Ghi nhận [{verdict.upper()}] cho {report.get('url', '')[:60]}")


# ══ FastAPI App ════════════════════════════════════════════════════
app = FastAPI(
    title="SWG Shield — Admin Report API",
    description="Human-in-the-Loop: Nhận báo cáo từ Extension, Admin xác nhận, xuất CSV để re-train",
    version="1.0.0",
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

    Lưu báo cáo vào pending_reports.json với status='pending'.
    """
    reports = read_reports()

    # Kiểm tra duplicate (cùng URL đã pending)
    existing = next(
        (r for r in reports if r.get("url") == body.url and r.get("status") == "pending"),
        None,
    )
    if existing:
        logger.info(f"⚠️  Duplicate report cho URL đã pending: {body.url[:60]}")
        return {
            "success": True,
            "message": "URL này đã có trong hàng chờ kiểm định.",
            "report_id": existing["id"],
            "duplicate": True,
        }

    # Tạo bản ghi mới
    report_id = str(uuid.uuid4())[:8]
    new_report = {
        "id":               report_id,
        "url":              body.url,
        "page_text_preview": body.page_text_preview[:1000],
        "ai_prediction":    body.ai_prediction.model_dump() if body.ai_prediction else {},
        "user_note":        body.user_note or "",
        "reported_at":      body.reported_at or datetime.now().isoformat(),
        "status":           "pending",
        "admin_verdict":    None,
        "verified_at":      None,
    }

    reports.append(new_report)
    write_reports(reports)

    logger.info(f"📥 Báo cáo mới [{report_id}]: {body.url[:60]}")
    return {
        "success": True,
        "message": "Báo cáo đã được lưu, chờ Admin kiểm định.",
        "report_id": report_id,
        "duplicate": False,
    }


@app.get("/api/reports")
async def get_reports(
    status: Optional[str] = Query(None, description="Lọc theo status: pending | verified | all"),
    limit:  int           = Query(50, ge=1, le=200),
):
    """
    Dashboard Admin gọi để lấy danh sách báo cáo.
    Mặc định trả về tất cả, có thể lọc theo status.
    """
    reports = read_reports()

    if status and status != "all":
        reports = [r for r in reports if r.get("status") == status]

    # Sắp xếp: pending trước, mới nhất trước
    reports.sort(key=lambda r: (r.get("status") != "pending", r.get("reported_at", "")), reverse=False)
    reports = reports[:limit]

    pending_count  = sum(1 for r in read_reports() if r.get("status") == "pending")
    verified_count = sum(1 for r in read_reports() if r.get("status") == "verified")

    return {
        "reports":       reports,
        "total":         len(reports),
        "pending_count": pending_count,
        "verified_count": verified_count,
    }


@app.post("/api/verify/{report_id}")
async def verify_report(report_id: str, body: VerifyRequest):
    """
    Admin bấm [Xác nhận: Là Scam] hoặc [Xác nhận: Là An toàn].

    Kết quả:
      - Cập nhật status trong pending_reports.json → 'verified'
      - Ghi một dòng vào re_train_dataset.csv để re-train DistilBERT
    """
    reports = read_reports()
    idx = next((i for i, r in enumerate(reports) if r.get("id") == report_id), None)

    if idx is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy báo cáo ID={report_id}")

    report = reports[idx]
    if report.get("status") == "verified":
        return {
            "success": True,
            "message": "Báo cáo này đã được xác nhận trước đó.",
            "report": report,
        }

    # Cập nhật
    report["status"]       = "verified"
    report["admin_verdict"] = body.verdict
    report["verified_at"]  = datetime.now().isoformat()
    report["admin_note"]   = body.admin_note or ""
    reports[idx] = report

    write_reports(reports)
    append_to_csv(report, body.verdict)

    verdict_display = "🚨 SCAM" if body.verdict == "scam" else "✅ AN TOÀN"
    logger.info(f"✔️  Admin xác nhận [{report_id}] → {verdict_display}")

    return {
        "success": True,
        "message": f"Đã xác nhận: {verdict_display}. Dữ liệu đã ghi vào CSV để re-train.",
        "report":  report,
    }


@app.delete("/api/report/{report_id}")
async def delete_report(report_id: str):
    """Xóa một báo cáo khỏi danh sách chờ (Admin dismiss)."""
    reports = read_reports()
    before = len(reports)
    reports = [r for r in reports if r.get("id") != report_id]
    if len(reports) == before:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy báo cáo ID={report_id}")
    write_reports(reports)
    logger.info(f"🗑️  Đã xóa báo cáo [{report_id}]")
    return {"success": True, "message": f"Đã xóa báo cáo {report_id}."}


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
    """Health check endpoint."""
    reports      = read_reports()
    pending_cnt  = sum(1 for r in reports if r.get("status") == "pending")
    verified_cnt = sum(1 for r in reports if r.get("status") == "verified")
    csv_rows     = 0
    if CSV_FILE.exists():
        with open(CSV_FILE, encoding="utf-8") as f:
            csv_rows = max(0, sum(1 for _ in f) - 1)  # trừ header

    return {
        "status":          "healthy",
        "service":         "Admin Report API",
        "port":            5003,
        "reports_file":    str(REPORTS_FILE),
        "csv_file":        str(CSV_FILE),
        "pending_reports": pending_cnt,
        "verified_reports": verified_cnt,
        "csv_rows":        csv_rows,
    }


# ══ MAIN ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    print("=" * 62)
    print("  🛡️  SWG SHIELD — ADMIN REPORT API SERVER")
    print("=" * 62)
    print(f"  📡 URL:          http://127.0.0.1:5003")
    print(f"  📄 Reports file: {REPORTS_FILE}")
    print(f"  📊 CSV file:     {CSV_FILE}")
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
