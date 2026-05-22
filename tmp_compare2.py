import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def get_preds(model_path, texts):
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    
    results = []
    with torch.no_grad():
        inputs = tokenizer(texts, return_tensors="pt", truncation=True, max_length=512, padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        logits = model(**inputs).logits
        probs = torch.nn.functional.softmax(logits, dim=-1).cpu().numpy()
        
        for i, prob in enumerate(probs):
            pred_class = int(prob.argmax())
            conf = prob[pred_class]
            results.append((pred_class, conf))
    return results

texts = [
    "Công ty TNHH TekCore tuyển dụng lập trình viên. Yêu cầu: Kinh nghiệm 1 năm. Làm việc uy tín, cẩn thận. Mức lương: Thỏa thuận. Hồ sơ gửi qua email.",
    "Khách hàng trúng thưởng quà tặng ý nghĩa 1 xe SH và 2 lượng vàng SJC, liên hệ tổng đài 1900xxxx để nhận thưởng ngay. Lưu ý phí nhận hồ sơ 200k",
    "Tuyển dụng nhân viên làm thêm tại nhà, chỉ cần xem video TikTok, nhận lương ngày từ 500k-1 triệu. Đăng ký nhận hoa hồng.",
    "Kính mời anh chị tới dự lễ khai trương chi nhánh mới của cửa hàng mỹ phẩm ABC.",
    "Tài khoản ngân hàng của bạn đang bị khóa do nghi ngờ giao dịch bất hợp pháp. Vui lòng bấm vào link để xác minh lại danh tính."
]
labels = ["Legit", "Scam", "Scam", "Legit", "Scam"]

old = get_preds("scam_detector_distilbert_old_3epoch", texts)
new = get_preds("scam_detector_distilbert", texts)

with open('results2.txt', 'w', encoding='utf-8') as f:
    f.write("=== SO SÁNH CONFIDENCE: 3 EPOCH VS 30 EPOCH ===\n")
    for i, txt in enumerate(texts):
        f.write(f"\nText: {txt[:80]}...\n")
        f.write(f"Ground Truth: {labels[i]}\n")
        
        o_cls = "Scam" if old[i][0] == 1 else "Legit"
        o_conf = old[i][1]
        
        n_cls = "Scam" if new[i][0] == 1 else "Legit"
        n_conf = new[i][1]
        
        f.write(f"3 Epoch : {o_cls} ({o_conf:.2%})\n")
        f.write(f"30 Epoch: {n_cls} ({n_conf:.2%})\n")
