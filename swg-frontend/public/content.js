console.log("🛡️ SWG Content Script V3 đã được tải! Hãy bôi đen chữ và chọn 'Quét bằng SWG Shield' ở menu chuột phải.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "show_loading") {
        injectStyles();
        const old = document.getElementById("swg-warning-banner");
        if (old) old.remove();
        const banner = document.createElement("div");
        banner.id = "swg-warning-banner";
        banner.className = "swg-banner-wrapper swg-banner-safe";
        banner.style.borderLeft = "4px solid #3b82f6";
        let preview = request.text.length > 80 ? request.text.substring(0, 80) + "..." : request.text;
        banner.innerHTML =
            '<div class="swg-banner-header">' +
                '<div class="swg-banner-title" style="color:#3b82f6">⏳ ĐANG PHÂN TÍCH...</div>' +
                '<div class="swg-banner-meta">SWG AI PIPELINE</div>' +
            '</div>' +
            '<div style="font-size:12px;color:#64748b;margin-bottom:10px;font-family:monospace;">WAF → FastText đang xử lý...</div>' +
            '<div class="swg-banner-content"><span style="font-style:italic;color:#94a3b8">"' + preview + '"</span></div>';
        document.body.appendChild(banner);

    } else if (request.action === "show_result") {
        if (request.error) {
            alert("❌ Lỗi: Không thể kết nối tới máy chủ quét SWG.");
            return;
        }
        if (request.isMalicious) {
            drawWarningBanner(request.text, request.aiData);
        } else {
            drawSuccessBanner(request.text, request.aiData);
        }

    } else if (request.action === "dashboard_log") {
        window.dispatchEvent(new CustomEvent('swg_extension_scan', { detail: request.data }));

    } else if (request.action === "show_verdict") {
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
            position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
            width: 90%; max-width: 820px;
            z-index: 2147483647;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            display: flex; flex-direction: column;
            padding: 20px 24px;
            animation: swg-fade-in 0.3s ease-out forwards;
            border: 1px solid #334155;
            border-radius: 8px;
            box-sizing: border-box;
        }
        
        .swg-banner-safe { border-left: 4px solid #10b981; }
        .swg-banner-scam { border-left: 4px solid #e11d48; }
        .swg-banner-warn { border-left: 4px solid #f59e0b; }

        .swg-banner-header {
            display: flex; justify-content: space-between; align-items: flex-start;
            margin-bottom: 12px;
        }

        .swg-banner-title {
            font-size: 14px; font-weight: 700;
            letter-spacing: 0.05em; text-transform: uppercase;
        }
        
        .swg-text-safe { color: #10b981; }
        .swg-text-scam { color: #e11d48; }
        .swg-text-warn { color: #f59e0b; }

        .swg-banner-meta {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px; color: #64748b;
            letter-spacing: 0.05em;
        }

        .swg-banner-content {
            background-color: #1e293b;
            padding: 12px 16px; border-radius: 6px;
            font-size: 13px; font-weight: 400; line-height: 1.6;
            color: #cbd5e1;
            border: 1px solid #334155;
            margin-bottom: 16px; box-sizing: border-box;
            border-left: 2px solid #475569;
        }
        
        /* Khung thông báo "độ tự tin thấp" cho selection scan */
        .swg-low-conf-box {
            background: linear-gradient(135deg, #1e1a2e, #1e253b);
            border: 1px solid #7c3aed;
            border-left: 3px solid #a78bfa;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 14px;
            font-size: 12px;
            color: #c4b5fd;
            font-family: ui-monospace, monospace;
        }

        .swg-low-conf-box strong {
            color: #a78bfa;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            display: block;
            margin-bottom: 4px;
        }

        .swg-banner-actions {
            display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
        }

        .swg-btn {
            padding: 8px 16px; border-radius: 4px;
            font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
            cursor: pointer; transition: all 0.2s ease;
            border: none; outline: none; font-family: inherit;
        }

        .swg-btn-primary-scam { background-color: #e11d48; color: #ffffff; }
        .swg-btn-primary-scam:hover { background-color: #be123c; }

        .swg-btn-distilbert {
            background: linear-gradient(135deg, #6d28d9, #4f46e5);
            color: #ffffff;
        }
        .swg-btn-distilbert:hover { background: linear-gradient(135deg, #5b21b6, #4338ca); }
        .swg-btn-distilbert:disabled { opacity: 0.5; cursor: not-allowed; }

        .swg-btn-dashboard {
            background-color: #0f766e;
            color: #ffffff;
        }
        .swg-btn-dashboard:hover { background-color: #0d9488; }

        .swg-btn-outline {
            background-color: transparent; color: #94a3b8;
            border: 1px solid #475569;
        }
        .swg-btn-outline:hover { background-color: #1e293b; color: #f8fafc; border-color: #64748b; }

        .swg-spinner {
            display: inline-block; width: 10px; height: 10px;
            border: 2px solid #fff; border-top-color: transparent;
            border-radius: 50%; animation: swg-spin 0.7s linear infinite;
            margin-right: 6px; vertical-align: middle;
        }

        .swg-admin-note {
            font-size: 13px; margin-bottom: 16px; color: #94a3b8;
            background: #1e293b; padding: 10px 16px; border-radius: 6px;
            border-left: 2px solid #3b82f6;
        }

        @keyframes swg-fade-in {
            from { opacity: 0; transform: translate(-50%, -20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }

        @keyframes swg-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}


// ── Banner cho kết quả AN TOÀN ─────────────────────────────────────────────
function drawSuccessBanner(text, aiData) {
    injectStyles();
    const oldBanner = document.getElementById("swg-warning-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "swg-warning-banner";

    const isContextWarn = aiData && aiData.page_url_flagged;
    const isDegraded = aiData && aiData.degraded;
    // Cờ chế độ bôi đen chữ với độ tự tin thấp
    const isLowConf = aiData && aiData.low_confidence && aiData.selection_scan;

    if (isContextWarn) {
        banner.className = "swg-banner-wrapper swg-banner-scam";
    } else {
        banner.className = "swg-banner-wrapper swg-banner-safe";
    }

    let msg, statusLabel, detail;

    if (isContextWarn) {
        msg = "CAUTION: TEXT FROM SUSPICIOUS PAGE";
        statusLabel = "STATUS: CONTEXT RISK";
        const attackType = aiData.page_attack_type || "MALICIOUS_DOMAIN";
        let ftConf = aiData.fasttext ? (aiData.fasttext.confidence * 100).toFixed(1) : null;
        let aiLine = ftConf ? "FastText: " + ftConf + "%" : "FastText: N/A";
        if (aiData.distilbert) {
            aiLine += " | DistilBERT: " + aiData.distilbert.confidence_score.toFixed(1) + "%";
        }
        detail = "Page URL flagged by WAF [" + attackType + "]. " + aiLine;
    } else if (isDegraded) {
        msg = "ANALYSIS COMPLETE: NO THREAT DETECTED";
        statusLabel = "STATUS: DEGRADED";
        detail = "WARNING: AI engine unavailable. Only WAF layer checked. Treat with caution.";
    } else if (aiData && aiData.layer === "TRUSTED_CITATION") {
        msg = "ANALYSIS COMPLETE: NO THREAT DETECTED";
        statusLabel = "STATUS: SAFE";
        detail = "Bypassed AI analysis: Payload contains trusted media citation.";
    } else if (aiData && aiData.layer === "TRUSTED_DOMAIN") {
        msg = "ANALYSIS COMPLETE: NO THREAT DETECTED";
        statusLabel = "STATUS: SAFE";
        detail = "Bypassed AI analysis: Origin domain is whitelisted.";
    } else {
        msg = isLowConf
            ? "FASTTEXT: AN TOÀN (ĐỘ TỰ TIN THẤP)"
            : "ANALYSIS COMPLETE: NO THREAT DETECTED";
        statusLabel = isLowConf ? "STATUS: UNCERTAIN" : "STATUS: SAFE";
        let parts = [];
        if (aiData && aiData.fasttext && aiData.fasttext.confidence != null) {
            parts.push("FastText: " + (aiData.fasttext.confidence * 100).toFixed(1) + "%");
        }
        if (aiData && aiData.distilbert && aiData.distilbert.confidence_score != null) {
            parts.push("DistilBERT: " + aiData.distilbert.confidence_score.toFixed(1) + "%");
        }
        if (parts.length > 0) {
            detail = "AI Confidence — " + parts.join(" | ");
        } else if (aiData && aiData.score != null) {
            detail = "AI Confidence — " + (aiData.layer || "AI") + ": " + (aiData.score * 100).toFixed(1) + "%";
        } else {
            detail = "System cleared the payload.";
        }
    }

    let previewText = text.length > 150 ? text.substring(0, 150) + '...' : text;
    const titleClass = isContextWarn ? "swg-text-scam" : (isLowConf ? "swg-text-warn" : "swg-text-safe");

    // Khối thông báo "Độ tự tin thấp" + 2 nút thủ công
    let lowConfBlock = "";
    if (isLowConf) {
        lowConfBlock =
            '<div class="swg-low-conf-box">' +
                '<strong>⚠️ ĐỘ TỰ TIN THẤP — CẦN PHÂN TÍCH SÂU HƠN</strong>' +
                'FastText phân loại <strong style="color:#fde68a">An Toàn</strong> nhưng với độ tự tin chỉ ' +
                '<strong style="color:#fde68a">' + (aiData.score * 100).toFixed(1) + '%</strong> (ngưỡng &lt; 60%). ' +
                'Bạn có thể quét sâu hơn bằng DistilBERT hoặc gửi về Dashboard để quản trị viên kiểm tra.' +
            '</div>';
    }

    banner.innerHTML =
        '<div class="swg-banner-header">' +
            '<div class="swg-banner-title ' + titleClass + '">' + msg + '</div>' +
            '<div class="swg-banner-meta">' + statusLabel + '</div>' +
        '</div>' +
        '<div style="font-size: 13px; color: #94a3b8; margin-bottom: 12px; font-family: monospace;">' + detail + '</div>' +
        lowConfBlock +
        '<div class="swg-banner-content">' +
            '<span style="font-style: italic;">"' + previewText + '"</span>' +
        '</div>' +
        '<div class="swg-banner-actions">' +
            (isLowConf
                ? '<button id="swg-distilbert-btn" class="swg-btn swg-btn-distilbert">🧠 QUÉT BẰNG DISTILBERT</button>' +
                  '<button id="swg-dashboard-btn" class="swg-btn swg-btn-dashboard">📋 GỬI VỀ DASHBOARD</button>'
                : '') +
            '<button id="swg-close-btn" class="swg-btn swg-btn-outline">DISMISS</button>' +
        '</div>';

    document.body.appendChild(banner);

    document.getElementById("swg-close-btn").addEventListener("click", () => banner.remove());

    // Gắn sự kiện nút Quét DistilBERT
    if (isLowConf) {
        _attachDistilbertBtn(banner, text, aiData);
        _attachDashboardBtn(banner, text, aiData, false);
    }

    setTimeout(() => {
        const b = document.getElementById("swg-warning-banner");
        if (b) b.remove();
    }, isContextWarn ? 10000 : (isLowConf ? 0 : 6000)); // Low conf: không tự đóng
}


// ── Banner cho kết quả NGUY HIỂM (Scam) ──────────────────────────────────
function drawWarningBanner(text, aiData) {
    injectStyles();
    const oldBanner = document.getElementById("swg-warning-banner");
    if (oldBanner) oldBanner.remove();

    const banner = document.createElement("div");
    banner.id = "swg-warning-banner";
    banner.className = "swg-banner-wrapper swg-banner-scam";

    // Cờ chế độ bôi đen chữ với độ tự tin thấp (FastText phân loại Scam nhưng không chắc)
    const isLowConf = aiData && aiData.low_confidence && aiData.selection_scan;

    let detail = "";
    if (aiData && (aiData.waf_blocked || aiData.layer === "WAF" || aiData.status === "BLOCKED_BY_WAF")) {
        detail = "WAF Threat Level: 100% | Threat: " + (aiData.attack_type || 'Suspicious TLD/Phishing');
    } else {
        let parts = [];
        if (aiData && aiData.fasttext && aiData.fasttext.confidence != null) {
            parts.push("FastText: " + (aiData.fasttext.confidence * 100).toFixed(1) + "%");
        }
        if (aiData && aiData.distilbert && aiData.distilbert.confidence_score != null) {
            parts.push("DistilBERT: " + aiData.distilbert.confidence_score.toFixed(1) + "%");
        }
        if (parts.length > 0) {
            detail = "AI Confidence — " + parts.join(" | ");
        } else if (aiData && aiData.score != null) {
            detail = "AI Confidence — " + (aiData.layer || "AI") + ": " + (aiData.score * 100).toFixed(1) + "%";
        }
        if (aiData && aiData.pattern_engine && aiData.pattern_engine.is_scam) {
            detail += " | Rule Engine: " + aiData.pattern_engine.risk_score + "/100 pts";
        }
    }

    let previewText = text.length > 200 ? text.substring(0, 200) + '...' : text;

    // Khối thông báo "Độ tự tin thấp — Scam nhưng không chắc"
    let lowConfBlock = "";
    if (isLowConf) {
        lowConfBlock =
            '<div class="swg-low-conf-box">' +
                '<strong>⚠️ ĐỘ TỰ TIN THẤP — CẦN XÁC NHẬN</strong>' +
                'FastText phân loại <strong style="color:#fca5a5">SCAM</strong> nhưng với độ tự tin chỉ ' +
                '<strong style="color:#fca5a5">' + (aiData.score * 100).toFixed(1) + '%</strong> (ngưỡng &lt; 60%). ' +
                'Hãy quét sâu bằng DistilBERT để xác nhận hoặc gửi về Dashboard cho quản trị viên kiểm tra.' +
            '</div>';
    }

    const mainTitle = isLowConf
        ? "FASTTEXT: NGHI NGỜ LỪA ĐẢO (ĐỘ TỰ TIN THẤP)"
        : "SECURITY ALERT: MALICIOUS CONTENT DETECTED";

    banner.innerHTML = `
        <div class="swg-banner-header">
            <div class="swg-banner-title swg-text-scam">${mainTitle}</div>
            <div class="swg-banner-meta">${isLowConf ? "STATUS: UNCERTAIN / SCAM" : "STATUS: SCAM"}</div>
        </div>
        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 12px; font-family: monospace;">${detail}</div>
        ${lowConfBlock}
        <div class="swg-banner-content">
            <span style="font-style: italic;">"${previewText}"</span>
        </div>
        <div class="swg-banner-actions">
            ${isLowConf
                ? '<button id="swg-distilbert-btn" class="swg-btn swg-btn-distilbert">🧠 QUÉT BẰNG DISTILBERT</button>' +
                  '<button id="swg-dashboard-btn" class="swg-btn swg-btn-dashboard">📋 GỬI VỀ DASHBOARD</button>'
                : '<button id="swg-report-btn" class="swg-btn swg-btn-primary-scam">REPORT FALSE POSITIVE</button>'
            }
            <button id="swg-close-btn" class="swg-btn swg-btn-outline">DISMISS</button>
        </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("swg-close-btn").addEventListener("click", () => banner.remove());

    if (isLowConf) {
        _attachDistilbertBtn(banner, text, aiData);
        _attachDashboardBtn(banner, text, aiData, true);
    } else {
        // Nút Report False Positive cũ
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

                chrome.runtime.sendMessage({ action: "send_report", payload: payload }, (response) => {
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
}


// ── Helper: Gắn sự kiện nút "Quét bằng DistilBERT" ────────────────────────
function _attachDistilbertBtn(banner, text, originalAiData) {
    const btn = document.getElementById("swg-distilbert-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
        // Đổi trạng thái banner sang "Đang quét DistilBERT..."
        btn.disabled = true;
        btn.innerHTML = '<span class="swg-spinner"></span>ĐANG PHÂN TÍCH CHUYÊN SÂU...';

        const dashBtn = document.getElementById("swg-dashboard-btn");
        if (dashBtn) dashBtn.disabled = true;

        // Cập nhật dòng meta
        const metaEl = banner.querySelector(".swg-banner-meta");
        if (metaEl) metaEl.textContent = "DISTILBERT ĐANG XỬ LÝ...";

        // Yêu cầu background.js gọi DistilBERT
        chrome.runtime.sendMessage({
            action: "scan_distilbert",
            text: text,
            pageUrl: window.location.href,
        }, (response) => {
            if (!response || !response.success) {
                alert("❌ DistilBERT không phản hồi: " + (response ? response.error : "Lỗi kết nối"));
                btn.disabled = false;
                btn.innerHTML = "🧠 QUÉT BẰNG DISTILBERT";
                if (dashBtn) dashBtn.disabled = false;
                return;
            }

            // Xóa banner cũ và vẽ lại với kết quả DistilBERT
            banner.remove();
            const newAiData = response.aiData;
            if (response.isMalicious) {
                drawWarningBanner(text, newAiData);
            } else {
                drawSuccessBanner(text, newAiData);
            }
        });
    });
}


// ── Helper: Gắn sự kiện nút "Gửi về Dashboard" ────────────────────────────
function _attachDashboardBtn(banner, text, aiData, isSuspected) {
    const btn = document.getElementById("swg-dashboard-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
        btn.innerText = "Đang gửi...";
        btn.disabled = true;

        const distilbertEl = document.getElementById("swg-distilbert-btn");
        if (distilbertEl) distilbertEl.disabled = true;

        const aiPredictionPayload = {
            fasttext: aiData.fasttext ? {
                is_scam: aiData.fasttext.prediction === "Scam",
                confidence: (aiData.fasttext.confidence || 0) * 100,
                prediction: aiData.fasttext.prediction
            } : null,
            distilbert: null, // Chưa chạy DistilBERT (user chọn gửi Dashboard thay vì quét)
        };

        const payload = {
            url: window.location.href,
            page_text_preview: text.substring(0, 1000),
            ai_prediction: aiPredictionPayload,
            user_note: isSuspected
                ? "Độ tự tin thấp — FastText nghi ngờ Scam. Chờ Admin xác nhận bằng DistilBERT."
                : "Độ tự tin thấp — FastText phân loại An Toàn nhưng không chắc. Chờ Admin kiểm tra.",
            status: "pending"
        };

        chrome.runtime.sendMessage({ action: "send_report", payload: payload }, (response) => {
            if (response && response.success) {
                alert("✅ Đã gửi về Dashboard thành công!\nAdmin sẽ quét bằng DistilBERT và phán quyết kết quả cho bạn.");
                banner.remove();
            } else {
                alert("❌ Lỗi: " + (response ? response.message : "Không nhận được phản hồi"));
                btn.innerText = "📋 GỬI VỀ DASHBOARD";
                btn.disabled = false;
                if (distilbertEl) distilbertEl.disabled = false;
            }
        });
    });
}


// ── Banner hiển thị phán quyết của Admin ──────────────────────────────────
function drawVerdictBanner(verdict, adminNote) {
    injectStyles();
    const old = document.getElementById("swg-verdict-banner");
    if (old) old.remove();

    const isScam  = verdict === "scam";
    const title   = isScam
        ? "ADMIN VERDICT: MALICIOUS CONTENT"
        : "ADMIN VERDICT: CONTENT IS SAFE";

    const banner = document.createElement("div");
    banner.id = "swg-verdict-banner";
    banner.className = `swg-banner-wrapper ${isScam ? 'swg-banner-scam' : 'swg-banner-safe'}`;

    const noteHTML = adminNote
        ? `<div class="swg-admin-note">
               <strong>ADMIN NOTE:</strong> "${adminNote}"
           </div>`
        : "";

    if (isScam) {
        banner.innerHTML = `
            <div class="swg-banner-header">
                <div class="swg-banner-title swg-text-scam">${title}</div>
                <div class="swg-banner-meta">STATUS: BLOCKED</div>
            </div>
            ${noteHTML}
            <div class="swg-banner-actions">
                <button id="swg-verdict-block" class="swg-btn swg-btn-primary-scam">ENFORCE BLOCK</button>
                <button id="swg-verdict-allow" class="swg-btn swg-btn-outline">BYPASS ALERTS</button>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="swg-banner-header">
                <div class="swg-banner-title swg-text-safe">${title}</div>
                <div class="swg-banner-meta">STATUS: RESOLVED</div>
            </div>
            ${noteHTML}
            <div style="font-size:12px; margin-top:4px; color: #64748b;">
                System will auto-dismiss in 5 seconds...
            </div>
        `;
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