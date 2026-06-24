import matplotlib.pyplot as plt

# Thông số chuẩn xác đã phân tích
data = [
    ["Peak Accuracy", "89.00%"],
    ["Training Duration", "30 Epochs"],
    ["Optimal Epoch", "11"],
    ["Training Loss (at Optimal)", "0.174"],
    ["Minimum Validation Loss", "0.332"]
]

columns = ["Metric", "Value"]

fig, ax = plt.subplots(figsize=(7, 3))
ax.axis('tight')
ax.axis('off')

# Tạo bảng và tuỳ chỉnh giao diện
table = ax.table(cellText=data, colLabels=columns, cellLoc='left', loc='center')

# Định dạng bảng (kích thước ô, cỡ chữ)
table.auto_set_font_size(False)
table.set_fontsize(12)
table.scale(1, 1.8)

# In đậm Header và tô nền xám nhạt cho đẹp
for (row, col), cell in table.get_celld().items():
    if row == 0:
        cell.set_text_props(weight='bold', color='white')
        cell.set_facecolor('#4f46e5') # Màu xanh Indigo chuyên nghiệp
    elif row % 2 == 0:
        # Tô màu xen kẽ cho các dòng để dễ nhìn
        cell.set_facecolor('#f8fafc')
        
    # Căn trái và tạo padding nhẹ
    cell.set_text_props(ha='left')
    cell.PAD = 0.05

plt.title("Table 4.3.2.a: Performance summary of the fine-tuned DistilBERT model.", 
          fontweight="bold", style='italic', pad=20)

plt.tight_layout()
plt.savefig("performance_table.png", bbox_inches="tight", dpi=300)
print("Đã xuất ảnh bảng thành công: performance_table.png")
