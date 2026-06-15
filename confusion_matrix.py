"""
confusion_matrix.py
--------------------
Vẽ Confusion Matrix và in Classification Report cho DistilBERT scam detector.
Dataset: csv/vi_dataset.csv  (cột: texts_vi, labels  —  nhãn: 0=Safe, 1=Scam)
"""

import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from sklearn.metrics import confusion_matrix, classification_report
import matplotlib
matplotlib.use('Agg')          # không cần màn hình GUI
import matplotlib.pyplot as plt
import seaborn as sns

# ── 1. Load model ─────────────────────────────────────────────
MODEL_PATH = "./scam_detector_distilbert"
print("⏳ Đang tải model DistilBERT...")
tokenizer = DistilBertTokenizer.from_pretrained(MODEL_PATH)
model     = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()
print("✅ Model đã sẵn sàng\n")

# ── 2. Load dataset ───────────────────────────────────────────
df = pd.read_csv("csv/vi_dataset.csv")
# Lấy tối đa 500 mẫu để chạy nhanh (bỏ giới hạn nếu muốn toàn bộ)
df = df.dropna(subset=["texts_vi", "labels"]).sample(n=min(500, len(df)), random_state=42)

texts  = df["texts_vi"].astype(str).tolist()
# ham = safe (0), spam = scam (1)
label_map = {"ham": 0, "spam": 1}
y_true = df["labels"].map(label_map).fillna(0).astype(int).tolist()

print(f"📊 Số mẫu đánh giá: {len(texts)}")
print(f"   Safe : {y_true.count(0)}  |  Scam : {y_true.count(1)}\n")

# ── 3. Inference ─────────────────────────────────────────────
y_pred = []
BATCH  = 16
for i in range(0, len(texts), BATCH):
    batch = texts[i : i + BATCH]
    enc   = tokenizer(batch, return_tensors="pt", truncation=True,
                      padding=True, max_length=128)
    with torch.no_grad():
        logits = model(**enc).logits
    preds = torch.argmax(logits, dim=1).tolist()
    y_pred.extend(preds)
    print(f"   Đã xử lý: {min(i+BATCH, len(texts))}/{len(texts)}", end="\r")

print()

# ── 4. Classification Report ──────────────────────────────────
print("\n" + "="*55)
print("  CLASSIFICATION REPORT — DistilBERT Scam Detector")
print("="*55)
print(classification_report(y_true, y_pred, target_names=["Safe", "Scam"]))

# ── 5. Confusion Matrix ───────────────────────────────────────
cm = confusion_matrix(y_true, y_pred)

fig, ax = plt.subplots(figsize=(7, 6))
sns.heatmap(
    cm, annot=True, fmt="d", cmap="Blues",
    xticklabels=["Safe (0)", "Scam (1)"],
    yticklabels=["Safe (0)", "Scam (1)"],
    linewidths=0.5, linecolor="white",
    cbar_kws={"shrink": 0.8},
    ax=ax,
)
ax.set_xlabel("Predicted Label", fontsize=11, labelpad=12)
ax.set_ylabel("True Label",      fontsize=11, labelpad=12)
ax.set_title(
    "Confusion Matrix — DistilBERT Scam Detector\n"
    f"(n={len(texts)} samples  |  Acc={sum(p==t for p,t in zip(y_pred,y_true))/len(y_true)*100:.1f}%)",
    fontsize=12, pad=16,
)
plt.tight_layout()
plt.savefig("confusion_matrix_figure.png", dpi=300, bbox_inches="tight")
print("✅ Đã lưu: confusion_matrix_figure.png")