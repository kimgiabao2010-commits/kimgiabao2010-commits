import os
import pandas as pd

def main():
    # Tạo thư mục data nếu chưa có
    os.makedirs("data", exist_ok=True)

    # POSITIVE CASES (URL Lừa đảo - Nhãn 1)
    positives = [
        "http://fake-vietcombank.tk/login", "https://vietcombank-security.ml/otp", 
        "http://techcombank-update.xyz/xac-thuc", "https://bidv-verify.club/account",
        "http://acb-mobile.top/signin", "https://vpbank-secure.click/verify",
        "http://momo-payment.tk/confirm", "https://zalopay-update.ml/otp",
        "http://xn--vietcmbank-8za5b.com/login", "https://xn--techcmbank-7za5b.tk/verify",
        "http://xn--mm-hia.tk/payment", "http://casino-vietnam.tk",
        "https://188bet-official.ml", "http://fun88-vn.xyz",
        "https://w88-casino.club", "http://cado-bongda.tk",
        "https://keo-bongda.ml", "http://bank-login.tk",
        "http://secure-payment.ml", "http://verify-account.xyz",
        "http://otp-confirmation.club", "https://vietcombank-clone.tk",
        "http://techcombank-fake.ml", "https://momo-phishing.xyz",
        "https://brand-new-bank.tk", "http://just-created.ml",
        "https://form-hijack.tk", "http://payment-redirect.ml",
        "http://xac-thuc-tai-khoan.tk", "https://mo-khoa-ngan-hang.ml",
        "http://cap-nhat-bao-mat.xyz", "https://kich-hoat-the.club"
    ]

    # NEGATIVE CASES (URL Uy tín - Nhãn 0)  
    negatives = [
        "https://vietcombank.com.vn", "https://techcombank.com.vn",
        "https://bidv.com.vn", "https://acb.com.vn",
        "https://vpbank.com.vn", "https://agribank.com.vn",
        "https://momo.vn", "https://zalopay.vn", "https://vnpay.vn",
        "https://huflit.edu.vn", "https://hcmus.edu.vn",
        "https://uit.edu.vn", "https://hcmut.edu.vn",
        "https://ussh.edu.vn", "https://hust.edu.vn",
        "https://vnu.edu.vn", "https://courses.huflit.edu.vn/login/index.php",
        "https://baochinhphu.vn", "https://vnexpress.net", 
        "https://tuoitre.vn", "https://thanhnien.vn",
        "https://dantri.com.vn", "https://vietnamnet.vn",
        "https://google.com", "https://youtube.com",
        "https://github.com", "https://microsoft.com",
        "https://facebook.com", "https://amazon.com",
        "https://cloudflare.com", "https://wikipedia.org",
        "https://shopee.vn", "https://tiki.vn",
        "https://sendo.vn", "https://lazada.vn",
        "https://fptshop.com.vn", "https://thegioididong.com"
    ]

    # 1. LƯU RA FILE TXT THEO CHUẨN CŨ
    with open("data/positives.txt", "w", encoding="utf-8") as f:
        for url in positives: f.write(url + "\n")
    with open("data/negatives.txt", "w", encoding="utf-8") as f:
        for url in negatives: f.write(url + "\n")

    # 2. CHÈN TRỰC TIẾP VÀO FILE do an.csv
    new_data = []
    for url in positives:
        new_data.append({"content": url, "label": 1})
    for url in negatives:
        new_data.append({"content": url, "label": 0})

    new_df = pd.DataFrame(new_data)
    csv_file = "do an.csv"

    # Kiểm tra xem file do an.csv đã tồn tại chưa để ghi tiếp (không làm hỏng cột tiêu đề)
    if os.path.exists(csv_file):
        new_df.to_csv(csv_file, mode='a', header=False, index=False, encoding="utf-8")
        msg_csv = f"Đã chèn thêm {len(new_data)} dòng vào cuối file '{csv_file}'"
    else:
        new_df.to_csv(csv_file, mode='w', header=True, index=False, encoding="utf-8")
        msg_csv = f"Đã tạo mới file '{csv_file}' với {len(new_data)} dòng"

    # In thông báo ra Terminal
    print("\033[92m✅ Test datasets created:\033[0m")
    print(f"  📁 data/positives.txt - {len(positives)} malicious URLs")
    print(f"  📁 data/negatives.txt - {len(negatives)} legitimate URLs\n")
    print("\033[96m💾 Cập nhật Dataset chính:\033[0m")
    print(f"  📊 {msg_csv}\n")
    print("\033[93m🎯 Benchmark Targets:\033[0m")
    print("  • Positives: >70% should have risk ≥60%")
    print("  • Negatives: >90% should have risk ≤20%")

if __name__ == "__main__":
    main()