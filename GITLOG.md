# 🛡️ Nhật Ký Phát Triển & Lịch Sử Commit (GITLOG) — SWG Shield

Tệp tài liệu này ghi nhận toàn bộ quá trình phát triển, các vấn đề kỹ thuật cốt lõi gặp phải, phương án xử lý chi tiết và danh sách lịch sử commit (Git History) của hệ thống **Secure Web Gateway (SWG Shield)**.

---

## 🔍 1. Tóm Tắt Vấn Đề Hệ Thống & Giải Pháp Triển Khai (Code Freeze v4.0)

Để đưa hệ thống **SWG Shield** từ một nguyên mẫu thử nghiệm (Prototype) đạt tiêu chuẩn **Enterprise-Grade** sẵn sàng bảo vệ đồ án tốt nghiệp và môi trường Production, nhóm phát triển đã xác định và giải quyết triệt để các bài toán kỹ thuật sau:

### 🔴 Vấn đề 1: Hiệu năng suy giảm & Quá tải AI Inference khi quét lặp lại
*   **Chi tiết vấn đề**: Việc liên tục gửi các đoạn văn bản hoặc URL an toàn (Safe) lên các service AI (FastText, DistilBERT) ở Port 5001/5002 gây lãng phí năng lực tính toán cực lớn, làm tăng độ trễ mạng (latency) lên hàng trăm mili-giây cho mỗi request.
*   **Giải pháp v4.0**: Tích hợp thư viện `cachetools` với cơ chế **`TTLCache`** (Time-To-Live). Mỗi khi có một kết quả quét được đánh dấu là "SAFE", Gateway sẽ lưu vào bộ nhớ cache với thời gian tồn tại là **1 giờ (3600 giây)**. Khi request tiếp theo trùng khớp, Gateway sẽ trả kết quả ngay lập tức trong **< 1ms** mà không cần gọi các dịch vụ AI phía sau.

### 🔴 Vấn đề 2: Nguy cơ tấn công từ chối dịch vụ (DDoS Gateway)
*   **Chi tiết vấn đề**: Cổng trung tâm `POST /api/scan` không giới hạn tần suất yêu cầu truy cập từ phía client, khiến tin tặc dễ dàng thực hiện tấn công brute-force hoặc spam quét gây nghẽn hệ thống.
*   **Giải pháp v4.0**: Tích hợp công cụ **`SlowAPI`** triển khai cơ chế Rate Limiting dựa trên IP của client. Thiết lập giới hạn nghiêm ngặt **60 requests/phút/IP**. Nếu vượt quá giới hạn này, Gateway sẽ từ chối xử lý và trả về mã lỗi `HTTP 429 Too Many Requests`.

### 🔴 Vấn đề 3: Lỗ hổng bảo mật Zero-Trust API
*   **Chi tiết vấn đề**: Các endpoints điều phối quét hoặc reload cấu hình WAF chạy không xác thực, bất cứ ai cũng có thể gửi request nạp đè cấu hình hoặc chiếm dụng tài nguyên phân tích.
*   **Giải pháp v4.0**: Triển khai cơ chế xác thực **Zero-Trust** sử dụng header `X-API-Key`. Bắt buộc tất cả các request quét mạng từ Extension và Dashboard React phải đính kèm khóa hợp lệ (`swg-vnu-is-2026`). Thiếu hoặc sai khóa sẽ trả về ngay lập tức lỗi `HTTP 401 Unauthorized`.

### 🔴 Vấn đề 4: WAF cứng nhắc, không hỗ trợ cập nhật động (Hot-Reload)
*   **Chi tiết vấn đề**: Các quy tắc lọc mã độc WAF (regex patterns) bị mã hóa cứng trong mã nguồn Python. Mỗi khi muốn cập nhật blocklist (tên miền độc hại, SQL injection mới,...), quản trị viên bắt buộc phải sửa code và restart lại toàn bộ Uvicorn server, gây ra thời gian chết (downtime).
*   **Giải pháp v4.0**: Tách rời toàn bộ WAF rules ra tệp cấu hình **`waf_rules.json`**. Phát triển tính năng Hot-Reload thread-safe thông qua endpoint an toàn `POST /api/waf/reload`. Cho phép cập nhật luật mới ngay tức thì mà không cần khởi động lại Gateway.

### 🔴 Vấn đề 5: AI là một "Hộp đen" (Black-Box) thiếu tính giải thích
*   **Chi tiết vấn đề**: Khi mô hình DistilBERT phân loại một nội dung là lừa đảo (Scam), hội đồng chuyên môn hoặc giám trị viên không biết *vì sao* mô hình lại đưa ra quyết định đó, gây khó khăn cho việc kiểm định (HITL).
*   **Giải pháp v4.0**: Tích hợp thư viện **LIME (Local Interpretable Model-agnostic Explanations)** để cung cấp tính năng **Explainable AI (XAI)**. Khi mô hình phát hiện lừa đảo với độ tự tin cao (>75%), LIME sẽ tự động bóc tách và trả về **top 5 từ khóa đắt giá nhất** đóng góp vào quyết định của mô hình, hiển thị minh bạch lý do trên Dashboard kiểm định.

