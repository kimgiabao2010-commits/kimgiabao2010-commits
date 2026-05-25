# Secure Web Gateway (SWG) — Human-in-the-Loop Pipeline

Hệ thống Secure Web Gateway với kiến trúc 3 lớp AI chuyên dụng chặn và lọc nội dung lừa đảo (Scam/Phishing) thời gian thực. Hệ thống hỗ trợ vòng lặp phản hồi (Human-in-the-Loop) giúp quản trị viên có thể kiểm duyệt và huấn luyện lại (Retrain) mô hình trực tiếp qua Dashboard.

## 🌟 Kiến trúc 3 Lớp (Defense-in-Depth)

Hệ thống phân tích các payload theo 3 lớp chặn đứng để cân bằng giữa TỐC ĐỘ và ĐỘ CHÍNH XÁC:

1. **Layer 1: Pattern Engine (WAF - Chặn luật cứng)**
   - Khớp nối các mẫu chuỗi Regex, signature độc hại, từ khóa cấm kỵ.
   - Trả về ngay lập tức nếu độ rủi ro đạt ngưỡng 100%.

2. **Layer 2: FastText AI (Tốc độ ánh sáng)**
   - Phân tích ngữ nghĩa cơ bản với FastText (100 chiều).
   - Đặc điểm: Cực nhanh, giúp giảm tải hệ thống. Mô hình này **được phép Retrain trực tiếp** thông qua Admin Dashboard.

3. **Layer 3: DistilBERT (Chuyên sâu)**
   - Phân tích ngữ cảnh (Contextual AI) đa chiều sử dụng mô hình Transformer.
   - Quyết định cuối cùng và độ tin cậy sâu nhất, dùng cho các case mà FastText chưa tự tin hoặc bị bypass.

---

## 🛠️ Cài đặt & Khởi chạy

### 1. Khởi chạy toàn bộ hệ thống bằng 1 click (Khuyên dùng)
Hệ thống đã được tích hợp phím tắt trên VS Code:
- Nhấn **`Ctrl + Shift + B`** trong VS Code.
- Cửa sổ nhỏ (menu Dropdown) của VS Code sẽ hỏi bạn, hãy chọn: **`🚀 Khởi chạy Toàn bộ Hệ Thống (SWG)`**.
*Tiến trình này sẽ tự động chạy 4 server API (Port 8000, 5001, 5002, 5003) và bật luôn cả React Admin Dashboard ở cổng 3000.*

*(Ngoài ra bạn cũng có thể click đúp chuột vào file `start_all.bat` ngoài Desktop/Thư mục)*.

### 2. Cài đặt Browser Extension (Web Shield)
1. Trong VS Code, nhấn **`Ctrl + Shift + B`** và chọn **`📦 Đóng gói Extension (Production Build)`**.
   > Lệnh này tự động tạo một thư mục `dist` siêu nhẹ trong `swg-frontend/dist`.
2. Mở Google Chrome hoặc Edge, truy cập `chrome://extensions`.
3. Bật **Developer Mode** (Chế độ dành cho nhà phát triển).
4. Chọn **Load unpacked** (Tải tiện ích đã giải nén) và trỏ vào thư mục `swg-frontend/dist`.

---

## 🔁 Luồng Retraining FastText (Human-in-the-loop)

Một trong những tính năng mạnh mẽ nhất của hệ thống là khả năng học thêm dữ liệu Lừa Đảo mới mà không cần lập trình viên can thiệp:

1. **User Request:** Người dùng bôi đen đoạn chat/website nghi ngờ -> Chuột phải -> **Quét bằng SWG Shield**.
2. **Admin Verify:** Trên trang Admin Dashboard, quản trị viên xem lại lịch sử quét và đưa ra phán quyết (Verdict) là `Mẫu Scam mới` hoặc `An toàn (Legit)`.
3. **Trigger Retrain:** Nhấn nút **KÍCH HOẠT RETRAIN FASTTEXT** trên Dashboard.
4. **Pipeline:** Hệ thống ngầm nối file data cũ `csv/vi_dataset.csv`, nhồi thêm dữ liệu đã duyệt, chạy 30 epoch, lưu mô hình `.bin` và Hot-Reload server :5001.

Tất cả diễn ra hoàn toàn tự động chỉ với 1 cú click!
