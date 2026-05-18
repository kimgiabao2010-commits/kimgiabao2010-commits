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
            drawSuccessBanner(request.text, request.layer);
        }

    } else if (request.action === "dashboard_log") {
        window.dispatchEvent(new CustomEvent('swg_extension_scan', { detail: request.data }));

    } else if (request.action === "show_verdict") {
        // Admin đã xác nhận → hiển thị phán quyết cho người dùng
        drawVerdictBanner(request.verdict, request.adminNote || "");
    }
});

// Hàm vẽ banner khi văn bản An Toàn
function drawSuccessBanner(text, layer) {
    const oldBanner = document.getElementById("swg-warning-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "swg-warning-banner";
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background-color: #10b981;
        color: white;
        z-index: 2147483647;
        text-align: center;
        padding: 15px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;

    let msg = "Không phát hiện dấu hiệu lừa đảo.";
    if (layer === "TRUSTED_CITATION") {
        msg = "Văn bản có trích dẫn Nguồn Báo chí Uy tín. Bỏ qua phân tích AI.";
    } else if (layer === "TRUSTED_DOMAIN") {
        msg = "Trang web thuộc Danh sách Nguồn tin cậy (Trusted Domain). Bỏ qua phân tích AI.";
    }

    let previewText = text.length > 150 ? text.substring(0, 150) + '...' : text;

    banner.innerHTML = `
        <div style="margin-bottom: 10px; font-size: 18px;">✅ <strong>PHÂN TÍCH AN TOÀN:</strong> ${msg}</div>
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
            "${previewText}"
        </div>
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
    
    // Tự động đóng sau 5 giây
    setTimeout(() => {
        if (document.getElementById("swg-warning-banner")) {
            document.getElementById("swg-warning-banner").remove();
        }
    }, 5000);
}

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

// ── Banner hiển thị phán quyết của Admin ──────────────────────────────────
function drawVerdictBanner(verdict, adminNote) {
    // Xóa banner cũ nếu có
    const old = document.getElementById("swg-verdict-banner");
    if (old) old.remove();

    const isScam  = verdict === "scam";
    const bgColor = isScam ? "#b91c1c" : "#15803d";
    const icon    = isScam ? "🚨" : "✅";
    const title   = isScam
        ? "ADMIN XÁC NHẬN: ĐÂY LÀ NỘI DUNG LỪA ĐẢO!"
        : "ADMIN XÁC NHẬN: NỘI DUNG AN TOÀN";

    const banner = document.createElement("div");
    banner.id = "swg-verdict-banner";
    banner.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%;
        background-color: ${bgColor};
        color: white;
        z-index: 2147483647;
        text-align: center;
        padding: 18px 20px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border-bottom: 3px solid rgba(255,255,255,0.3);
    `;

    const noteHTML = adminNote
        ? `<div style="font-size:13px; margin-top:6px; opacity:0.9;">
               💬 Ghi chú của Admin: "${adminNote}"
           </div>`
        : "";

    if (isScam) {
        banner.innerHTML = `
            <div style="font-size:18px; font-weight:bold; margin-bottom:10px;">
                ${icon} ${title}
            </div>
            ${noteHTML}
            <div style="margin-top:12px;">
                <button id="swg-verdict-block" style="
                    padding: 10px 24px; margin-right: 12px;
                    background: white; color: #b91c1c;
                    border: none; border-radius: 6px;
                    font-weight: bold; font-size: 15px; cursor: pointer;
                ">🚫 Chặn trang này</button>
                <button id="swg-verdict-allow" style="
                    padding: 10px 24px;
                    background: transparent; color: white;
                    border: 2px solid white; border-radius: 6px;
                    font-size: 15px; cursor: pointer;
                ">✋ Cho phép (tự chịu trách nhiệm)</button>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div style="font-size:18px; font-weight:bold;">
                ${icon} ${title} — Báo cáo của bạn đã được xem xét.
            </div>
            ${noteHTML}
            <div style="font-size:13px; margin-top:8px; opacity:0.85;">
                Banner này sẽ tự đóng sau 5 giây...
            </div>
        `;
    }

    document.body.appendChild(banner);

    if (isScam) {
        document.getElementById("swg-verdict-block").addEventListener("click", () => {
            // Chặn: chuyển tab về trang trắng an toàn
            window.location.href = "about:blank";
        });
        document.getElementById("swg-verdict-allow").addEventListener("click", () => {
            banner.remove();
        });
    } else {
        // Tự đóng sau 5 giây nếu an toàn
        setTimeout(() => banner.remove(), 5000);
    }
}