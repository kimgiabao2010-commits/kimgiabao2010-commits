# 📁 Cấu Trúc Thư Mục Dự Án — SWG Shield v4.1
> **Secure Web Gateway — Hệ thống Phát hiện Lừa đảo Đa tầng AI**
> VNU Information Security · 2026

---

## 🗂️ Directory Tree

```
SWG-SHIELD/                               ← Thư mục gốc dự án
│
├── 📄 main.py                            ─ Central Gateway & Orchestrator (FastAPI, Port 8080)
├── 📄 database.py                        ─ ORM Schema: ScanLog, PendingReport, Admin (SQLite)
├── 📄 retrain_pipeline.py               ─ HITL Auto-Retrain Pipeline (FastText)
├── 📄 api_server_fasttext.py            ─ Layer 2 AI Server: FastText (Port 5001)
├── 📄 api_server_distilbert.py          ─ Layer 3 AI Server: DistilBERT (Port 5002)
├── 📄 api_server_report.py             ─ Verification Queue API (Port 5003)
├── 📄 main_fasttext.py                  ─ Huấn luyện FastText từ đầu (CLI Script)
├── 📄 evaluate.py                       ─ Đánh giá độ chính xác mô hình
├── 📄 data_collector.py                 ─ Thu thập dữ liệu huấn luyện tự động
├── 📄 data_stats.py                     ─ Thống kê phân phối dataset
├── 📄 requirements.txt                  ─ Python dependencies (pip)
├── 📄 swg_shield.db                     ─ Cơ sở dữ liệu SQLite (Runtime)
├── 📄 waf_rules.json                    ─ Bộ luật WAF được nạp động (Hot-reload)
├── 📄 fasttext_train.txt               ─ Dữ liệu huấn luyện định dạng FastText
├── 📄 re_train_dataset.csv             ─ Dataset do Admin xác nhận → dùng cho Retrain
├── 📄 localhost+1.pem                   ─ SSL Certificate (mkcert Local CA)
├── 📄 localhost+1-key.pem              ─ SSL Private Key  (mkcert Local CA)
├── 📄 README.md                         ─ Tài liệu tổng quan dự án
├── 📄 GITLOG.md                         ─ Nhật ký lịch sử phát triển (Git Changelog)
├── 📄 PROJECT_STRUCTURE.md             ─ File này — Cấu trúc thư mục đồ án
│
├── 📁 waf/                              ─ Module Web Application Firewall (Layer 1)
│   ├── waf_engine.py                    ─ Lõi xử lý & phân loại request độc hại
│   ├── waf_middleware.py               ─ Middleware tích hợp trực tiếp vào FastAPI
│   ├── waf_rules_set.py                ─ Tập luật tĩnh (XSS, SQLi, RCE, LFI, CMDi...)
│   ├── scam_pattern_engine.py          ─ Nhận diện mẫu lừa đảo nâng cao (Heuristic)
│   ├── generate_waf_rules.py           ─ Sinh luật WAF tự động từ OWASP CRS dataset
│   ├── waf_logger.py                   ─ Ghi nhật ký cảnh báo WAF chi tiết
│   └── __init__.py                     ─ Package init
│
├── 📁 scam_detector_distilbert/         ─ Thư mục chứa Model AI đã huấn luyện
│   ├── model.safetensors                ─ Trọng số DistilBERT fine-tuned  (~517 MB)
│   ├── scam_detector_model_fasttext.bin ─ Binary model FastText             (~764 MB)
│   ├── config.json                      ─ Cấu hình kiến trúc DistilBERT
│   ├── tokenizer.json                   ─ Từ điển Tokenizer
│   ├── tokenizer_config.json            ─ Cấu hình Tokenizer
│   └── training_args.bin                ─ Siêu tham số (Hyperparameters) lúc huấn luyện
│
├── 📁 csv/                              ─ Bộ dữ liệu huấn luyện gốc
│   ├── vi_dataset.csv                   ─ Dataset chính tiếng Việt (nhãn: scam / legit)
│   ├── train.csv                        ─ Tập huấn luyện (train split)
│   └── test.csv                         ─ Tập kiểm định  (test  split)
│
├── 📁 data/                             ─ Raw data phân loại ngôn ngữ
│   ├── positives.txt                    ─ Mẫu văn bản Scam thu thập thực tế
│   └── negatives.txt                    ─ Mẫu văn bản hợp lệ (Legit)
│
├── 📁 logs/                             ─ Nhật ký WAF & hệ thống (Runtime)
│
├── 📁 .vscode/                          ─ Cấu hình VS Code
│   ├── tasks.json                       ─ Ctrl+Shift+B → Khởi động toàn bộ hệ thống
│   └── launch.json                      ─ Debug configuration
│
└── 📁 swg-frontend/                     ─ Admin Dashboard + Browser Extension
    ├── 📄 vite.config.js               ─ Cấu hình Vite + HTTPS (vite-plugin-mkcert)
    ├── 📄 package.json                  ─ Node.js dependencies
    ├── 📄 index.html                    ─ HTML Entry Point
    │
    ├── 📁 public/                       ─ Browser Extension (Chrome Manifest V3)
    │   ├── manifest.json               ─ Khai báo metadata & quyền truy cập Extension
    │   ├── background.js               ─ Service Worker: Phát hiện URL, gọi API /scan
    │   └── content.js                  ─ Content Script: Trích lục & phân tích text HTML
    │
    └── 📁 src/                          ─ Mã nguồn React — Admin Dashboard
        ├── App.jsx                      ─ Router chính (Protected Routes + Auth Guard)
        ├── main.jsx                     ─ React Entry Point
        │
        ├── 📁 pages/                    ─ Các trang giao diện
        │   ├── Dashboard.jsx            ─ SIEM Dashboard (Live Feed, Biểu đồ, Thống kê)
        │   ├── VerificationQueue.jsx   ─ Hàng chờ xét duyệt (Human-In-The-Loop)
        │   ├── HistoryLogs.jsx          ─ Lịch sử toàn bộ lượt quét (Filterable)
        │   ├── Login.jsx               ─ Đăng nhập Admin (xác thực JWT)
        │   └── Register.jsx            ─ Đăng ký tài khoản Admin (yêu cầu X-API-Key)
        │
        ├── 📁 store/                    ─ Quản lý State toàn cục (Zustand)
        │   ├── authStore.js            ─ Trạng thái xác thực & lưu trữ JWT Token
        │   └── scanStore.js            ─ Dữ liệu Scan Log, Polling & thống kê
        │
        ├── 📁 services/                 ─ Lớp giao tiếp API
        │   └── api.js                  ─ apiFetch Interceptor (Auto-attach JWT, 401 guard)
        │
        └── 📁 utils/                    ─ Hằng số & hàm tiện ích dùng chung
            ├── constants.js            ─ API Base URLs, Verdict Types, Color Palette
            └── helpers.js              ─ Format ngày giờ, truncate text, số liệu...
```

