import fasttext
import re

def preprocess_text(text):
    text = text.lower()
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'\S+@\S+', '', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\d+', '', text)
    text = ' '.join(text.split())
    return text

model = fasttext.load_model('scam_detector_distilbert/scam_detector_model_fasttext.bin')

tests = [
"""Công ty TNHH TekCore tuyển dụng lập trình viên.
Công việc: Lập trình phần mềm, đảm bảo chất lượng sản phẩm tốt.
Yêu cầu: Kinh nghiệm 1 năm. Làm việc uy tín, cẩn thận.
Mức lương: Thỏa thuận. Hồ sơ gửi qua email.""",

"""Tuyển dụng nhân viên bán hàng.
Sản phẩm chính hãng, chất lượng tốt.
Công việc: Tư vấn cho khách hàng mua hàng, hỗ trợ giao hàng nhanh chóng.
Đóng gói cẩn thận. Rất mong được hợp tác.""",

"""Tuyển nhân viên CSKH. Yêu cầu giao tiếp tốt, tư vấn uy tín chất lượng."""
]

for t in tests:
    p = preprocess_text(t)
    pred = model.predict(p, k=1)
    print(f"[{pred[0][0]}] (conf: {pred[1][0]:.4f}) - {t[:50]}...")
