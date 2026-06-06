"""
database.py — SWG Shield Enterprise Database Layer
====================================================
Thay thế lưu trữ tạm (in-memory list + JSON file) bằng SQLite + SQLAlchemy.

Bảng dữ liệu:
  1. scan_logs       → Lịch sử quét (thay _scan_log_history trong main.py)
  2. pending_reports → Báo cáo chờ duyệt (thay pending_reports.json)
  3. admins          → Tài khoản Admin cho Dashboard (mật khẩu bcrypt)

Thread-safe: SQLite WAL mode + scoped_session

Cách dùng:
    from database import get_db, ScanLog, PendingReport, Admin
    db = next(get_db())
    db.add(ScanLog(...))
    db.commit()
"""

import os
from datetime import datetime, timezone
from typing import Generator, Optional

# passlib[bcrypt] — mã hóa mật khẩu an toàn một chiều (không thể giải mã ngược)
from passlib.context import CryptContext

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    Boolean,
    JSON,
    create_engine,
    event,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Session,
    sessionmaker,
)

# ---------------------------------------------------------------------------
# Cấu hình Database
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, "swg_shield.db")

# check_same_thread=False: cho phép nhiều thread dùng chung 1 connection
# (FastAPI chạy async + BackgroundTasks dùng thread pool)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,   # True = log SQL queries (debug mode)
    pool_pre_ping=True,
)

# Bật WAL mode — cho phép đọc song song ghi (read-write concurrency)
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")  # Chờ 5s nếu DB bị lock
    cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ---------------------------------------------------------------------------
# Base class cho tất cả models
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Model 1: ScanLog — Lịch sử quét (thay thế _scan_log_history: list)
# ---------------------------------------------------------------------------
class ScanLog(Base):
    """Mỗi dòng = 1 kết quả scan từ Browser Extension gửi về."""
    __tablename__ = "scan_logs"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    timestamp    = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    text         = Column(Text, nullable=False)         # Nội dung text đã scan (max 500 chars)
    is_malicious = Column(Boolean, default=False)
    layer        = Column(String(50), nullable=True)    # WAF | FastText | DistilBERT
    label        = Column(String(50), nullable=True)    # Safe | Scam | Blocked
    score        = Column(Float, nullable=True)         # Confidence score 0.0-1.0
    fasttext     = Column(JSON, nullable=True)          # Raw FastText response
    distilbert   = Column(JSON, nullable=True)          # Raw DistilBERT response
    waf_blocked  = Column(Boolean, default=False)
    attack_type  = Column(String(100), nullable=True)   # SQL_INJECTION, XSS, etc.
    pattern_engine = Column(JSON, nullable=True)        # Scam Pattern Engine result

    def to_dict(self) -> dict:
        """Serializer — giữ nguyên format JSON mà Frontend đang expect."""
        return {
            "id":             self.id,
            "timestamp":      self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "text":           self.text,
            "is_malicious":   self.is_malicious,
            "layer":          self.layer,
            "label":          self.label,
            "score":          self.score,
            "fasttext":       self.fasttext,
            "distilbert":     self.distilbert,
            "waf_blocked":    self.waf_blocked,
            "attack_type":    self.attack_type,
            "pattern_engine": self.pattern_engine,
        }


# ---------------------------------------------------------------------------
# Model 2: PendingReport — Báo cáo chờ Admin duyệt (thay pending_reports.json)
# ---------------------------------------------------------------------------
class PendingReport(Base):
    """Mỗi dòng = 1 báo cáo nghi ngờ từ Extension, chờ Admin kiểm định."""
    __tablename__ = "pending_reports"

    id               = Column(String(8), primary_key=True)   # UUID[:8]
    url              = Column(Text, nullable=False)
    page_text_preview = Column(Text, default="")             # Max 1000 chars
    ai_prediction    = Column(JSON, nullable=True)           # {fasttext: {...}, distilbert: {...}}
    user_note        = Column(Text, default="")
    reported_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    status           = Column(String(20), default="pending", index=True)  # pending | verified
    admin_verdict    = Column(String(10), nullable=True)     # scam | safe
    admin_note       = Column(Text, default="")
    verified_at      = Column(DateTime, nullable=True)

    def to_dict(self) -> dict:
        """Serializer — giữ nguyên format JSON mà Frontend đang expect."""
        return {
            "id":                self.id,
            "url":               self.url,
            "page_text_preview": self.page_text_preview,
            "ai_prediction":     self.ai_prediction,
            "user_note":         self.user_note,
            "reported_at":       self.reported_at.isoformat() if self.reported_at else None,
            "status":            self.status,
            "admin_verdict":     self.admin_verdict,
            "admin_note":        self.admin_note,
            "verified_at":       self.verified_at.isoformat() if self.verified_at else None,
        }


# ---------------------------------------------------------------------------
# Dependency Injection — dùng trong FastAPI endpoint
# ---------------------------------------------------------------------------
def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency: tạo session, tự đóng khi xong.

    Dùng:
        @app.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Model 3: Admin — Tài khoản quản trị Dashboard
# ---------------------------------------------------------------------------

# CryptContext: cấu hình thuật toán bcrypt (adaptive hashing, auto-upgrade)
# bcrypt tự động thêm 'salt' ngẫu nhiên vào mỗi lần hash → chống rainbow table
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Admin(Base):
    """Tài khoản Admin cho Dashboard. Mật khẩu được lưu dưới dạng bcrypt hash."""
    __tablename__ = "admins"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    username        = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)  # bcrypt hash (60 chars)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id":         self.id,
            "username":   self.username,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Admin CRUD Helpers — Data Access Layer
# ---------------------------------------------------------------------------

def create_admin(username: str, password: str) -> Admin:
    """
    Tạo tài khoản Admin mới.
    - Hash mật khẩu bằng bcrypt trước khi lưu (KHÔNG bao giờ lưu plaintext).
    - Raise ValueError nếu username đã tồn tại.
    - Thread-safe: mỗi lần gọi tạo session riêng.
    """
    hashed = _pwd_context.hash(password)  # bcrypt hash với auto-generated salt
    db = SessionLocal()
    try:
        admin = Admin(username=username, hashed_password=hashed)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        return admin
    except Exception as exc:
        db.rollback()
        # SQLite unique constraint violation → username đã tồn tại
        raise ValueError(f"Username '{username}' đã tồn tại hoặc lỗi DB: {exc}") from exc
    finally:
        db.close()


def get_admin_by_username(username: str) -> Optional[Admin]:
    """
    Tìm Admin theo username.
    Trả về None nếu không tìm thấy.
    """
    db = SessionLocal()
    try:
        return db.query(Admin).filter(Admin.username == username).first()
    finally:
        db.close()


def verify_admin_password(plain_password: str, hashed_password: str) -> bool:
    """
    So sánh mật khẩu thô với hash đã lưu trong DB.
    passlib tự động xử lý constant-time comparison để chống timing attack.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# Auto-create tables khi import module
# ---------------------------------------------------------------------------
def init_db():
    """Tạo tất cả bảng nếu chưa tồn tại."""
    Base.metadata.create_all(bind=engine)


# Tự tạo bảng ngay khi module được import
init_db()
