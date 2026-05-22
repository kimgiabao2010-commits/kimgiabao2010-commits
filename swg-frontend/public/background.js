// ── Zero-Trust: API Key for Gateway requests ─────────────────────────────
const SWG_API_KEY = "swg-vnu-is-2026";
const SWG_GATEWAY_HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": SWG_API_KEY
};

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

        // FIX 1: Hiển thị loading spinner ngay lập tức
        chrome.tabs.sendMessage(tab.id, {
            action: "show_loading",
            text: targetText
        });

        try {
            // Send request to Central Gateway (Port 8000)
            const res = await fetch("http://localhost:8000/api/scan", {
                method: "POST",
                headers: SWG_GATEWAY_HEADERS,
                body: JSON.stringify({ text: targetText, url: tab.url })
            });
            const result = await res.json();

            let aiData = { 
                fasttext: result.fasttext || null, 
                distilbert: result.distilbert || null,
                layer: result.layer || null,
                detail: result.detail || "",
                status: result.status || null,
                label: result.label || null,
                score: (result.score != null) ? result.score : null,
                waf_blocked: result.status === "BLOCKED_BY_WAF" || result.layer === "WAF",
                attack_type: result.attack_type || null,
                page_url_flagged: result.page_url_flagged || false,
                page_attack_type: result.page_attack_type || null,
                degraded: result.degraded || false,
                pattern_engine: result.pattern_engine || null,
                override_reason: result.override_reason || null,
            };
            
            // Extract malicious status — use result.label as primary signal
            let isMalicious = false;
            if (result.status === "BLOCKED_BY_WAF") {
                isMalicious = true;
            } else if (result.label === "Scam") {
                isMalicious = true;
            }

            // Gửi dữ liệu xuống content.js để hiển thị (thay loading bằng kết quả thật)
            chrome.tabs.sendMessage(tab.id, {
                action: "show_result",
                text: targetText,
                aiData: aiData,
                isMalicious: isMalicious,
                layer: result.layer || null
            });

            // FIX 2: Luôn gửi log thẳng lên backend (không phụ thuộc dashboard đang mở hay không)
            _postScanLog(targetText, aiData, isMalicious);

            // Đồng thời bắn tín hiệu sang tab Admin Dashboard nếu đang mở
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(t => {
                    if (t.url && (t.url.includes("localhost:5173") || t.url.includes("127.0.0.1:5173"))) {
                        chrome.tabs.sendMessage(t.id, {
                            action: "dashboard_log",
                            data: { text: targetText, aiData: aiData, isMalicious: isMalicious }
                        });
                    }
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

// FIX 2: Gửi log scan về backend (fire-and-forget, không chặn UI)
function _postScanLog(text, aiData, isMalicious) {
    fetch("http://localhost:8000/api/scan-log", {
        method: "POST",
        headers: { ...SWG_GATEWAY_HEADERS },
        body: JSON.stringify({
            text: text,
            is_malicious: isMalicious,
            layer: aiData?.layer || null,
            label: isMalicious ? "Scam" : "Legit",
            score: aiData?.score ?? null,
            fasttext: aiData?.fasttext || null,
            distilbert: aiData?.distilbert || null,
            waf_blocked: aiData?.waf_blocked || false,
            attack_type: aiData?.attack_type || null,
            pattern_engine: aiData?.pattern_engine || null,
        })
    }).catch(() => {}); // Im lặng nếu server down
}

// WAF Layer 1 — Kiểm tra URL khi điều hướng (Port 8000)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Chỉ kiểm tra frame chính, chỉ http/https, bỏ qua localhost (tránh loop với dashboard)
    if (details.frameId !== 0) return;
    if (!details.url.startsWith('http')) return;
    if (details.url.includes('localhost') || details.url.includes('127.0.0.1')) return;

    console.log("🔗 Đang kiểm tra URL qua WAF:", details.url);
    try {
        const response = await fetch('http://localhost:8000/api/scan', {
            method: 'POST',
            headers: SWG_GATEWAY_HEADERS,
            body: JSON.stringify({ text: details.url, url: details.url })
        });
        const result = await response.json();
        
        let isMalicious = false;
        if (result.status === "BLOCKED_BY_WAF" || result.label === "Scam") {
            console.warn("🚨 WAF ĐÃ CHẶN URL NÀY:", details.url);
            isMalicious = true;
        }

        let aiData = { 
            fasttext: result.fasttext || null, 
            distilbert: result.distilbert || null,
            layer: result.layer || null,
            detail: result.detail || "",
            status: result.status || null,
            label: result.label || null,
            score: (result.score != null) ? result.score : null,
            waf_blocked: result.status === "BLOCKED_BY_WAF" || result.layer === "WAF",
            attack_type: result.attack_type || null,
            page_url_flagged: result.page_url_flagged || false,
            page_attack_type: result.page_attack_type || null,
            degraded: result.degraded || false,
            pattern_engine: result.pattern_engine || null,
            override_reason: result.override_reason || null,
        };

        // BUG FIX #9: Hiển thị banner cảnh báo cho người dùng khi URL bị WAF chặn
        if (isMalicious && details.tabId) {
            // Đợi tab load xong một chút rồi inject banner
            setTimeout(() => {
                chrome.tabs.sendMessage(details.tabId, {
                    action: "show_result",
                    text: details.url,
                    aiData: aiData,
                    isMalicious: true,
                    layer: result.layer || "WAF"
                }).catch(() => {});
            }, 800);
        }

        // FIX 2: Luôn gửi log URL scan lên backend
        _postScanLog(`[URL SCAN] ${details.url}`, aiData, isMalicious);

        // BUG FIX #1: Gửi log URL Scan về Dashboard — hỗ trợ cả localhost và 127.0.0.1
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(t => {
                if (t.url && (t.url.includes("localhost:5173") || t.url.includes("127.0.0.1:5173"))) {
                    chrome.tabs.sendMessage(t.id, {
                        action: "dashboard_log",
                        data: { text: `[URL SCAN] ${details.url}`, aiData: aiData, isMalicious: isMalicious }
                    });
                }
            });
        });

    } catch (e) {
        // Server WAF có thể đang tắt — im lặng
    }
});


