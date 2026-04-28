import pandas as pd
import re
import fasttext
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

FILE_NAME = 'csv/train.csv'
FASTTEXT_MODEL_FILE = 'scam_detector_distilbert/scam_detector_model_fasttext.bin'
FASTTEXT_TRAIN_FILE = 'fasttext_train.txt'
FASTTEXT_TEST_FILE = 'fasttext_test.txt'

# NGƯỠNG ĐÁNH GIÁ: >= 70% mới coi là lừa đảo
SCAM_THRESHOLD = 0.70 

def preprocess_text(text):
    if not isinstance(text, str): return ""
    text = text.lower()
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\d+', '', text)
    return ' '.join(text.split())

def main():
    print("\n" + "="*80)
    print("TRAIN MODEL - FASTTEXT (HỆ THỐNG XỬ LÝ DỮ LIỆU ĐA CỘT)")
    print("="*80)

    try:
        # Đọc file bình thường, Pandas tự phân tích các cột
        df = pd.read_csv(FILE_NAME, encoding='utf-8')
        print(f"🔍 Phát hiện file '{FILE_NAME}' có {len(df.columns)} cột: {list(df.columns)}")
        
        # 1. TỰ ĐỘNG TÌM VÀ ĐỔI TÊN CỘT
        rename_map = {}
        for col in df.columns:
            col_lower = str(col).strip().lower()
            # Tìm cột chứa tin nhắn
            if col_lower in ['content', 'text', 'message', 'văn bản', 'nội dung', 'comment', 'review']:
                rename_map[col] = 'Message'
            # Tìm cột chứa nhãn lừa đảo (0/1)
            if col_lower in ['label', 'nhãn', 'target', 'is_spam', 'spam', 'phân loại', 'class']:
                rename_map[col] = 'Label'
                
        df = df.rename(columns=rename_map)
        
        # 2. TRÍCH XUẤT ĐÚNG 2 CỘT CẦN THIẾT (Vứt bỏ 9 cột thừa)
        if 'Message' in df.columns and 'Label' in df.columns:
            df = df[['Message', 'Label']]
            print("✅ Đã tự động trích xuất thành công cột Nội dung và Nhãn!")
        else:
            print("\n❌ TRỞ NGẠI: File có 11 cột nhưng AI không tự đoán được cột nào chứa văn bản, cột nào chứa nhãn 0/1!")
            print("👉 CÁCH FIX DỄ NHẤT: Bạn hãy mở file train.csv bằng Excel, đổi tên cái cột chứa câu tin nhắn thành 'Message', cột chứa kết quả thành 'Label' rồi nhấn lưu (Ctrl+S) lại là xong.")
            return

    except FileNotFoundError:
        print(f"❌ Lỗi: Không tìm thấy file '{FILE_NAME}'")
        return
    except Exception as e:
        print(f"❌ Lỗi khi đọc file: {e}")
        return

    # Xóa các dòng bị trống
    df.dropna(subset=['Message', 'Label'], inplace=True)

    # TỰ ĐỘNG CHUẨN HÓA NHÃN (Biến 0/1 thành Legit/Scam)
    df['Label'] = df['Label'].astype(str).str.strip().str.capitalize()
    df['Label'] = df['Label'].replace({
        '1': 'Scam', '1.0': 'Scam', 'Spam': 'Scam',
        '0': 'Legit', '0.0': 'Legit'
    })

    # Dọn dẹp nốt nếu có dòng chữ rác lọt vào
    df = df[df['Label'].isin(['Scam', 'Legit'])]

    total_samples = len(df)
    scam_count = len(df[df['Label'] == 'Scam'])
    print(f"📊 Đã chuẩn hóa data: Tổng {total_samples} mẫu (Scam: {scam_count}, Legit: {total_samples - scam_count})")

    X = df['Message']
    y = df['Label']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("⏳ Đang tạo file huấn luyện...")
    with open(FASTTEXT_TRAIN_FILE, 'w', encoding='utf-8') as f:
        for x_val, y_val in zip(X_train.tolist(), y_train.tolist()):
            text = preprocess_text(x_val)
            if text: f.write(f'__label__{str(y_val).lower()} {text}\n')

    with open(FASTTEXT_TEST_FILE, 'w', encoding='utf-8') as f:
        for x_val, y_val in zip(X_test.tolist(), y_test.tolist()):
            text = preprocess_text(x_val)
            if text: f.write(f'__label__{str(y_val).lower()} {text}\n')

    print("🚀 Đang huấn luyện mô hình FastText (Epochs=25)...")
    model = fasttext.train_supervised(
        input=FASTTEXT_TRAIN_FILE, dim=100, lr=0.1, epoch=25, 
        wordNgrams=2, minn=3, maxn=6, loss='softmax', verbose=2
    )

    print("\n" + "="*80)
    print(" KẾT QUẢ ĐÁNH GIÁ MÔ HÌNH (ÁP DỤNG NGƯỠNG SCAM >= 70%)")
    print("="*80)

    y_pred, y_true = [], []
    for x_val, y_val in zip(X_test.tolist(), y_test.tolist()):
        text = preprocess_text(x_val)
        if text:
            predictions = model.predict(text, k=2)
            scam_prob = 0.0
            for i, lbl in enumerate(predictions[0]):
                if 'scam' in lbl.lower():
                    scam_prob = predictions[1][i]
            
            prediction = 'Scam' if scam_prob >= SCAM_THRESHOLD else 'Legit'
            y_pred.append(prediction)
            y_true.append(y_val)

    accuracy = accuracy_score(y_true, y_pred)
    print(f"\n🎯 Accuracy: {accuracy:.4f}")
    print("\n📊 Classification Report:")
    print(classification_report(y_true, y_pred, zero_division=0))

    model.save_model(FASTTEXT_MODEL_FILE)
    print(f"\n💾 Đã lưu model thành công vào: {FASTTEXT_MODEL_FILE}")

    # --- KHU VỰC CHAT THỬ NGHIỆM ---
    print("\n\n" + "="*80)
    print(" KHU VỰC KIỂM TRA MÔ HÌNH SAU KHI TRAIN")
    print("="*80)
    while True:
        tin_nhan = input("\n👉 NHẬP TIN NHẮN (hoặc 'thoat'): ")
        if tin_nhan.lower() in ('thoat', 'exit', 'quit'): break
            
        text = preprocess_text(tin_nhan)
        if not text: continue
            
        predictions = model.predict(text, k=2)
        scam_prob = 0.0
        for i, lbl in enumerate(predictions[0]):
            if 'scam' in lbl.lower():
                scam_prob = predictions[1][i]
        
        if scam_prob >= SCAM_THRESHOLD:
            status = "🚨 CẢNH BÁO: LỪA ĐẢO/SCAM"
            color = '\033[91m'
            confidence = scam_prob * 100
        else:
            status = "✅ AN TOÀN (LEGIT)"
            color = '\033[92m'
            confidence = (1.0 - scam_prob) * 100

        print(f"{color}Kết quả: {status}")
        print(f"🛡️ Độ tự tin Scam: {scam_prob*100:.1f}%\033[0m")

if __name__ == "__main__":
    main()
