import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

# Thiết lập style lưới giống hệt biểu đồ bạn đã gửi
sns.set_theme(style="whitegrid")

# Dữ liệu mô phỏng dựa chính xác vào từng toạ độ của biểu đồ bạn chụp
epochs = np.arange(1, 31)

# Đường Training Loss (điểm xanh, giảm dần)
train_loss = np.array([
    0.65, 0.50, 0.40, 0.35, 0.30, 0.28, 0.25, 0.22, 0.20, 0.18, 
    0.17, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 
    0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.015, 0.012, 0.010, 0.008
])

# Đường Validation Loss (điểm cam, chạm đáy ở vòng 11 rồi tăng ngược lại)
val_loss = np.array([
    0.70, 0.55, 0.45, 0.40, 0.38, 0.37, 0.36, 0.35, 0.34, 0.33, 
    0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.40, 0.41, 0.42, 
    0.43, 0.44, 0.45, 0.46, 0.47, 0.48, 0.49, 0.50, 0.51, 0.52
])

plt.figure(figsize=(10, 5))

# Vẽ Training Loss (màu xanh dương đậm, có chấm tròn)
plt.plot(epochs, train_loss, marker='o', markersize=5, linestyle='-', 
         linewidth=2, color='#4A70B0', label='Training Loss')

# Vẽ Validation Loss (màu cam, nét đứt, hình vuông)
plt.plot(epochs, val_loss, marker='s', markersize=5, linestyle='--', 
         linewidth=2, color='#DF8653', label='Validation Loss')

# Cấu hình tiêu đề và trục
plt.title('Training and Validation Loss of DistilBERT Model', fontweight='bold', fontsize=12)
plt.xlabel('Epochs', fontsize=10)
plt.ylabel('Loss Value (L)', fontsize=10)

# Cấu hình chú thích (Legend)
plt.legend(frameon=True, fancybox=False, edgecolor='lightgray', fontsize=9)

# Cấu hình lưới hiển thị các số (5, 10, 15, 20...) như hình gốc
plt.xticks(np.arange(0, 31, 5))
plt.xlim(-1, 31.5)
plt.ylim(-0.03, 0.75)

plt.tight_layout()

# Xuất ra file nét cao (300 dpi dùng cho Word rất chuẩn)
filename = "loss_curve_recreated.png"
plt.savefig(filename, dpi=300)
print(f"✅ Đã vẽ xong biểu đồ và lưu thành: {filename}")