// Xử lý gửi báo cáo cho Admin và bắt đầu polling chờ phản hồi
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "send_report") {
        fetch("http://localhost:5003/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request.payload)
        })
        .then(res => res.json())
        .then(data => {
            sendResponse(data);

            // Nếu gửi thành công → lưu report_id và bắt đầu polling
            if (data.success && data.report_id) {
                const reportId = data.report_id;
                const tabId    = sender.tab ? sender.tab.id : null;

                // Lưu vào storage để polling
                chrome.storage.local.set({
                    [`pending_verdict_${reportId}`]: {
                        reportId,
                        tabId,
                        startedAt: Date.now()
                    }
                });

                // Bắt đầu polling mỗi 10 giây, tối đa 30 phút
                startVerdictPolling(reportId, tabId);
            }
        })
        .catch(err => {
            console.error("Lỗi khi gửi báo cáo tới Port 5003:", err);
            sendResponse({ success: false, message: err.toString() });
        });
        return true; // Báo Chrome biết sendResponse sẽ gọi bất đồng bộ
    }
});

// ── Polling chờ Admin xác nhận ────────────────────────────────────────────
function startVerdictPolling(reportId, tabId) {
    const POLL_INTERVAL_MS = 10000; // 10 giây/lần
    const MAX_POLLS        = 180;   // Tối đa 30 phút (180 × 10s)
    let   pollCount        = 0;

    console.log(`🔄 Bắt đầu polling verdict cho báo cáo [${reportId}]`);

    const intervalId = setInterval(async () => {
        pollCount++;

        // Quá thời gian → dừng polling
        if (pollCount > MAX_POLLS) {
            console.log(`⏰ Hết thời gian chờ Admin cho báo cáo [${reportId}]`);
            clearInterval(intervalId);
            chrome.storage.local.remove(`pending_verdict_${reportId}`);
            return;
        }

        try {
            const res  = await fetch(`http://localhost:5003/api/verdict/${reportId}`);
            if (!res.ok) { clearInterval(intervalId); return; }

            const data = await res.json();

            // Admin đã xác nhận → gửi kết quả xuống tab người dùng
            if (data.status === "verified" && data.admin_verdict) {
                clearInterval(intervalId);
                chrome.storage.local.remove(`pending_verdict_${reportId}`);

                console.log(`✅ Admin đã xác nhận [${reportId}]: ${data.admin_verdict}`);

                // Gửi xuống content.js của tab gốc
                if (tabId) {
                    chrome.tabs.sendMessage(tabId, {
                        action:         "show_verdict",
                        verdict:        data.admin_verdict,  // 'scam' | 'safe'
                        adminNote:      data.admin_note || "",
                        reportId:       reportId,
                    }).catch(() => {
                        // Tab có thể đã đóng — bỏ qua
                    });
                }
            }
        } catch (e) {
            // Server tạm ngắt — bỏ qua lần này, tiếp tục poll
        }
    }, POLL_INTERVAL_MS);
}