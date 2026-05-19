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

function injectStyles() {
    if (document.getElementById('swg-styles')) return;
    const style = document.createElement('style');
    style.id = 'swg-styles';
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        .swg-banner-wrapper {
            position: fixed; top: 0; left: 0; width: 100%;
            z-index: 2147483647;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            display: flex; flex-direction: column; align-items: center;
            padding: 16px 24px;
            animation: swg-slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            box-sizing: border-box;
        }
        
        .swg-banner-safe {
            background-color: rgba(16, 185, 129, 0.95); /* emerald-500 */
            color: #ffffff;
        }
        
        .swg-banner-scam {
            background-color: rgba(225, 29, 72, 0.95); /* rose-600 */
            color: #ffffff;
        }

        .swg-banner-header {
            display: flex; align-items: center; gap: 10px;
            font-size: 16px; font-weight: 700;
            letter-spacing: 0.02em; margin-bottom: 12px;
        }

        .swg-banner-content {
            background-color: rgba(0, 0, 0, 0.2);
            padding: 12px 18px; border-radius: 8px;
            font-size: 13px; font-weight: 400; line-height: 1.5;
            max-width: 800px; width: 100%; text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 16px; box-sizing: border-box;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .swg-banner-actions {
            display: flex; gap: 12px;
        }

        .swg-btn {
            padding: 8px 20px; border-radius: 6px;
            font-size: 13px; font-weight: 600;
            cursor: pointer; transition: all 0.2s ease;
            border: none; outline: none; font-family: inherit;
        }

        .swg-btn-primary-scam {
            background-color: #ffffff; color: #e11d48;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .swg-btn-primary-scam:hover {
            background-color: #ffe4e6; transform: translateY(-1px);
        }

        .swg-btn-outline {
            background-color: rgba(255, 255, 255, 0.1); color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.4);
        }
        .swg-btn-outline:hover {
            background-color: rgba(255, 255, 255, 0.2);
            border-color: #ffffff;
        }

        .swg-admin-note {
            font-size: 13px; margin-bottom: 16px; opacity: 0.9;
            background: rgba(0,0,0,0.1); padding: 8px 16px; border-radius: 6px;
            border-left: 3px solid rgba(255,255,255,0.5);
        }

        @keyframes swg-slide-down {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

// Hàm vẽ banner khi văn bản An Toàn
function drawSuccessBanner(text, layer) {
    injectStyles();
    const oldBanner = document.getElementById("swg-warning-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "swg-warning-banner";
    banner.className = "swg-banner-wrapper swg-banner-safe";

    let msg = "Không phát hiện dấu hiệu lừa đảo.";
    if (layer === "TRUSTED_CITATION") {
        msg = "Văn bản trích dẫn Nguồn Báo chí Uy tín. Bỏ qua phân tích AI.";
    } else if (layer === "TRUSTED_DOMAIN") {
        msg = "Trang web thuộc Danh sách Nguồn tin cậy. Bỏ qua phân tích AI.";
    }

    let previewText = text.length > 150 ? text.substring(0, 150) + '...' : text;

    banner.innerHTML = `
        <div class="swg-banner-header">✅ <span>PHÂN TÍCH AN TOÀN:</span> <span style="font-weight: 500">${msg}</span></div>
        <div class="swg-banner-content">
            <span style="font-style: italic; opacity: 0.9">"${previewText}"</span>
        </div>
        <div class="swg-banner-actions">
            <button id="swg-close-btn" class="swg-btn swg-btn-outline">Đóng lại</button>
        </div>
    `;
    
    document.body.appendChild(banner);

    document.getElementById("swg-close-btn").addEventListener("click", () => banner.remove());
    
    setTimeout(() => {
        if (document.getElementById("swg-warning-banner")) {
            document.getElementById("swg-warning-banner").remove();
        }
    }, 6000);
}

function drawWarningBanner(text, aiData) {
    injectStyles();
    const oldBanner = document.getElementById("swg-warning-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "swg-warning-banner";
    banner.className = "swg-banner-wrapper swg-banner-scam";
    
    let ftConf = aiData.fasttext ? (aiData.fasttext.confidence * 100).toFixed(1) : 0;
    let textHTML = `🚨 <span>CẢNH BÁO:</span> <span style="font-weight: 500">Phát hiện nội dung ĐỘC HẠI! (FastText: ${ftConf}%)</span>`;
    
    if (aiData.distilbert) {
        textHTML = `🚨 <span>CẢNH BÁO:</span> <span style="font-weight: 500">Phát hiện nội dung ĐỘC HẠI! (FastText: ${ftConf}% | DistilBERT: ${aiData.distilbert.confidence_score.toFixed(1)}%)</span>`;
    }

    let previewText = text.length > 200 ? text.substring(0, 200) + '...' : text;

    banner.innerHTML = `
        <div class="swg-banner-header">${textHTML}</div>
        <div class="swg-banner-content">
            <span style="font-style: italic; opacity: 0.9">"${previewText}"</span>
        </div>
        <div class="swg-banner-actions">
            <button id="swg-report-btn" class="swg-btn swg-btn-primary-scam">Báo cáo nghi ngờ AI sai</button>
            <button id="swg-close-btn" class="swg-btn swg-btn-outline">Đóng cảnh báo</button>
        </div>
    `;
    
    document.body.appendChild(banner);

    document.getElementById("swg-close-btn").addEventListener("click", () => banner.remove());

    document.getElementById("swg-report-btn").addEventListener("click", async () => {
        const btn = document.getElementById("swg-report-btn");
        btn.innerText = "Đang gửi báo cáo...";
        btn.disabled = true;

        try {
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
                page_text_preview: text.substring(0, 1000),
                ai_prediction: aiPredictionPayload,
                user_note: "Người dùng báo cáo AI nhận diện sai từ Warning Banner Extension",
                status: "pending"
            };

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
    injectStyles();
    const old = document.getElementById("swg-verdict-banner");
    if (old) old.remove();

    const isScam  = verdict === "scam";
    const title   = isScam
        ? "ADMIN XÁC NHẬN: NỘI DUNG LỪA ĐẢO!"
        : "ADMIN XÁC NHẬN: NỘI DUNG AN TOÀN";

    const banner = document.createElement("div");
    banner.id = "swg-verdict-banner";
    banner.className = \`swg-banner-wrapper \${isScam ? 'swg-banner-scam' : 'swg-banner-safe'}\`;

    const noteHTML = adminNote
        ? \`<div class="swg-admin-note">
               💬 Ghi chú của Admin: "\${adminNote}"
           </div>\`
        : "";

    if (isScam) {
        banner.innerHTML = \`
            <div class="swg-banner-header">🚨 <span>\${title}</span></div>
            \${noteHTML}
            <div class="swg-banner-actions">
                <button id="swg-verdict-block" class="swg-btn swg-btn-primary-scam">🚫 Chặn trang này</button>
                <button id="swg-verdict-allow" class="swg-btn swg-btn-outline">✋ Bỏ qua cảnh báo</button>
            </div>
        \`;
    } else {
        banner.innerHTML = \`
            <div class="swg-banner-header">✅ <span>\${title}</span></div>
            \${noteHTML}
            <div style="font-size:13px; margin-top:4px; opacity:0.85;">
                Banner này sẽ tự đóng sau 5 giây...
            </div>
        \`;
    }

    document.body.appendChild(banner);

    if (isScam) {
        document.getElementById("swg-verdict-block").addEventListener("click", () => {
            window.location.href = "about:blank";
        });
        document.getElementById("swg-verdict-allow").addEventListener("click", () => {
            banner.remove();
        });
    } else {
        setTimeout(() => banner.remove(), 5000);
    }
}