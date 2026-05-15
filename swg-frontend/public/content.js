console.log("🛡️ SWG Content Script V2 đã được tải! Hãy bôi đen chữ và chọn 'Quét bằng SWG Shield' ở menu chuột phải.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "show_result") {
        if (request.error) {
            alert("❌ Lỗi: Không thể kết nối tới máy chủ quét SWG.");
            return;
        }

        if (request.isMalicious) {
            drawWarningBanner(request.text, request.aiData);
        } else {
            alert("✅ Phân tích an toàn: Không phát hiện nội dung lừa đảo/độc hại.");
        }
    } else if (request.action === "dashboard_log") {
        // Chuyển tiếp dữ liệu từ extension vào web page (Dashboard)
        window.dispatchEvent(new CustomEvent('swg_extension_scan', { detail: request.data }));
    }
});

function drawWarningBanner(text, aiData) {
    // Xóa banner cũ nếu có
    const oldBanner = document.getElementById("swg-warning-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "swg-warning-banner";
    // CSS inline, z-index cao nhất
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background-color: #ff3333;
        color: white;
        z-index: 2147483647;
        text-align: center;
        padding: 15px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    
    let ftConf = aiData.fasttext ? (aiData.fasttext.confidence * 100).toFixed(1) : 0;
    let textHTML = `🚨 <strong>CẢNH BÁO TỪ SWG SHIELD:</strong> Phát hiện nội dung LỪA ĐẢO/ĐỘC HẠI! (FastText: ${ftConf}%)`;
    
    if (aiData.distilbert) {
        textHTML += ` | (DistilBERT: ${aiData.distilbert.confidence_score.toFixed(1)}%)`;
    }

    let previewText = text.length > 200 ? text.substring(0, 200) + '...' : text;

    banner.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 18px;">${textHTML}</div>
        <div style="
            background-color: rgba(255, 255, 255, 0.2);
            padding: 10px;
            margin: 10px auto;
            max-width: 80%;
            border-radius: 4px;
            font-style: italic;
            font-size: 14px;
            text-align: left;
            word-wrap: break-word;
        ">
            <strong>Văn bản bị nghi ngờ:</strong> "${previewText}"
        </div>
        <button id="swg-report-btn" style="
            padding: 8px 16px;
            background-color: white;
            color: #ff3333;
            border: none;
            cursor: pointer;
            font-weight: bold;
            border-radius: 4px;
            margin-right: 10px;
        ">Báo cáo nghi ngờ AI sai</button>
        <button id="swg-close-btn" style="
            padding: 8px 16px;
            background-color: transparent;
            color: white;
            border: 1px solid white;
            cursor: pointer;
            border-radius: 4px;
        ">Đóng</button>
    `;
    
    document.body.appendChild(banner);

    document.getElementById("swg-close-btn").addEventListener("click", () => {
        banner.remove();
    });

    document.getElementById("swg-report-btn").addEventListener("click", async () => {
        const btn = document.getElementById("swg-report-btn");
        btn.innerText = "Đang gửi báo cáo...";
        btn.disabled = true;

        try {
            // Chuẩn bị payload theo format của Admin API (Port 5003)
            const aiPredictionPayload = {
                fasttext: aiData.fasttext ? {
                    is_scam: aiData.fasttext.prediction === "Scam",
                    confidence: aiData.fasttext.confidence * 100,
                    prediction: aiData.fasttext.prediction
                } : null,
                distilbert: aiData.distilbert ? {
                    is_scam: aiData.distilbert.is_scam,
                    confidence: aiData.distilbert.confidence_score,
                    prediction: aiData.distilbert.prediction
                } : null
            };

            const payload = {
                url: window.location.href,
                page_text_preview: text.substring(0, 1000), // Đoạn text ngắn để review
                ai_prediction: aiPredictionPayload,
                user_note: "Người dùng báo cáo AI nhận diện sai từ Warning Banner Extension",
                status: "pending"
            };

            // Gửi qua background.js để fetch tránh lỗi Mixed Content/CORS
            chrome.runtime.sendMessage({
                action: "send_report",
                payload: payload
            }, (response) => {
                if (response && response.success) {
                    alert("✅ Đã gửi báo cáo thành công tới Admin (Port 5003)!");
                    banner.remove();
                } else {
                    alert("❌ Lỗi: " + (response ? response.message : "Không nhận được phản hồi"));
                    btn.innerText = "Báo cáo nghi ngờ AI sai";
                    btn.disabled = false;
                }
            });

        } catch (e) {
            console.error(e);
            alert("❌ Đã xảy ra lỗi khi chuẩn bị báo cáo.");
            btn.innerText = "Báo cáo nghi ngờ AI sai";
            btn.disabled = false;
        }
    });
}