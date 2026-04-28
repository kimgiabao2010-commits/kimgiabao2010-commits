import fasttext
import re

# Copy lại hàm tiền xử lý cho đồng bộ
def preprocess_text(text):
    if not isinstance(text, str): return ""
    text = text.lower()
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\d+', '', text)
    return ' '.join(text.split())

def main():
    model_path = 'scam_detector_distilbert/scam_detector_model_fasttext.bin'
    
    try:
        model = fasttext.load_model(model_path)
        print("✅ Đã tải mô hình FastText thành công!\n")
    except Exception as e:
        print(f"❌ Lỗi: Không tìm thấy file '{model_path}'.")
        return

    # DANH SÁCH CÁC CÂU TEST KỊCH BẢN (TEST CASES)
    test_cases = [
        # --- KỊCH BẢN LỪA ĐẢO (SCAM) ---
        "Cảnh báo: Tài khoản VCB của bạn đăng nhập thiết bị lạ, nhấp vào http://vcb-fake.com để hủy.",
        "Tuyển CTV chốt đơn Shopee, làm tại nhà ngày kiếm 500k-1tr, không cọc.",
        "Chúc mừng thuê bao 09xx trúng thưởng xe SH, nạp thẻ 200k để làm thủ tục nhận giải.",
        "Em là nhân viên hải quan, anh gửi em 5 triệu phí thông quan để nhận kiện hàng từ Mỹ nhé.",
        "Link tải app sex mbbg show hàng cực mượt: http://link-ban-b.tk",
        
        # --- KỊCH BẢN BÌNH THƯỜNG (LEGIT) ---
        "Sếp ơi em gửi link báo cáo tuần này trên Google Drive nhé: https://drive.google.com/...",
        "Tối nay 7h đá bóng sân cỏ nhân tạo nhé anh em, nhớ đi đúng giờ.",
        "Em chào anh, anh cho em hỏi đồ án tốt nghiệp nộp bản cứng hay bản mềm ạ?",
        "Mẹ ơi con hết tiền tiêu tháng này rồi, mẹ chuyển khoản cho con với nhé.",
        "Gửi các bạn sinh viên lịch thi học kỳ 2 năm học 2025-2026."
    ]

    print("="*80)
    print(f"{'NỘI DUNG TIN NHẮN':<60} | {'DỰ ĐOÁN':<10} | {'ĐỘ TỰ TIN'}")
    print("="*80)

    # NGƯỠNG ĐÁNH GIÁ (THRESHOLD) = 70%
    SCAM_THRESHOLD = 0.70 

    for text in test_cases:
        clean_text = preprocess_text(text)
        
        if not clean_text:
            continue
            
        # Lấy tỷ lệ % của cả 2 nhãn
        predictions = model.predict(clean_text, k=2) 
        
        # Thuật toán tìm tỷ lệ Scam (Bỏ qua lỗi Pylance bằng type: ignore)
        scam_prob = 0.0
        labels = predictions[0]  # type: ignore
        probs = predictions[1]   # type: ignore
        
        for i, lbl in enumerate(labels):
            if 'scam' in lbl.lower():
                scam_prob = probs[i]
                
        # Áp dụng luật: Lớn hơn hoặc bằng 70% Scam mới phạt
        if scam_prob >= SCAM_THRESHOLD:
            label = "Scam"
            confidence = scam_prob * 100
            color = '\033[91m' # Màu Đỏ
        else:
            label = "Legit"
            confidence = (1.0 - scam_prob) * 100
            color = '\033[92m' # Màu Xanh
            
        short_text = (text[:57] + '...') if len(text) > 60 else text
        reset = '\033[0m'
        
        print(f"{short_text:<60} | {color}{label:<10}{reset} | {confidence:.1f}%")

    print("="*80)
    print("✅ Hoàn thành chạy Test Cases tự động!")

if __name__ == "__main__":
    main()
