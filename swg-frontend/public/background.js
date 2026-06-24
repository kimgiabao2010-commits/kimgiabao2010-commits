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

        // Kiểm tra đây có phải là bôi đen chữ không (selection text)
        const isSelectionScan = !!info.selectionText;

        console.log("🕵️ Đang quét mục tiêu:", targetText, isSelectionScan ? "[SELECTION SCAN]" : "[URL SCAN]");

        // Hiển thị loading spinner ngay lập tức
        chrome.tabs.sendMessage(tab.id, {
            action: "show_loading",
            text: targetText
        });

        try {
            // Với bôi đen chữ: gửi selection_scan=true để backend CHỈ chạy FastText trước
            // Với URL/Link: gửi bình thường, backend tự chạy full pipeline
            const requestBody = {
                text: targetText,
                url: tab.url,
                selection_scan: isSelectionScan,
                force_distilbert: false,
            };

            const res = await fetch("https://localhost:8080/api/scan", {
                method: "POST",
                headers: SWG_GATEWAY_HEADERS,
                body: JSON.stringify(requestBody)
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
                // Cờ mới: chế độ bôi đen chữ + độ tự tin thấp
                selection_scan: result.selection_scan || false,
                low_confidence: result.low_confidence || false,
            };

            // Trích xuất trạng thái nguy hiểm
            let isMalicious = false;
            if (result.status === "BLOCKED_BY_WAF") {
                isMalicious = true;
            } else if (result.label === "Scam") {
                isMalicious = true;
            }

            // Gửi kết quả xuống content.js để hiển thị banner
            chrome.tabs.sendMessage(tab.id, {
                action: "show_result",
                text: targetText,
                aiData: aiData,
                isMalicious: isMalicious,
                layer: result.layer || null,
                isSelectionScan: isSelectionScan,
            });

            // Luôn gửi log thẳng lên backend
            _postScanLog(targetText, aiData, isMalicious);

            // Bắn tín hiệu qua Dashboard nếu đang mở
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


// ── Handler: Quét bằng DistilBERT thủ công (từ nút bấm trên banner) ──────
// Content script gửi message này khi user bấm "QUÉT BẰNG DISTILBERT"
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scan_distilbert") {
        const { text, pageUrl } = request;
        console.log("🧠 [SELECTION] Quét DistilBERT thủ công cho:", text.substring(0, 80));

        fetch("https://localhost:8080/api/scan", {
            method: "POST",
            headers: SWG_GATEWAY_HEADERS,
            body: JSON.stringify({
                text: text,
                url: pageUrl || "",
                selection_scan: true,
                force_distilbert: true,
            })
        })
        .then(res => res.json())
        .then(result => {
            const aiData = {
                fasttext: result.fasttext || null,
                distilbert: result.distilbert || null,
                layer: result.layer || "DistilBERT",
                detail: result.detail || "",
                status: result.status || null,
                label: result.label || null,
                score: (result.score != null) ? result.score : null,
                waf_blocked: false,
                attack_type: null,
                page_url_flagged: result.page_url_flagged || false,
                page_attack_type: result.page_attack_type || null,
                degraded: false,
                pattern_engine: result.pattern_engine || null,
                override_reason: result.override_reason || null,
                selection_scan: true,
                low_confidence: false, // DistilBERT kết quả cuối − không hiện nút nữa
                force_distilbert: true,
            };

            const isMalicious = result.label === "Scam";
            _postScanLog(text, aiData, isMalicious);

            sendResponse({ success: true, aiData, isMalicious });
        })
        .catch(err => {
            console.error("[SELECTION] DistilBERT scan error:", err);
            sendResponse({ success: false, error: err.message });
        });

        return true; // Báo Chrome biết sendResponse sẽ gọi bất đồng bộ
    }

    // ── Handler: Gửi báo cáo chờ duyệt tới Admin (Port 5003) ─────────────
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

                chrome.storage.local.set({
                    [`pending_verdict_${reportId}`]: {
                        reportId,
                        tabId,
                        startedAt: Date.now()
                    }
                });

                startVerdictPolling(reportId, tabId);
            }
        })
        .catch(err => {
            console.error("Lỗi khi gửi báo cáo tới Port 5003:", err);
            sendResponse({ success: false, message: err.toString() });
        });
        return true;
    }
});


// Gửi log scan về backend với retry 1 lần sau 2 giây nếu thất bại
function _postScanLog(text, aiData, isMalicious) {
    const payload = JSON.stringify({
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
    });

    const doPost = () => fetch("https://localhost:8080/api/scan-log", {
        method: "POST",
        headers: { ...SWG_GATEWAY_HEADERS },
        body: payload
    });

    doPost()
        .then(res => {
            if (res.ok) {
                console.log("✅ [SWG] Scan log đã gửi về backend thành công.");
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        })
        .catch(err => {
            console.warn("⚠️ [SWG] Lần 1 thất bại (" + err.message + "), thử lại sau 2s...");
            setTimeout(() => {
                doPost()
                    .then(res => {
                        if (res.ok) console.log("✅ [SWG] Retry thành công — log đã lưu vào backend!");
                        else console.error("❌ [SWG] Retry thất bại HTTP " + res.status);
                    })
                    .catch(e => console.error("❌ [SWG] Server không phản hồi sau retry:", e.message));
            }, 2000);
        });
}


// WAF Layer 1 — Kiểm tra URL khi điều hướng (Port 8080)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return;
    if (!details.url.startsWith('http')) return;
    if (details.url.includes('localhost') || details.url.includes('127.0.0.1')) return;

    console.log("🔗 Đang kiểm tra URL qua WAF:", details.url);
    try {
        const response = await fetch('https://localhost:8080/api/scan', {
            method: 'POST',
            headers: SWG_GATEWAY_HEADERS,
            body: JSON.stringify({
                text: details.url,
                url: details.url,
                selection_scan: false,
                force_distilbert: false,
            })
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
            selection_scan: false,
            low_confidence: false,
        };

        if (isMalicious && details.tabId) {
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

        _postScanLog(`[URL SCAN] ${details.url}`, aiData, isMalicious);

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


// ── Polling chờ Admin xác nhận ────────────────────────────────────────────
function startVerdictPolling(reportId, tabId) {
    const POLL_INTERVAL_MS = 10000; // 10 giây/lần
    const MAX_POLLS        = 180;   // Tối đa 30 phút (180 × 10s)
    let   pollCount        = 0;

    console.log(`🔄 Bắt đầu polling verdict cho báo cáo [${reportId}]`);

    const intervalId = setInterval(async () => {
        pollCount++;

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

            if (data.status === "verified" && data.admin_verdict) {
                clearInterval(intervalId);
                chrome.storage.local.remove(`pending_verdict_${reportId}`);

                console.log(`✅ Admin đã xác nhận [${reportId}]: ${data.admin_verdict}`);

                if (tabId) {
                    chrome.tabs.sendMessage(tabId, {
                        action:    "show_verdict",
                        verdict:   data.admin_verdict,
                        adminNote: data.admin_note || "",
                        reportId:  reportId,
                    }).catch(() => {});
                }
            }
        } catch (e) {
            // Server tạm ngắt — bỏ qua lần này, tiếp tục poll
        }
    }, POLL_INTERVAL_MS);
}