### 🔴 Vấn đề 6: Giao diện cũ phức tạp, nhiều icon "nhựa" và thiếu tính thực tiễn
*   **Chi tiết vấn đề**: Thiết kế Dashboard React ban đầu dùng quá nhiều icon sặc sỡ tạo cảm giác thiếu chuyên nghiệp. Trang quét thủ công (ScannerView) không có giá trị thực tiễn vì người dùng đã thực hiện quét trực tiếp qua extension. Dữ liệu trên Dashboard bị hardcode tĩnh.
*   **Giải pháp v4.0**:
    *   Tái cấu trúc giao diện theo ngôn ngữ tối giản cao cấp **Apple Store Meets SIEM** với sắc xám nhẹ `#F5F5F7` kết hợp các thẻ gốm trắng muốt bo tròn cực đại (`rounded-[2rem]`).
    *   Gỡ bỏ 100% các icon nhựa sặc sỡ, thay thế bằng bộ **Biểu tượng kỹ thuật siêu mảnh (Ultra-thin Technical Icons)** với nét vẽ thanh thoát `1.25px`.
    *   Xóa bỏ hoàn toàn trang quét thủ công rườm rà. Tập trung toàn bộ sức mạnh vào luồng **SIEM Analytics Center** kết xuất trực quan thời gian thực (PieChart/BarChart Recharts) từ Store dữ liệu thực tế (Zustand).

---

## 📅 2. Nhật Ký Lịch Sử Commit (Git Commit History)

Dưới đây là chi tiết các mốc commit chính trong kho lưu trữ Git của dự án:

