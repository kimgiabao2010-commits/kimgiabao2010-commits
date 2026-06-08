
```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║    ███████╗██╗    ██╗ ██████╗     ███████╗██╗  ██╗██╗███████╗██╗     ██████╗    ║
║    ██╔════╝██║    ██║██╔════╝     ██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗   ║
║    ███████╗██║ █╗ ██║██║  ███╗    ███████╗███████║██║█████╗  ██║     ██║  ██║   ║
║    ╚════██║██║███╗██║██║   ██║    ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║   ║
║    ███████║╚███╔███╔╝╚██████╔╝    ███████║██║  ██║██║███████╗███████╗██████╔╝   ║
║    ╚══════╝ ╚══╝╚══╝  ╚═════╝     ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝   ║
║                                                                                  ║
║             🛡️  Secure Web Gateway — Phát hiện Lừa đảo Đa tầng AI  🛡️           ║
║                                                                                  ║
║    ┌──────────────────────────────────────────────────────────────────────────┐  ║
║    │  Version   : v4.1.0 (Production)                                         │  ║
║    │  Author    : VNU Information Security Laboratory                          │  ║
║    │  Stack     : Python 3.11 · FastAPI · React 18 · SQLite · Chrome MV3     │  ║
║    │  Document  : Mục 4.1 — Kiến trúc hệ thống                               │  ║
║    └──────────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

# 4.1 Cấu Trúc Thư Mục Dự Án

---

```
swg-shield/
│
│  ╔═══════════════════════════════════════╗
│  ║        🏛️  BACKEND CORE              ║
│  ╚═══════════════════════════════════════╝
│
├── main.py                    ◄─ 🎯 ENTRY POINT — Central Gateway & Orchestrator
│      └── FastAPI app: Rate Limiter · JWT Guard · TTLCache · CORS · Lifespan
│
├── database.py                ◄─ 🗄️  ORM Models & CRUD (SQLAlchemy + SQLite)
│      └── Tables: ScanLog · PendingReport · Admin
│
├── swg_shield.db              ◄─ 💾 SQLite Runtime Database (auto-generated)
├── requirements.txt           ◄─ 📦 Python Dependencies (pip)
│
│  ╔═══════════════════════════════════════╗
│  ║     🤖  MICROSERVICES — AI PIPELINE  ║
│  ╚═══════════════════════════════════════╝
│
├── api_server_fasttext.py     ◄─ ⚡ [Layer 2]  FastText API  — Port 5001
│      └── Phân loại văn bản tốc độ cao (Machine Learning)
│
├── api_server_distilbert.py   ◄─ 🧠 [Layer 3]  DistilBERT API — Port 5002
│      └── Phân tích ngữ nghĩa sâu (Deep Learning · Transformer)
│
├── api_server_report.py       ◄─ 📋 [Service]  Verification Queue — Port 5003
│      └── Quản lý báo cáo pending từ Admin Dashboard
│
├── retrain_pipeline.py        ◄─ 🔄 [MLOps]   HITL Auto-Retrain (Zero-Downtime)
│      └── Admin Approve → CSV → Format → Train FastText → Hot-Reload
│
├── main_fasttext.py           ◄─ 🏋️  Script huấn luyện FastText từ đầu (CLI)
├── evaluate.py                ◄─ 📊 Đánh giá Accuracy / Precision / Recall
│
│  ╔═══════════════════════════════════════╗
│  ║     🔐  SECURITY & AUTH LAYER        ║
│  ╚═══════════════════════════════════════╝
│
│  (Tích hợp trong main.py + database.py)
│  │
│  ├── 🛡️  X-API-Key Header Guard   — Zero-Trust: bảo vệ toàn bộ endpoints
│  ├── 🔑  JWT (PyJWT · HS256)      — Stateless Auth cho Admin Session
│  ├── 🔒  bcrypt (passlib[bcrypt]) — Mã hoá mật khẩu Admin (cost=12)
│  ├── 🚦  SlowAPI Rate Limiter     — Chống DDoS: 200 req/min/IP
│  ├── ⚡  TTLCache (cachetools)    — Cache kết quả SAFE 1h (giảm tải AI)
│  └── 🌐  TLS/HTTPS (mkcert)      — Chứng chỉ SSL Local CA ký
│
├── localhost+1.pem            ◄─ 🔐 TLS Certificate (mkcert Local CA)
├── localhost+1-key.pem        ◄─ 🔑 TLS Private Key  (mkcert Local CA)
│
│  ╔═══════════════════════════════════════╗
│  ║     🧱  WAF MODULE (LAYER 1)         ║
│  ╚═══════════════════════════════════════╝
│
├── waf/
│   ├── __init__.py
│   ├── waf_engine.py          ◄─ ⚙️  Lõi phân tích & phân loại request độc hại
│   ├── waf_middleware.py      ◄─ 🔌 Middleware tích hợp trực tiếp vào FastAPI
│   ├── waf_rules_set.py       ◄─ 📜 Tập luật: XSS · SQLi · RCE · LFI · CMDi
│   ├── scam_pattern_engine.py ◄─ 🕵️  Heuristic phát hiện lừa đảo tiếng Việt
│   ├── generate_waf_rules.py  ◄─ 🏭 Sinh luật tự động từ OWASP CRS dataset
│   └── waf_logger.py         ◄─ 📝 Ghi nhật ký cảnh báo (CEF format)
│
├── waf_rules.json             ◄─ 📐 Bộ luật WAF nạp động (Hot-reload)
│
│  ╔═══════════════════════════════════════╗
│  ║     🧬  AI MODEL ARTIFACTS           ║
│  ╚═══════════════════════════════════════╝
│
├── scam_detector_distilbert/
│   ├── model.safetensors           ◄─ 🧠 DistilBERT weights fine-tuned  [517 MB]
│   ├── scam_detector_model_fasttext.bin ◄─ ⚡ FastText binary model     [764 MB]
│   ├── config.json                 ◄─ ⚙️  Cấu hình kiến trúc DistilBERT
│   ├── tokenizer.json              ◄─ 📖 Từ điển Tokenizer (~30K tokens)
│   ├── tokenizer_config.json       ◄─ ⚙️  Cấu hình Tokenizer
│   └── training_args.bin           ◄─ 📐 Hyperparameters lúc huấn luyện
│
│  ╔═══════════════════════════════════════╗
│  ║     📚  TRAINING DATA                ║
│  ╚═══════════════════════════════════════╝
│
├── csv/
│   ├── vi_dataset.csv         ◄─ 🗃️  Dataset gốc tiếng Việt (scam / legit)
│   ├── train.csv              ◄─ 📈 Tập huấn luyện (Train split  ~80%)
│   └── test.csv               ◄─ 📉 Tập kiểm định  (Test  split  ~20%)
│
├── fasttext_train.txt         ◄─ 📄 Dataset FastText format (__label__scam ...)
├── re_train_dataset.csv       ◄─ ✅ Dữ liệu Admin đã phê duyệt → đầu vào Retrain
│
│  ╔═══════════════════════════════════════╗
│  ║     ⚙️   DEVOPS & CONFIG             ║
│  ╚═══════════════════════════════════════╝
│
├── .vscode/
│   ├── tasks.json             ◄─ ⌨️  Ctrl+Shift+B → Khởi động toàn bộ Stack
│   └── launch.json            ◄─ 🐛 Debug profile cho VS Code
│
├── .gitignore                 ◄─ 🚫 Loại trừ: __pycache__ · *.pem · *.db · venv
├── README.md                  ◄─ 📖 Tài liệu tổng quan & hướng dẫn khởi chạy
├── GITLOG.md                  ◄─ 📅 Nhật ký phát triển theo Sprint
│
│  ╔═══════════════════════════════════════════════════════════╗
│  ║   ⚛️   FRONTEND — REACT DASHBOARD + BROWSER EXTENSION   ║
│  ╚═══════════════════════════════════════════════════════════╝
│
└── swg-frontend/
    │
    ├── vite.config.js         ◄─ ⚡ Vite build + HTTPS (vite-plugin-mkcert)
    ├── package.json           ◄─ 📦 Node.js dependencies & npm scripts
    ├── tailwind.config.js     ◄─ 🎨 TailwindCSS design tokens
    ├── index.html             ◄─ 🌐 HTML Entry Point
    │
    ├── public/                    ╔══════════════════════════════╗
    │   │                          ║  🔌 BROWSER EXTENSION (MV3) ║
    │   │                          ╚══════════════════════════════╝
    │   ├── manifest.json      ◄─ 📋 Khai báo metadata, host_permissions Chrome
    │   ├── background.js      ◄─ 👁️  Service Worker: Bắt URL, gọi /api/scan ngầm
    │   └── content.js         ◄─ 🖊️  Content Script: Trích lục text & hiện Banner
    │
    └── src/                       ╔══════════════════════════════╗
        │                          ║  🖥️  REACT ADMIN DASHBOARD  ║
        │                          ╚══════════════════════════════╝
        ├── main.jsx            ◄─ 🚀 React DOM Entry Point
        ├── App.jsx             ◄─ 🗺️  Router + Auth Guard (Protected Routes)
        │
        ├── pages/
        │   ├── Dashboard.jsx        ◄─ 📊 SIEM: Live Feed · Charts · Thống kê
        │   ├── VerificationQueue.jsx◄─ ✅ Human-In-The-Loop Verification
        │   ├── HistoryLogs.jsx      ◄─ 📜 Lịch sử quét (Filter · Pagination)
        │   ├── Login.jsx            ◄─ 🔐 Đăng nhập Admin (JWT + bcrypt)
        │   └── Register.jsx         ◄─ 📝 Đăng ký (yêu cầu X-API-Key)
        │
        ├── store/              ◄─ 🗂️  State Management (Zustand)
        │   ├── authStore.js         ◄─ 🔑 JWT Token · Auth state
        │   └── scanStore.js         ◄─ 📡 Scan Logs · Polling · Cache
        │
        ├── services/
        │   └── api.js          ◄─ 🔌 apiFetch: Auto-attach JWT · 401 interceptor
        │
        └── utils/
            ├── constants.js    ◄─ 🎨 API URLs · Verdict Types · Color Palette
            └── helpers.js      ◄─ 🔧 Format date · Truncate · Number utils
