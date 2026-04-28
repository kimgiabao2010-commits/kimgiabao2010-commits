"""
train_sbert_xgboost.py
======================
Đổi chiến thuật: SBERT (Feature) + XGBoost (Classifier) + GridSearchCV
Mục tiêu vắt kiệt > 80% từ tập dữ liệu nhỏ và nhiễu.
"""

import os
import pandas as pd
import numpy as np

# Tắt log rác
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from sentence_transformers import SentenceTransformer
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, accuracy_score
import xgboost as xgb
import joblib

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
DATA_PATH   = "do an.csv"
MODEL_OUT   = "sbert_xgboost_classifier.pkl"
SBERT_NAME  = "paraphrase-multilingual-MiniLM-L12-v2"
TEST_SIZE   = 0.2
RANDOM_SEED = 42

def main():
    # ---------------------------------------------------------------------------
    # 1. ĐỌC DỮ LIỆU
    # ---------------------------------------------------------------------------
    print("[1/4] Loading dataset...")
    df = pd.read_csv(DATA_PATH, encoding="utf-8")

    text_col = "content" if "content" in df.columns else "Message"
    label_col = "label" if "label" in df.columns else "Label"

    df = df[[text_col, label_col]].dropna()
    df[text_col] = df[text_col].astype(str)
    df[label_col] = df[label_col].astype(int)

    texts  = df[text_col].tolist()
    labels = df[label_col].values
    
    # Tính toán tỷ lệ chênh lệch để XGBoost cân bằng
    ratio = float(np.sum(labels == 0)) / np.sum(labels == 1)

    print(f"    Tổng số mẫu : {len(texts)}")

    # ---------------------------------------------------------------------------
    # 2. TRÍCH XUẤT ĐẶC TRƯNG – SBERT EMBEDDINGS
    # ---------------------------------------------------------------------------
    print(f"\n[2/4] Encoding sentences with SBERT '{SBERT_NAME}'...")
    sbert = SentenceTransformer(SBERT_NAME)

    X = sbert.encode(texts, batch_size=64, show_progress_bar=True, convert_to_numpy=True)
    y = labels

    print("\n[3/4] Splitting train/test...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
    )

    # ---------------------------------------------------------------------------
    # 3. TỰ ĐỘNG DÒ TÌM THÔNG SỐ XGBOOST (GridSearchCV)
    # ---------------------------------------------------------------------------
    print("\n[4/4] Bắt đầu rèn luyện XGBoost và tìm siêu tham số...")
    
    # Khởi tạo mô hình cơ sở
    xgb_model = xgb.XGBClassifier(
        objective='binary:logistic',
        eval_metric='logloss',
        scale_pos_weight=ratio, # Ép XGBoost chú ý nhãn lừa đảo
        random_state=RANDOM_SEED
    )

    # Lưới tham số để nó tự thử nghiệm
    param_grid = {
        'n_estimators': [100, 200],       # Số lượng cây quyết định
        'max_depth': [3, 5, 7],           # Độ sâu của cây
        'learning_rate': [0.01, 0.1],     # Tốc độ học
        'subsample': [0.8, 1.0],          # Lấy ngẫu nhiên dữ liệu để chống Overfit
        'colsample_bytree': [0.8, 1.0]    # Lấy ngẫu nhiên features để chống Overfit
    }

    # Bắt đầu dò tìm
    grid_search = GridSearchCV(
        estimator=xgb_model, 
        param_grid=param_grid, 
        scoring='accuracy', 
        cv=3, # Chia 3 nếp gấp để kiểm tra chéo
        verbose=1,
        n_jobs=-1 # Dùng toàn bộ nhân CPU để chạy cho lẹ
    )

    print("⏳ Đang cày cuốc thử nghiệm các bộ tham số khác nhau (Có thể mất 1-2 phút)...")
    grid_search.fit(X_train, y_train)

    # Lấy ra bộ thông số xịn nhất
    best_xgb = grid_search.best_estimator_
    print(f"\n✅ Đã tìm ra bộ thông số ngon nhất: {grid_search.best_params_}")

    # ---------------------------------------------------------------------------
    # 4. ĐÁNH GIÁ TRÊN TẬP TEST VÀ LƯU MÔ HÌNH
    # ---------------------------------------------------------------------------
    print("\n========================================")
    print("  EVALUATION ON TEST SET (XGBOOST)")
    print("========================================")

    y_pred = best_xgb.predict(X_test)
    acc  = accuracy_score(y_test, y_pred)

    print(f"  Test Accuracy : {acc:.4f}  ({acc*100:.2f}%)")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Ham (0)", "Scam (1)"]))

    # Lưu bằng joblib thay vì .h5
    joblib.dump(best_xgb, MODEL_OUT)
    print(f"\n[DONE] Đã lưu model xịn nhất vào: {MODEL_OUT}")

if __name__ == "__main__":
    main()