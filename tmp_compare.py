import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import csv
import time

def evaluate_model(model_name_or_path, csv_path):
    print(f"Loading {model_name_or_path}...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_name_or_path)
        model.eval()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)
    except Exception as e:
        print(f"Error loading model {model_name_or_path}: {e}")
        return None
    
    texts = []
    labels = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 2:
                try:
                    text = row[0].strip()
                    label = int(row[1].strip())
                    texts.append(text)
                    labels.append(label)
                except ValueError:
                    continue
    
    tp, tn, fp, fn = 0, 0, 0, 0
    start_time = time.time()
    
    with torch.no_grad():
        for i in range(0, len(texts), 16):
            batch_texts = texts[i:i+16]
            batch_labels = labels[i:i+16]
            if not batch_texts: break
            
            inputs = tokenizer(batch_texts, return_tensors="pt", truncation=True, max_length=512, padding=True)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            logits = model(**inputs).logits
            preds = torch.argmax(logits, dim=-1).cpu().numpy()
            
            for pred, true in zip(preds, batch_labels):
                if true == 1 and pred == 1: tp += 1
                elif true == 0 and pred == 0: tn += 1
                elif true == 0 and pred == 1: fp += 1
                elif true == 1 and pred == 0: fn += 1

    total_time = time.time() - start_time
    
    acc = (tp + tn) / len(labels) if labels else 0
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0
    rec = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (prec * rec) / (prec + rec) if (prec + rec) > 0 else 0
    
    return {
        "acc": acc,
        "prec": prec,
        "rec": rec,
        "f1": f1,
        "time": total_time / len(labels) if labels else 0,
        "tp": tp, "tn": tn, "fp": fp, "fn": fn
    }

metrics_old = evaluate_model("scam_detector_distilbert_old_3epoch", "do an.csv")
metrics_new = evaluate_model("scam_detector_distilbert", "do an.csv")

if metrics_old and metrics_new:
    with open('results.txt', 'w', encoding='utf-8') as f:
        f.write("=== SO SÁNH HIỆU NĂNG 3 EPOCH VS 30 EPOCH ===\n")
        f.write(f"{'Chỉ số':<20} | {'3 Epoch':<15} | {'30 Epoch':<15}\n")
        f.write("-" * 56 + "\n")
        
        keys = [
            ("Accuracy", "acc", "{:.2%}"),
            ("F1-Score", "f1", "{:.2%}"),
            ("Precision", "prec", "{:.2%}"),
            ("Recall", "rec", "{:.2%}"),
            ("True Positives", "tp", "{}"),
            ("False Positives", "fp", "{}"),
            ("False Negatives", "fn", "{}"),
            ("True Negatives", "tn", "{}"),
        ]
        
        for label, key, fmt in keys:
            old_val = fmt.format(metrics_old[key])
            new_val = fmt.format(metrics_new[key])
            f.write(f"{label:<20} | {old_val:<15} | {new_val:<15}\n")

print("Done. Check results.txt")
