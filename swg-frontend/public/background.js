chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "swg-scan",
        title: "🛡️ Quét bằng SWG Shield",
        contexts: ["selection", "link", "page"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "swg-scan") {
        let targetText = info.selectionText || info.linkUrl || tab.url;
        if (!targetText) return;

        console.log("🕵️ Đang quét mục tiêu:", targetText);

        try {
            // Layer 2: FastText (Port 5001)
            const res1 = await fetch("http://localhost:5001/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: targetText })
            });
            const ftResult = await res1.json();

            let aiData = { fasttext: ftResult, distilbert: null };
            let isMalicious = false;

            // Nếu nghi ngờ (confidence > 40) thì Fetch tiếp Port 5002
            // FastText confidence trả về (0.0 - 1.0), ta tính ra % 
            let ftConfPercent = ftResult.confidence * 100;
            
            if (ftConfPercent > 40) {
                console.log(`⚡ FastText Confidence = ${ftConfPercent.toFixed(1)}% (>40). Gọi DistilBERT Layer 3...`);
                try {
                    const res2 = await fetch("http://localhost:5002/predict", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: targetText })
                    });
                    const dbResult = await res2.json();
                    aiData.distilbert = dbResult;
                    
                    // Lấy kết quả từ DistilBERT làm kết luận cuối
                    isMalicious = dbResult.is_scam;
                } catch (e) {
                    console.error("Lỗi Layer 3:", e);
                    isMalicious = ftResult.prediction === 'Scam';
                }
            } else {
                // Confidence thấp, lấy luôn kết quả FastText
                isMalicious = ftResult.prediction === 'Scam';
            }

            // Gửi dữ liệu xuống content.js để hiển thị (vẽ Banner nếu lừa đảo/độc hại)
            chrome.tabs.sendMessage(tab.id, {
                action: "show_result",
                text: targetText,
                aiData: aiData,
                isMalicious: isMalicious
            });

            // Đồng thời bắn tín hiệu sang tab Admin Dashboard (localhost:5173) nếu đang mở
            chrome.tabs.query({ url: "http://localhost:5173/*" }, (tabs) => {
                tabs.forEach(t => {
                    chrome.tabs.sendMessage(t.id, {
                        action: "dashboard_log",
                        data: { text: targetText, aiData: aiData, isMalicious: isMalicious }
                    });
                });
            });

        } catch (error) {
            console.error("Lỗi khi kết nối Backend:", error);
            // Vẫn truyền sang content.js báo lỗi
            chrome.tabs.sendMessage(tab.id, {
                action: "show_result",
                text: targetText,
                aiData: null,
                isMalicious: false,
                error: true
            });
        }
    }
});

// WAF Layer 1 (Port 8000)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId === 0 && details.url.startsWith('http')) {
        console.log("🔗 Đang kiểm tra URL qua WAF:", details.url);
        try {
            const response = await fetch('http://localhost:8000/inspect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: details.url })
            });
            const result = await response.json();
            if (result.is_attack) {
                console.warn("🚨 WAF ĐÃ CHẶN URL NÀY!");
            }
        } catch (e) {
            // Server WAF có thể đang tắt
        }
    }
});

// Xử lý gửi báo cáo cho Admin (tránh lỗi Mixed Content/CORS trên trang HTTPS)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "send_report") {
        fetch("http://localhost:5003/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request.payload)
        })
        .then(res => res.json())
        .then(data => sendResponse(data))
        .catch(err => {
            console.error("Lỗi khi gửi báo cáo tới Port 5003:", err);
            sendResponse({ success: false, message: err.toString() });
        });
        return true; // Báo cho Chrome biết sendResponse sẽ được gọi bất đồng bộ
    }
});