import csv
import time
import requests
from rich.console import Console
from rich.table import Table
import os

def main():
    console = Console()
    console.print("[bold cyan]Bắt đầu kiểm thử hiệu năng hệ thống WAF + AI[/bold cyan]")
    
    csv_path = "do an.csv"
    if not os.path.exists(csv_path):
        console.print(f"[bold red]Lỗi: Không tìm thấy tệp {csv_path}[/bold red]")
        return
        
    url = "http://localhost:8000/api/scan"
    
    y_true = []
    y_pred = []
    latencies = []
    
    total_samples = 0
    
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or len(row) < 2:
                continue
            text = row[0].strip()
            try:
                label_true = int(row[1].strip())
            except ValueError:
                continue
                
            total_samples += 1
            if total_samples > 200: # Limit to 200 samples
                break
                
            y_true.append(label_true)
            
            start_time = time.time()
            try:
                response = requests.post(url, json={"text": text}, timeout=10)
                latency = (time.time() - start_time) * 1000
                latencies.append(latency)
                
                if response.status_code == 403:
                    # BLOCKED_BY_WAF
                    pred_label = 1
                elif response.status_code == 200:
                    data = response.json()
                    # data['label'] is 'Scam' or 'Legit' or 'Blocked'
                    res_label = data.get("label", "").lower()
                    if res_label == "scam" or res_label == "blocked":
                        pred_label = 1
                    else:
                        pred_label = 0
                else:
                    pred_label = 0
            except Exception as e:
                console.print(f"[yellow]Lỗi khi quét dòng {total_samples}: {e}[/yellow]")
                pred_label = 0
                latencies.append((time.time() - start_time) * 1000)
                
            y_pred.append(pred_label)
            
            # Print progress periodically
            if total_samples % 20 == 0:
                console.print(f"Đã xử lý: {total_samples} mẫu...")
                
    if not y_true:
        console.print("[bold red]Không có dữ liệu hợp lệ để đánh giá.[/bold red]")
        return
        
    # Calculate metrics
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    
    # TP, TN, FP, FN
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    
    accuracy = (tp + tn) / len(y_true) if y_true else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    
    # Display table
    table = Table(title="Kết Quả Đánh Giá Hiệu Năng (WAF + AI)")
    
    table.add_column("Chỉ số", justify="left", style="cyan", no_wrap=True)
    table.add_column("Kết quả", justify="right", style="green")
    
    table.add_row("Số lượng mẫu test", str(len(y_true)))
    table.add_row("Thời gian phản hồi TB", f"{avg_latency:.2f} ms")
    table.add_row("Độ chính xác (Accuracy)", f"{accuracy:.2%}")
    table.add_row("Precision", f"{precision:.2%}")
    table.add_row("Recall", f"{recall:.2%}")
    table.add_row("True Positives (TP)", str(tp))
    table.add_row("True Negatives (TN)", str(tn))
    table.add_row("False Positives (FP)", str(fp))
    table.add_row("False Negatives (FN)", str(fn))
    
    console.print(table)

if __name__ == "__main__":
    main()
