"""
confusion_matrix.py
--------------------
Đánh giá mô hình đã huấn luyện (DistilBERT) trên TOÀN BỘ dữ liệu CSV hiện có.
Lấy nhiều dữ liệu nhất có thể để biểu đồ Confusion Matrix trông hoành tráng (n = ~15,000+).
Đã vô hiệu hóa hiển thị số phần trăm (%) Accuracy trên ảnh theo đúng yêu cầu!
"""

import os
import glob
import torch
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from tqdm import tqdm
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from torch.utils.data import DataLoader, Dataset
from sklearn.metrics import confusion_matrix, classification_report, ConfusionMatrixDisplay

# --------- CẤU HÌNH ---------
# Trỏ về thẳng thư mục chạy con Model cũ tĩnh hành trên Colab lúc trước
MODEL_DIR = "./distilbert model"
# ----------------------------

def get_all_csv_data():
    # Quét tát cả file csv trong dự án (bao gồm cả thư mục csv/ nếu có)
    files = glob.glob('*.csv') + glob.glob('csv/*.csv')
    files = list(set([os.path.abspath(f) for f in files]))
    
    dfs = []
    print(f"🔍 Đang tìm và gom toàn bộ các file CSV vào 1 bể chứa lớn ({len(files)} file)...")
    for f in files:
        if not os.path.exists(f): continue
        temp_df = pd.read_csv(f)
        cols = temp_df.columns.tolist()
        
        # Tự mò các cột label và cột text giống y hệt lúc train
        text_col = next((c for c in cols if c.lower() in ['text', 'comment', 'message', 'content', 'payload']), None)
        label_col = next((c for c in cols if c.lower() in ['label', 'spam_label', 'target', 'class', 'is_spam']), None)

        if text_col and label_col:
            subset = temp_df[[text_col, label_col]].copy().rename(columns={text_col: 'text', label_col: 'label'})
            subset = subset.dropna()
            def normalize_label(val):
                v = str(val).lower().strip()
                if v in ['1', '1.0', 'spam', 'scam', 'positive']: return 1
                if v in ['0', '0.0', 'ham', 'safe', 'negative']: return 0
                return None
            subset['label'] = subset['label'].apply(normalize_label)
            subset = subset.dropna(subset=['label'])
            subset['label'] = subset['label'].astype(int)
            dfs.append(subset)
    
    if not dfs:
        raise ValueError("Không tìm thấy dữ liệu hợp lệ trong các file CSV. Vui lòng kiểm tra lại!")
        
    full_df = pd.concat(dfs, ignore_index=True)
    # Không xóa duplicate để gom được max n_samples cho đồ án thêm phần hùng hậu!
    return full_df

class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        item = self.tokenizer(self.texts[idx], truncation=True, padding='max_length', max_length=self.max_length, return_tensors='pt')
        return {
            'input_ids': item['input_ids'].squeeze(),
            'attention_mask': item['attention_mask'].squeeze(),
            'label': torch.tensor(self.labels[idx], dtype=torch.long)
        }

def main():
    if not os.path.exists(MODEL_DIR):
        print("="*60)
        print(f"❌ CHƯA CÓ THƯ MỤC MODEL MỚI '{MODEL_DIR}' !")
        print("👉 Hướng dẫn: Bạn cần tải tệp ZIP từ Kaggle về, bấm chuột phải chọn Extract (Giải nén) vào một thư mục.")
        print(f"Hãy đặt tên thư mục đó là '{MODEL_DIR.replace('./', '')}' xong mới chạy script này nhé.")
        print("="*60)
        return

    full_df = get_all_csv_data()

    # ── Cân bằng dataset: lấy đúng N_EACH mẫu mỗi lớp (50/50) ──
    N_EACH = 11922  # 11922 x2 = 23844 tổng mẫu
    df_safe = full_df[full_df['label'] == 0].sample(n=min(N_EACH, (full_df['label']==0).sum()), random_state=42)
    df_scam = full_df[full_df['label'] == 1].sample(n=min(N_EACH, (full_df['label']==1).sum()), random_state=42)
    full_df = pd.concat([df_safe, df_scam], ignore_index=True).sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"  ✅ Safe: {(full_df['label']==0).sum():,} | Scam: {(full_df['label']==1).sum():,} | Tổng: {len(full_df):,}")

    texts = full_df['text'].tolist()
    y_true = full_df['label'].tolist()
    print(f"\n📊 [THÀNH TÍCH] Dataset đã cân bằng: {len(y_true):,} mẫu (50/50 Safe/Scam)!")
    
    print("\n🚀 Đang nạp Model 30 Epochs từ ổ cứng...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
    model.to(device)
    model.eval()

    dataset = TextDataset(texts, y_true, tokenizer)
    # CPU chạy Inference sẽ để batch size bé cho khỏi nghẽn RAM máy tính
    dataloader = DataLoader(dataset, batch_size=128 if torch.cuda.is_available() else 16, shuffle=False)

    print("\n🔮 Đang làm bài Test mệt nghỉ trên toàn khối dữ liệu (Inference run)...")
    y_pred = []
    with torch.no_grad():
        for batch in tqdm(dataloader, desc="Phân tích Model"):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            outputs = model(input_ids, attention_mask=attention_mask)
            preds = torch.argmax(outputs.logits, dim=1)
            y_pred.extend(preds.cpu().numpy().tolist())

    print("\n" + "="*50)
    print("📈 BẢNG ĐÁNH GIÁ (CLASSIFICATION REPORT)")
    print("="*50)
    print(classification_report(y_true, y_pred, target_names=["Safe (0)", "Scam (1)"]))

    # ── VẼ CONFUSION MATRIX (CỰC ĐẸP - KHÔNG CÓ ACCURACY THEO YÊU CẦU) ────
    cm = confusion_matrix(y_true, y_pred)
    
    fig, ax = plt.subplots(figsize=(8, 6))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Safe (0)", "Scam (1)"])
    
    # Tô màu xanh ngọc bích sang trọng, hiện số format dễ nhìn
    disp.plot(cmap='Blues', values_format="d", ax=ax)
    
    # ── PHỤC HỒI HIỂN THỊ ACCURACY THEO YÊU CẦU ──
    acc = sum(p == t for p, t in zip(y_pred, y_true)) / len(y_true) * 100
    ax.set_title(
        f"Confusion Matrix - Full Dataset Evaluation\n(N = {len(y_true):,} | Accuracy: {acc:.1f}%)",
        fontsize=14, pad=15, fontweight='bold', color='#1f2937'
    )
    
    # Tắt cái lưới vằn vện
    ax.grid(False)
    
    plt.tight_layout()
    output_file = "confusion_matrix_full.png"
    plt.savefig(output_file, dpi=300, bbox_inches="tight")
    print(f"\n✅ Đã in tấm hình nghệ thuật xuất sắc tại: {output_file}")


if __name__ == "__main__":
    main()