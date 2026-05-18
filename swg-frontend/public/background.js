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
            // Send request to Central Gateway (Port 8000)
            const res = await fetch("http://localhost:8000/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: targetText, url: tab.url })
            });
            const result = await res.json();

            let aiData = { 
                fasttext: result.fasttext || null, 
                distilbert: result.distilbert || null,
                layer: result.layer || null,
                detail: result.detail || ""
            };
            
            // Extract malicious status from central gateway result
            let isMalicious = false;
            if (result.status === "BLOCKED_BY_WAF") {
                isMalicious = true;
            } else if (result.distilbert && result.distilbert.is_scam) {
                isMalicious = true;
            } else if (result.fasttext && result.fasttext.prediction === 'Scam' && !result.distilbert) {
                isMalicious = true;
            }

            // Gửi dữ liệu xuống content.js để hiển thị (vẽ Banner nếu lừa đảo/độc hại)
            chrome.tabs.sendMessage(tab.id, {
                action: "show_result",
                text: targetText,
                aiData: aiData,
                isMalicious: isMalicious,
                layer: result.layer || null
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
            headers: { 'Content-Type': 'application/json' },
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
            layer: result.layer || "WAF",
            detail: result.detail || ""
        };

        // Gửi log URL Scan về Dashboard
        chrome.tabs.query({ url: "http://localhost:5173/*" }, (tabs) => {
            tabs.forEach(t => {
                chrome.tabs.sendMessage(t.id, {
                    action: "dashboard_log",
                    data: { text: `[URL SCAN] ${details.url}`, aiData: aiData, isMalicious: isMalicious }
                });
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