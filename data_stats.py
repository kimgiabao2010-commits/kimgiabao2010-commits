"""
DATA_STATS.PY - Kiểm Tra Thống Kê Dữ Liệu
Hiển thị thống kê chi tiết về dataset trong file CSV
"""

import pandas as pd
from collections import Counter
import os

# ==============================================================================
#                         CẤU HÌNH
# ==============================================================================

CSV_FILE = 'do an.csv'

# ==============================================================================
#                    PHÂN TÍCH THỐNG KÊ
# ==============================================================================

def analyze_dataset(csv_path):
    """Phân tích và hiển thị thống kê dataset"""
    
    print("\n" + "="*80)
    print(" THỐNG KÊ DỮ LIỆU TRAINING - AI CHỐNG LỪA ĐẢO TUYỂN DỤNG")
    print("="*80)
    
    # Kiểm tra file tồn tại
    if not os.path.exists(csv_path):
        print(f" Không tìm thấy file: {csv_path}")
        print("   Vui lòng chạy data_collector.py hoặc main.py trước!")
        return
    
    # Đọc dữ liệu
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
        print(f" Đã đọc file: {csv_path}")
    except Exception as e:
        print(f" Lỗi đọc file: {e}")
        return
    
    # Kiểm tra cột
    if 'Label' not in df.columns or 'Message' not in df.columns:
        print(" File CSV không đúng format. Cần có cột 'Label' và 'Message'")
        return
    
    # ==============================================================================
    #                    THỐNG KÊ TỔNG QUAN
    # ==============================================================================
    
    print("\n" + "-"*80)
    print(" THỐNG KÊ TỔNG QUAN")
    print("-"*80)
    
    total_records = len(df)
    print(f"      Tổng số records: {total_records:,} records")
    
    # File size
    file_size = os.path.getsize(csv_path) / 1024  # KB
    print(f"    Kích thước file: {file_size:.2f} KB ({file_size/1024:.2f} MB)")
    
    # ==============================================================================
    #                    PHÂN BỐ LABEL (SCAM vs LEGIT)
    # ==============================================================================
    
    print("\n" + "-"*80)
    print(" PHÂN BỐ LABEL")
    print("-"*80)
    
    label_counts = df['Label'].value_counts()
    
    for label, count in label_counts.items():
        percentage = (count / total_records) * 100
        
        # Emoji và màu cho từng label
        if label == 'Scam':
            emoji = ''
            bar_char = '█'
        elif label == 'Legit':
            emoji = ''
            bar_char = '▓'
        else:
            emoji = '❓'
            bar_char = '░'
        
        # Vẽ bar chart
        bar_length = int(percentage / 2)  # Scale to 50 chars max
        bar = bar_char * bar_length
        
        print(f"   {emoji} {label:10s}: {count:6,} records ({percentage:5.2f}%) {bar}")
    
    # ==============================================================================
    #                    KIỂM TRA CÂN BẰNG DỮ LIỆU
    # ==============================================================================
    
    print("\n" + "-"*80)
    print("    ĐÁNH GIÁ CÂN BẰNG DỮ LIỆU")
    print("-"*80)
    
    if len(label_counts) >= 2:
        max_count = label_counts.max()
        min_count = label_counts.min()
        imbalance_ratio = max_count / min_count
        
        print(f"   • Tỷ lệ max/min: {imbalance_ratio:.2f}x")
        
        if imbalance_ratio < 1.5:
            status = " CÂN BẰNG TỐT"
            advice = "Dữ liệu cân bằng, model sẽ train tốt!"
        elif imbalance_ratio < 3:
            status = "  HƠI MẤT CÂN BẰNG"
            advice = "Nên thu thập thêm data cho class ít hơn"
        else:
            status = " MẤT CÂN BẰNG NGHIÊM TRỌNG"
            advice = "Cần thu thập thêm nhiều data cho class thiểu số hoặc dùng SMOTE"
        
        print(f"   • Trạng thái: {status}")
        print(f"   • Khuyến nghị: {advice}")
    
    # ==============================================================================
    #                    PHÂN TÍCH ĐỘ DÀI TEXT
    # ==============================================================================
    
    print("\n" + "-"*80)
    print("   THỐNG KÊ ĐỘ DÀI TEXT")
    print("-"*80)
    
    df['text_length'] = df['Message'].astype(str).str.len()
    df['word_count'] = df['Message'].astype(str).str.split().str.len()
    
    print(f"   • Độ dài trung bình: {df['text_length'].mean():.1f} ký tự")
    print(f"   • Độ dài min: {df['text_length'].min()} ký tự")
    print(f"   • Độ dài max: {df['text_length'].max()} ký tự")
    print(f"   • Median: {df['text_length'].median():.1f} ký tự")
    
    print(f"\n   • Số từ trung bình: {df['word_count'].mean():.1f} từ")
    print(f"   • Số từ min: {df['word_count'].min()} từ")
    print(f"   • Số từ max: {df['word_count'].max()} từ")
    
    # ==============================================================================
    #                    PHÂN TÍCH THEO LABEL
    # ==============================================================================
    
    print("\n" + "-"*80)
    print("   PHÂN TÍCH THEO TỪNG LABEL")
    print("-"*80)
    
    for label in label_counts.index:
        subset = df[df['Label'] == label]
        
        emoji = '' if label == 'Scam' else ''
        print(f"\n   {emoji} {label.upper()}")
        print(f"      - Số lượng: {len(subset)} records")
        print(f"      - Độ dài TB: {subset['text_length'].mean():.1f} ký tự")
        print(f"      - Số từ TB: {subset['word_count'].mean():.1f} từ")
    
    # ==============================================================================
    #                    KIỂM TRA DUPLICATE
    # ==============================================================================
    
    print("\n" + "-"*80)
    print("   KIỂM TRA TRÙNG LẶP")
    print("-"*80)
    
    duplicates = df['Message'].duplicated().sum()
    unique_records = len(df['Message'].unique())
    
    print(f"   • Tổng records: {total_records}")
    print(f"   • Records unique: {unique_records}")
    print(f"   • Records trùng lặp: {duplicates}")
    
    if duplicates > 0:
        dup_percentage = (duplicates / total_records) * 100
        print(f"   • Tỷ lệ trùng: {dup_percentage:.2f}%")
        print(f"     Cảnh báo: Có dữ liệu trùng lặp, nên làm sạch!")
    else:
        print(f"    Không có trùng lặp!")
    
    # ==============================================================================
    #                    KIỂM TRA CHẤT LƯỢNG
    # ==============================================================================
    
    print("\n" + "-"*80)
    print("   KIỂM TRA CHẤT LƯỢNG DỮ LIỆU")
    print("-"*80)
    
    # Null values
    null_labels = df['Label'].isnull().sum()
    null_messages = df['Message'].isnull().sum()
    
    print(f"   • Null trong Label: {null_labels}")
    print(f"   • Null trong Message: {null_messages}")
    
    # Empty messages
    empty_messages = df['Message'].astype(str).str.strip().eq('').sum()
    print(f"   • Message rỗng: {empty_messages}")
    
    # Very short messages (< 10 chars)
    very_short = (df['text_length'] < 10).sum()
    very_short_pct = (very_short / total_records) * 100
    print(f"   • Message quá ngắn (<10 ký tự): {very_short} ({very_short_pct:.1f}%)")
    
    # Quality score
    quality_issues = null_labels + null_messages + empty_messages + very_short
    quality_score = ((total_records - quality_issues) / total_records) * 100
    
    print(f"\n    Điểm chất lượng: {quality_score:.1f}/100")
    
    if quality_score >= 95:
        print(f"    Chất lượng XUẤT SẮC!")
    elif quality_score >= 85:
        print(f"    Chất lượng TỐT!")
    elif quality_score >= 70:
        print(f"     Chất lượng TRUNG BÌNH - Nên làm sạch data")
    else:
        print(f"    Chất lượng KÉM - Cần làm sạch data gấp!")
    
    # ==============================================================================
    #                    KHUYẾN NGHỊ
    # ==============================================================================
    
    print("\n" + "-"*80)
    print(" KHUYẾN NGHỊ")
    print("-"*80)
    
    recommendations = []
    
    # Check data size
    if total_records < 100:
        recommendations.append("  Dữ liệu quá ít (<100). Cần thu thập thêm ít nhất 300-500 records")
    elif total_records < 500:
        recommendations.append(" Dữ liệu ổn nhưng nên thu thập thêm để cải thiện accuracy")
    else:
        recommendations.append(" Số lượng dữ liệu tốt!")
    
    # Check balance
    if len(label_counts) >= 2 and imbalance_ratio > 3:
        recommendations.append("  Dữ liệu mất cân bằng. Chạy data_collector.py thêm vài lần")
    
    # Check duplicates
    if duplicates > 0:
        recommendations.append("    Có trùng lặp. Nên xóa duplicate trước khi train")
    
    # Check quality
    if quality_issues > 0:
        recommendations.append("    Có dữ liệu kém chất lượng. Nên làm sạch")
    
    if not recommendations:
        recommendations.append(" Dữ liệu hoàn hảo, sẵn sàng để train!")
    
    for rec in recommendations:
        print(f"   {rec}")
    
    # ==============================================================================
    #                    KẾT LUẬN
    # ==============================================================================
    
    print("\n" + "="*80)
    print(" TÓM TẮT")
    print("="*80)
    print(f"   Tổng: {total_records:,} records | ", end="")
    
    for label, count in label_counts.items():
        pct = (count/total_records)*100
        emoji = '' if label == 'Scam' else ''
        print(f"{emoji} {label}: {count} ({pct:.1f}%) | ", end="")
    
    print(f"Chất lượng: {quality_score:.1f}/100")
    print("="*80 + "\n")


# ==============================================================================
#                         CHẠY CHƯƠNG TRÌNH
# ==============================================================================

if __name__ == "__main__":
    try:
        analyze_dataset(CSV_FILE)
    except KeyboardInterrupt:
        print("\n\n  Đã dừng!")
    except Exception as e:
        print(f"\n Lỗi: {e}")
        import traceback
        traceback.print_exc()