---

## 📊 Tổng Quan Kỹ Thuật

| Thành Phần         | Công Nghệ Sử Dụng                        | Cổng (Port)     |
|--------------------|------------------------------------------|-----------------|
| Central Gateway    | FastAPI · Uvicorn · SQLite · JWT         | `8080` (HTTPS)  |
| WAF Engine         | Python Regex · OWASP CRS Rules           | *(tích hợp)*    |
| AI Layer 2         | FastText (meta/fasttext)                 | `5001` (HTTP)   |
| AI Layer 3         | DistilBERT (HuggingFace Transformers)    | `5002` (HTTP)   |
| Verification API   | Flask · CSV · JSON                       | `5003` (HTTP)   |
| Admin Dashboard    | React · Vite · TailwindCSS · Zustand     | `5173` (HTTPS)  |
| Browser Extension  | Chrome Manifest V3 · Service Worker      | *(Extension)*   |

---

## 🔑 Các File Cốt Lõi Quan Trọng Nhất

| File | Vai Trò |
|------|---------|
| `main.py` | Điểm vào chính của toàn bộ hệ thống Backend |
| `database.py` | Định nghĩa schema & toàn bộ logic CRUD với SQLite |
| `retrain_pipeline.py` | Pipeline tự động tái huấn luyện AI khi Admin phê duyệt mẫu |
| `waf/waf_engine.py` | Bộ lọc Layer 1 — chặn tấn công ngay từ cổng vào |
| `waf/scam_pattern_engine.py` | Heuristic phát hiện ngôn ngữ lừa đảo đặc thù tiếng Việt |
| `swg-frontend/public/background.js` | Service Worker của Extension — nhiệm vụ chủ chốt phía Client |
| `scam_detector_distilbert/model.safetensors` | Bộ não DistilBERT đã được fine-tune cho bài toán phát hiện scam |

---

*Được tạo tự động · SWG Shield v4.1 · VNU Information Security Laboratory 2026*