```

---

## 📊 Bảng Tổng Hợp Stack Kỹ Thuật

```
┌─────────────────────┬───────────────────────────────────────┬────────┬──────────┐
│  Module             │  Công Nghệ                            │  Port  │ Protocol │
├─────────────────────┼───────────────────────────────────────┼────────┼──────────┤
│ 🎯 Central Gateway  │ FastAPI · Uvicorn · SQLite · PyJWT    │  8080  │  HTTPS   │
│ 🧱 WAF Engine       │ Python Regex · OWASP CRS Rules        │  ----  │    —     │
│ ⚡ AI Layer 2       │ meta/fasttext · Flask                 │  5001  │  HTTP    │
│ 🧠 AI Layer 3       │ HuggingFace DistilBERT · FastAPI      │  5002  │  HTTP    │
│ 📋 Verification     │ Flask · CSV · JSON · SQLite           │  5003  │  HTTP    │
│ 🖥️  Dashboard       │ React 18 · Vite · TailwindCSS·Zustand │  5173  │  HTTPS   │
│ 🔌 Extension        │ Chrome Manifest V3 · Service Worker   │   —    │    —     │
└─────────────────────┴───────────────────────────────────────┴────────┴──────────┘
```

## 🔄 Luồng Xử Lý Chính (Request Pipeline)

```
  [User lướt web]
       │
       ▼
  Browser Extension ──► POST /api/scan ──► 🏛️  Central Gateway (8080/HTTPS)
                                                │
                              ┌─────────────────┼──────────────────────┐
                              │                 │                      │
                              ▼                 ▼                      ▼
                        🔑 JWT Auth       📦 TTL Cache           🚦 Rate Limit
                              │                 │                      │
                              └────────┬────────┘                      │
                                       │                               │
                                       ▼                               │
                              ┌─────────────────┐                      │
                              │  🧱 WAF Layer 1  │ ◄────── Block ───────┘
                              │  (SQLi/XSS/RCE) │
                              └────────┬────────┘
                               PASS    │   BLOCK → 403 Forbidden
                                       ▼
                              ┌─────────────────┐
                              │  ⚡ FastText L2  │  Confidence > 75%?
                              │  (Port 5001)    │
                              └────────┬────────┘
                           CERTAIN │       │ AMBIGUOUS (< 75%)
                                   │       ▼
                                   │  ┌─────────────────┐
                                   │  │  🧠 DistilBERT  │  Deep Semantic
                                   │  │  L3 (Port 5002) │  Analysis
                                   │  └────────┬────────┘
                                   └───────────┘
                                               │
                                               ▼
                                   💾 ScanLog → SQLite DB
                                               │
                                               ▼
                                   📊 Admin Dashboard (5173/HTTPS)
                                               │
                                       ┌───────┴───────┐
                                       ▼               ▼
                                  ✅ Verify        ❌ Discard
                                       │
                                       ▼
                                  🔄 Retrain FastText (HITL Pipeline)
```

---

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║   SWG Shield v4.1  ·  VNU Information Security Laboratory  ·  © 2026           ║
║   "Bảo vệ người dùng Việt Nam khỏi các mối đe dọa lừa đảo trực tuyến"         ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```
