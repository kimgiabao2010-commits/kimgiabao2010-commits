from flask import Flask, request, jsonify
from flask_cors import CORS
import fasttext
import re
import sys
import threading

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# --- CẤU HÌNH ---
FASTTEXT_MODEL_FILE = 'scam_detector_distilbert/scam_detector_model_fasttext.bin'

# --- KHỞI TẠO FLASK APP ---
app = Flask(__name__)
CORS(app)

# Lock để bảo vệ model khi reload (thread-safe)
_model_lock = threading.Lock()

# --- HÀM TIỀN XỬ LÝ TEXT (PHẢI GIỐNG VỚI main_fasttext.py) ---
def preprocess_text(text):
    """Tiền xử lý text cho FastText."""
    if not isinstance(text, str):
        return ""
    
    text = text.lower()
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\d+', '', text)
    text = ' '.join(text.split())
    
    return text

# --- TẢI FASTTEXT MODEL ---
print(" Đang tải FastText model...")
try:
    model = fasttext.load_model(FASTTEXT_MODEL_FILE)
    print(" Đã tải thành công: FastText Model")
except Exception as e:
    print(f" LỖI NGHIÊM TRỌNG: Không tải được model '{FASTTEXT_MODEL_FILE}'")
    print(f"   Chi tiết lỗi: {e}")
    print("  Hãy chạy 'main_fasttext.py' để train model trước.")
    sys.exit(1)

# --- API ENDPOINT ---
@app.route('/predict', methods=['POST'])
def predict():
    try:
        # 1. Lấy dữ liệu từ request
        data = request.get_json(force=True)
        message = data.get('message', '')
        
        # Kiểm tra input rỗng
        if not message or str(message).strip() == "":
            return jsonify({'error': 'Vui lòng nhập nội dung tin nhắn.'}), 400
        
        # 2. Tiền xử lý text
        processed_text = preprocess_text(message)
        
        if not processed_text:
            return jsonify({'error': 'Tin nhắn không hợp lệ sau xử lý.'}), 400
        
        # 3. Dự đoán với FastText (thread-safe với lock)
        with _model_lock:
            predictions = model.predict(processed_text, k=2)  # Lấy top 2 predictions
        
        # Parse kết quả
        label = predictions[0][0].replace('__label__', '').capitalize()
        confidence = float(predictions[1][0])
        
        # 4. Tính trust score (xác suất của Legit)
        if label == 'Legit':
            trust_score = confidence
        else:
            if len(predictions[0]) > 1 and '__label__legit' in predictions[0][1]:
                trust_score = float(predictions[1][1])
            else:
                # Ước tính trust score = 1 - scam_confidence
                trust_score = 1 - confidence
        
        # 5. Trả kết quả
        return jsonify({
            'prediction': label,
            'probability': trust_score,  # Trả về trust score (xác suất Legit)
            'confidence': confidence,    # Xác suất của prediction chính
            'model': 'FastText'
        })
    
    except Exception as e:
        print(f"Lỗi khi xử lý dự đoán: {e}")
        return jsonify({'error': f'Lỗi server khi xử lý dữ liệu: {str(e)}'}), 500

# --- ENDPOINT HOT-RELOAD MODEL (dùng bởi retrain_pipeline.py) ---
@app.route('/reload', methods=['POST'])
def reload_model():
    """
    Nạp lại FastText model từ disk mà không cần restart server.
    Được gọi tự động bởi retrain_pipeline.py sau mỗi lần retrain.
    Thread-safe: dùng _model_lock để bảo vệ trong quá trình swap model.
    """
    global model
    print(f" Nhận yêu cầu reload model từ: {FASTTEXT_MODEL_FILE}")
    try:
        new_model = fasttext.load_model(FASTTEXT_MODEL_FILE)
        with _model_lock:
            model = new_model
        print(" Model đã được reload thành công (hot-reload).")
        return jsonify({
            'status': 'ok',
            'message': 'FastText model đã được nạp lại thành công.',
            'model_file': FASTTEXT_MODEL_FILE,
        }), 200
    except Exception as e:
        print(f" LỖI khi reload model: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Không thể reload model: {str(e)}',
        }), 500

# --- ENDPOINT ĐỂ KIỂM TRA SERVER ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'model': 'FastText',
        'model_file': FASTTEXT_MODEL_FILE
    })

# --- CHẠY SERVER ---
if __name__ == '__main__':
    print("=" * 60)
    print(" FASTTEXT API SERVER")
    print("=" * 60)
    print(" URL: http://127.0.0.1:5001")
    print(" Model: FastText (Character N-grams + Word Embeddings)")
    print(" Đặc điểm:")
    print("    Xử lý được typos và teencode")
    print("    Hiểu ngữ nghĩa (từ đồng nghĩa)")
    print("    Xử lý từ chưa gặp (OOV)")
    print("=" * 60)
    app.run(debug=True, port=5001, use_reloader=False)
