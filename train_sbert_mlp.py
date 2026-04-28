"""
train_sbert_mlp.py
==================
Phiên bản L2 Regularizer + Class Weights (Mục tiêu > 80%)
"""

import os
import numpy as np
import pandas as pd

# ── Giới hạn TensorFlow chỉ dùng CPU, tắt log rác ──────────────────────────
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.optimizers import Adam
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.utils import class_weight # Bổ sung thư viện cân bằng trọng số
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
DATA_PATH   = "do an.csv"
MODEL_OUT   = "sbert_scam_classifier.h5"
SBERT_NAME  = "paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM   = 384
EPOCHS      = 50     
BATCH_SIZE  = 64     
TEST_SIZE   = 0.2
RANDOM_SEED = 42

def main():
    # ---------------------------------------------------------------------------
    # 1. ĐỌC DỮ LIỆU
    # ---------------------------------------------------------------------------
    print("[1/5] Loading dataset...")
    df = pd.read_csv(DATA_PATH, encoding="utf-8")

    text_col = "content" if "content" in df.columns else "Message"
    label_col = "label" if "label" in df.columns else "Label"

    df = df[[text_col, label_col]].dropna()
    df[text_col] = df[text_col].astype(str)
    df[label_col] = df[label_col].astype(int)

    texts  = df[text_col].tolist()
    labels = df[label_col].values

    print(f"    Tong so mau : {len(texts)}")
    print(f"    Phan phoi   : {dict(pd.Series(labels).value_counts().sort_index())}")

    # ---------------------------------------------------------------------------
    # 2. TRÍCH XUẤT ĐẶC TRƯNG – SBERT EMBEDDINGS
    # ---------------------------------------------------------------------------
    print(f"\n[2/5] Encoding sentences with SBERT '{SBERT_NAME}'...")
    sbert = SentenceTransformer(SBERT_NAME)

    X = sbert.encode(
        texts,
        batch_size=64,
        show_progress_bar=True,
        convert_to_numpy=True,
    )
    print(f"    Embedding shape: {X.shape}")

    y = labels

    # ---------------------------------------------------------------------------
    # 3. CHIA TẬP TRAIN / TEST VÀ TÍNH TRỌNG SỐ
    # ---------------------------------------------------------------------------
    print("\n[3/5] Splitting train/test and calculating Class Weights...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=y,
    )
    
    # [QUAN TRỌNG] Tự động tính trọng số để chống mất cân bằng dữ liệu
    weights = class_weight.compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
    cw_dict = dict(enumerate(weights))
    print(f"    Class Weights áp dụng: {cw_dict}")

    # ---------------------------------------------------------------------------
    # 4. XÂY DỰNG MÔ HÌNH MLP (L2 regularization mạnh + Dropout cao)
    # ---------------------------------------------------------------------------
    print("\n[4/5] Building MLP model...")

    L2 = 5e-4   # L2 lambda giữ nguyên
    
    model = keras.Sequential([
        layers.Dense(128, activation="relu",
                     input_shape=(EMBED_DIM,),
                     kernel_regularizer=regularizers.l2(L2)),
                     
        # Kéo Dropout lên 0.5 để tăng độ lỳ đòn
        layers.Dropout(0.5),

        layers.Dense(1, activation="sigmoid"),
    ], name="sbert_scam_mlp_v6")

    # Học cực chậm (0.0003) để không bị bỏ sót nghiệm tốt
    model.compile(
        optimizer=Adam(learning_rate=0.0003), 
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    model.summary()

    # ---------------------------------------------------------------------------
    # 5. CALLBACKS VÀ HUẤN LUYỆN
    # ---------------------------------------------------------------------------
    early_stop = EarlyStopping(
        monitor="val_accuracy", # Theo dõi thẳng điểm số thi thật
        patience=8,             # Cho phép kiên nhẫn 8 vòng
        restore_best_weights=True,
        verbose=1,
    )

    print(f"\n[5/5] Training (max epochs={EPOCHS}, batch={BATCH_SIZE})...")

    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_test, y_test),
        class_weight=cw_dict, # Nạp trọng số vào hàm fit
        callbacks=[early_stop],
        verbose=1,
    )

    # ---------------------------------------------------------------------------
    # 6. ĐÁNH GIÁ VÀ LƯU MÔ HÌNH
    # ---------------------------------------------------------------------------
    print("\n========================================")
    print("  EVALUATION ON TEST SET")
    print("========================================")

    y_pred_prob = model.predict(X_test, batch_size=BATCH_SIZE, verbose=0)
    y_pred      = (y_pred_prob >= 0.5).astype(int).flatten()

    acc  = accuracy_score(y_test, y_pred)
    loss_val, _ = model.evaluate(X_test, y_test, verbose=0)

    print(f"  Test Accuracy : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"  Test Loss     : {loss_val:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Ham (0)", "Scam (1)"]))

    model.save(MODEL_OUT)
    print(f"\n[DONE] Model saved -> {MODEL_OUT}")

if __name__ == "__main__":
    main()