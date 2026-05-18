import re
text="nTrust được giới thiệu lần đầu vào ngày 13/5 tại Hội thảo Phòng chống lừa đảo trên không gian mạng do Hiệp hội An ninh mạng quốc gia tổ chức. Nguồn: VOV2"
text_lower = text.lower()
citations = [
    r"(?:nguồn|theo)\s*:\s*(vov|vov1|vov2|vov3|vtv|vnexpress|tuổi trẻ|thanh niên|dân trí|nhân dân|vietnamnet|báo chính phủ|chinhphu\.vn)",
    r"(?:nguồn|theo)\s+(báo\s+)?(vov|vtv|vnexpress|tuổi trẻ|thanh niên|dân trí|nhân dân|vietnamnet|chính phủ)",
]
for p in citations:
    m = re.search(p, text_lower)
    if m:
        print("MATCHED")
    else:
        print("NO MATCH")