| Commit Hash | Ngày thực hiện | Tên Commit / Tính năng | Mô Tả Kỹ Thuật Chi Tiết |
| :--- | :--- | :--- | :--- |
| **`(latest)`** | 2026-05-24 | `fix: add flush=True print logs to retrain_pipeline — fix silent background task on Windows` | Chẩn đoán và vá lỗi "im lặng hoàn toàn" của Background Task huấn luyện FastText trên Windows. Nguyên nhân kép: (1) `logging.basicConfig()` bị nuốt do đã được gọi trước bởi `main.py` → fix bằng `force=True`; (2) stdout bị buffer trên Windows → fix bằng `sys.stdout.reconfigure(line_buffering=True)` và thêm toàn bộ `print(..., flush=True)` nổi bật tại các mốc quan trọng: bắt đầu train 🚀, hoàn tất ⏱️, lưu model ✅, lỗi ❌. |
| **`3fe521e`** | 2026-05-24 | `Update background.js and temp_owasp_crs` | Cập nhật logic `background.js` của Browser Extension và đồng bộ tập luật OWASP CRS tạm thời. |
| **`1fbe771`** | 2026-05-22 | `feat: add POST /api/retrain/fasttext endpoint and Retrain FastText button in VerificationQueue UI` | Phát triển endpoint `POST /api/retrain/fasttext` kích hoạt huấn luyện lại FastText 30 epochs qua `BackgroundTasks`. Tích hợp nút "Retrain FastText" vào giao diện Admin Verification Queue cho phép quản trị viên kích hoạt pipeline HITL chỉ với một click. |
| **`43c3bd2`** | 2026-05-22 | `Enhance Dashboard Analytics (Risk Score), FastText 1:1 Class Balancing, and Restore Instant AI Bypass Pipeline` | Ba nâng cấp lớn đồng thời: (1) Bổ sung trực quan hóa Risk Score vào Dashboard Analytics; (2) Cân bằng dataset FastText theo tỉ lệ 1:1 (safe:scam) loại bỏ bias phân loại; (3) Khôi phục pipeline Instant AI Bypass để đảm bảo phản hồi tức thì khi FastText đã đủ tự tin. |
| **`f8ed980`** | 2026-05-19 | `docs: add comprehensive development gitlog and architectural overview` | Khởi tạo tệp `GITLOG.md` ghi nhận toàn bộ lịch sử phát triển, các vấn đề kỹ thuật và giải pháp triển khai của hệ thống SWG Shield. |
| **`712ad1c`** | 2026-05-19 | `feat: Code Freeze v4.0 — Cache+RateLimit+ZeroTrust+WAF-HotReload+XAI+Docker` | **Bản phát hành Code Freeze v4.0 cuối cùng**. Tích hợp TTLCache (cachetools), SlowAPI Rate limiting, xác thực X-API-Key trên Gateway & Extension/Frontend, WAF rules lưu dạng JSON với tính năng hot-reload dynamic, LIME XAI trong DistilBERT server, viết Dockerfile và docker-compose.yml liên kết 4 containers. |
| **`be4b222`** | 2026-05-19 | `style: ultra-professional SIEM dark mode banners without emojis` | Dọn dẹp thiết kế giao diện cảnh báo của Extension. Loại bỏ toàn bộ emoji, chuyển sang ngôn ngữ SIEM Dark Mode chuyên nghiệp phục vụ doanh nghiệp lớn. |
| **`e72ee03`** | 2026-05-19 | `style: redesign extension banners to match dashboard glassmorphism UI` | Đồng bộ thẩm mỹ của Extension Warning Banner với thiết kế kính mờ cao cấp của Dashboard. |
| **`3404ec3`** | 2026-05-19 | `feat: make WAF scan URL as well as highlighted text` | Nâng cấp WAF Layer 1 quét cả URL trên thanh địa chỉ trình duyệt kết hợp quét văn bản bôi đen của người dùng. |
| **`d7efd68`** | 2026-05-18 | `fix: add tabs permission to manifest - critical fix for dashboard telemetry` | Bổ sung quyền `tabs` vào `manifest.json` của Extension để đồng bộ dữ liệu thời gian thực sang Dashboard SIEM chính xác. |
| **`b088b84`** | 2026-05-18 | `chore: final comprehensive review and polish, add url scan telemetry` | Đánh giá tổng thể mã nguồn, tối ưu hóa các điểm nghẽn truyền tải và thêm telemetry giám sát quét URL. |
| **`c0be19c`** | 2026-05-18 | `feat: implement trusted domain/citation bypass & fix dashboard sync` | Triển khai danh sách trắng tên miền tin cậy (Whitelisting). Tự động bỏ qua quét WAF/AI nếu nguồn tin cậy nhằm tối ưu hóa trải nghiệm người dùng. |
| **`552b34e`** | 2026-05-18 | `feat: upgrade SWG to 4-layer orchestrator with HITL retrain pipeline` | Nâng cấp hệ thống lên cấu trúc 4 lớp điều phối hoàn chỉnh và thiết lập đường ống thu thập dữ liệu huấn luyện lại mô hình (Human-in-the-loop). |
| **`a82da23`** | 2026-05-18 | `chore: update gitignore to ignore model weights and csvs` | Thiết lập `.gitignore` loại bỏ các file trọng số mô hình cồng kềnh (>500MB) và các tệp dữ liệu CSV tạm thời khỏi Git. |
| **`845a218`** | 2026-05-15 | `feat: implement 3-layer security pipeline with human-in-the-loop verification` | Phát triển nền tảng quét 3 lớp cơ bản và hệ thống phản hồi xác minh của quản trị viên (Admin Verification Queue). |
| **`4b64605`** | 2026-04-28 | `refactor: replace Keras MLP with XGBoost classifier using GridSearchCV and add WAF alert logs` | Thay thế mô hình cũ bằng XGBoost kết hợp tối ưu hóa hyperparameter GridSearchCV, bổ sung log ghi nhận cảnh báo WAF. |
| **`15b64e1`** | 2026-04-28 | `First commit: mới làm xong nền WAF modsecurity` | Khởi tạo kho lưu trữ dự án, cấu hình bộ lọc luật WAF ModSecurity Layer 1 cơ bản. |

---

## 🛠️ 3. Hướng Dẫn Xác Minh Trạng Thái Trên GitHub

Toàn bộ lịch sử commit trên máy local đã được đẩy đồng bộ thành công lên GitHub Repository của bạn:

```bash
# Kiểm tra sự đồng bộ giữa Local và GitHub
git status
# Kết quả hiển thị: On branch main. Your branch is up to date with 'origin/main'.
```

### Các bước đẩy nhanh cập nhật thủ công (nếu phát sinh thay đổi mới):
1.  **Stage các thay đổi mới**: `git add .`
2.  **Commit với thông điệp rõ ràng**: `git commit -m "docs: update development changelog and progress report"`
3.  **Đẩy lên GitHub**: `git push origin main`

### 🔴 Vấn đề 6: Cập nhật dữ liệu từ thực tế (Human-in-the-Loop Auto Retraining)
*   **Chi tiết vấn đề**: Mô hình FastText sau khi deploy sẽ dần lỗi thời trước các mánh khóe lừa đảo mới.
*   **Giải pháp v5.0**: Xây dựng **Retraining Control Center** trên Dashboard. Admin duyệt các cảnh báo người dùng báo cáo -> 1 Click Retrain -> Hệ thống tự gom mẫu duyệt vào \csv/vi_dataset.csv\, huấn luyện 30 epoch, trích xuất model \.bin\ mới và Hot-Reload FastText Server :5001 ngay lập tức.
