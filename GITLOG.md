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

### 🔴 Vấn đề 7: Cập nhật dữ liệu từ thực tế (Human-in-the-Loop Auto Retraining)
*   **Chi tiết vấn đề**: Mô hình FastText sau khi deploy sẽ dần lỗi thời trước các mánh khóe lừa đảo mới. Không có cơ chế nào để Admin tổng hợp phản hồi từ người dùng cuối và cập nhật lại dataset huấn luyện chính (`csv/vi_dataset.csv`).
*   **Giải pháp v5.0**: Xây dựng **Retraining Control Center** trên Dashboard. Admin duyệt các cảnh báo người dùng báo cáo → 1 Click Retrain → Hệ thống tự gom mẫu duyệt vào `csv/vi_dataset.csv`, huấn luyện 30 epoch, trích xuất model `.bin` mới và Hot-Reload FastText Server :5001 ngay lập tức. Pipeline tự động dedup dữ liệu, đảm bảo `python main_fasttext.py` luôn train trên dataset lớn nhất.

---

## 📅 2. Nhật Ký Lịch Sử Commit (Git Commit History)

Dưới đây là chi tiết các mốc commit chính trong kho lưu trữ Git của dự án:

| Commit Hash | Ngày thực hiện | Tên Commit / Tính năng | Mô Tả Kỹ Thuật Chi Tiết |
| :--- | :--- | :--- | :--- |
| **`(latest)`** | 2026-07-01 | `feat: build PPTX export pipeline, automated stop-motion support, slides refactoring` | Hoàn thiện công cụ xuất Slide HTML sang PowerPoint qua puppeteer và pptxgenjs. Tổ chức lại thư mục `/slides` để lưu trữ tập trung tài sản thuyết trình đồ án tốt nghiệp. |
| **`b0e19d7`** | 2026-06-15 | `chore: add confusion matrix scripts, update training data, sync DB` | Bổ sung `confusion_matrix.py` và `confusion_matrix_figure.png` để trực quan hóa hiệu năng mô hình. Cập nhật `fasttext_train.txt` với dữ liệu huấn luyện mới nhất. Đồng bộ `swg_shield.db`. |
| **`9955b58`** | 2026-06-08 | `docs: redesign PROJECT_STRUCTURE.md with ASCII art, flowchart and enterprise layout` | Tái thiết kế hoàn toàn `PROJECT_STRUCTURE.md` với sơ đồ ASCII art, flowchart kiến trúc hệ thống và bố cục trình bày chuẩn Enterprise cho báo cáo tốt nghiệp. |
| **`ebd6cc9`** | 2026-06-08 | `docs: add PROJECT_STRUCTURE.md — full annotated directory tree for thesis report` | Khởi tạo tệp `PROJECT_STRUCTURE.md` mô tả toàn bộ cây thư mục dự án với chú thích chi tiết phục vụ báo cáo đồ án tốt nghiệp. |
| **`bcd29f1`** | 2026-06-06 | `feat(security): upgrade full stack to HTTPS via local CA (mkcert) and secure admin login` | Nâng cấp toàn bộ hệ thống lên HTTPS thông qua chứng chỉ Local CA tự ký bằng `mkcert`. Bảo mật cổng đăng nhập Admin Dashboard. Tích hợp `localhost+1.pem` và `localhost+1-key.pem`. |
| **`20a5626`** | 2026-05-28 | `v4.0.1: Full-stack audit cleanup — Fix typos, add Report API health check, remove 19 dead files` | Rà soát toàn diện toàn bộ stack. Sửa lỗi đánh máy, thêm health check cho Report API, loại bỏ 19 file dead code không còn sử dụng. |
| **`d07888c`** | 2026-05-26 | `fix: revert pseudo-label self-training loop to prevent confirmation bias` | Gỡ bỏ vòng lặp tự huấn luyện pseudo-label vì gây ra Confirmation Bias — mô hình tự củng cố lỗi sai. Khôi phục pipeline HITL thuần túy. |
| **`f36449e`** | 2026-05-26 | `feat: auto-ingest recent telemetry scans into retrain pipeline for implicit self-training` | Tự động đưa các bản ghi quét từ `_scan_log_history` vào pipeline huấn luyện theo cơ chế Implicit Self-Training, tăng liên tục kích thước tập dữ liệu. |
| **`1c0bd95`** | 2026-05-26 | `ux: revert banner labels to 'AI Confidence' per user request` | Khôi phục nhãn "AI Confidence" trên banner cảnh báo Extension theo yêu cầu người dùng. |
| **`9bfc0bb`** | 2026-05-26 | `chore: untrack dataset/log files already in gitignore and clean up temp test scripts` | Gỡ tracking các file dataset và log đã có trong `.gitignore`. Dọn sạch script test tạm thời. |
| **`01913c3`** | 2026-05-26 | `audit: comprehensive project review — fix log, clean junk, update GITLOG` | Rà soát toàn bộ 10+ file source code. Fix log sai ngữ nghĩa trong `main_fasttext.py`. Xóa file rác `old_dash.jsx`. Cập nhật GITLOG đầy đủ 7 vấn đề và bảng commit mới nhất. |
| **`bc134c5`** | 2026-05-25 | `docs: finalize deployment resources, add README, VS Code tasks, start_all.bat` | Thêm `README.md` mô tả kiến trúc 3 lớp AI, tích hợp `Ctrl+Shift+B` để khởi chạy toàn bộ hệ thống hoặc build Extension, cập nhật `start_all.bat` thêm React Dashboard. |
| **`aa6f2a9`** | 2026-05-25 | `revert: remove Model Evaluation panel per user request` | Gỡ bỏ hoàn toàn khung Model Evaluation khỏi Dashboard theo yêu cầu của người dùng. Chỉ giữ lại Retraining Control Center. |
| **`fd47702`** | 2026-05-25 | `feat: auto-append retrain data to csv/vi_dataset.csv` | Tích hợp bước merge tự động dữ liệu đã duyệt vào `csv/vi_dataset.csv` trong retrain pipeline, đảm bảo `python main_fasttext.py` luôn training trên dataset lớn nhất. Dedup theo nội dung text. |
| **`4567ce0`** | 2026-05-25 | `feat: replace live intercept logs with FastText Retraining Control Center` | Thay thế bảng Live Intercept Logs bằng Retraining Control Center hoàn chỉnh với terminal log stream, pending report counter, và auto-polling. |
| **`cfcf5df`** | 2026-05-24 | `fix: rename MODEL_BIN_PATH to FASTTEXT_MODEL_BIN and clarify all train logs` | Đổi tên biến môi trường cho rõ nghĩa. Thêm nhãn `[FASTTEXT]` vào tất cả log huấn luyện giúp dễ phân biệt giữa các model service. |
| **`a9d38eb`** | 2026-05-24 | `fix: flush stdout logs in retrain_pipeline & update GITLOG` | Vá lỗi "im lặng hoàn toàn" của Background Task huấn luyện FastText trên Windows. Thêm `force=True` vào `logging.basicConfig()`. |
| **`3fe521e`** | 2026-05-24 | `Update background.js and temp_owasp_crs` | Cập nhật logic `background.js` của Browser Extension và đồng bộ tập luật OWASP CRS tạm thời. |
| **`1fbe771`** | 2026-05-22 | `feat: add POST /api/retrain/fasttext endpoint and Retrain FastText button` | Phát triển endpoint `POST /api/retrain/fasttext` kích hoạt huấn luyện lại FastText 30 epochs qua `BackgroundTasks`. Tích hợp nút "Retrain FastText" vào Admin Verification Queue. |
| **`43c3bd2`** | 2026-05-22 | `Enhance Dashboard Analytics, FastText 1:1 Class Balancing, Restore AI Bypass` | Ba nâng cấp lớn: (1) Risk Score visualization; (2) Cân bằng dataset FastText 1:1; (3) Khôi phục Instant AI Bypass pipeline. |
| **`f8ed980`** | 2026-05-19 | `docs: add comprehensive development gitlog` | Khởi tạo tệp `GITLOG.md` ghi nhận toàn bộ lịch sử phát triển và giải pháp triển khai. |
| **`712ad1c`** | 2026-05-19 | `feat: Code Freeze v4.0 — Cache+RateLimit+ZeroTrust+WAF-HotReload+XAI+Docker` | **Bản phát hành Code Freeze v4.0 cuối cùng**. Tích hợp TTLCache, SlowAPI, X-API-Key, WAF hot-reload, LIME XAI, Docker. |
| **`15b64e1`** | 2026-04-28 | `First commit: mới làm xong nền WAF modsecurity` | Khởi tạo kho lưu trữ dự án, cấu hình WAF ModSecurity Layer 1 cơ bản. |

---

## 🛠️ 3. Hướng Dẫn Xác Minh Trạng Thái Trên GitHub

Toàn bộ lịch sử commit trên máy local đã được đẩy đồng bộ thành công lên GitHub Repository:

```bash
# Kiểm tra sự đồng bộ giữa Local và GitHub
git status
# Kết quả hiển thị: On branch main. Your branch is up to date with 'origin/main'.
```

### Các bước đẩy nhanh cập nhật thủ công (nếu phát sinh thay đổi mới):
1.  **Stage các thay đổi mới**: `git add .`
2.  **Commit với thông điệp rõ ràng**: `git commit -m "docs: update development changelog and progress report"`
3.  **Đẩy lên GitHub**: `git push origin main`
