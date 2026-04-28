// --- CẤU HÌNH API ---
const TFIDF_API_URL = 'http://127.0.0.1:5000/predict';    // TF-IDF Model
const FASTTEXT_API_URL = 'http://127.0.0.1:5001/predict'; // FastText Model

// --- LẤY CÁC THÀNH PHẦN TỪ HTML ---
const inputElement = document.getElementById('message-input');
const tfidfResultBox = document.getElementById('tfidf-result-box');
const fasttextResultBox = document.getElementById('fasttext-result-box');
const predictButton = document.getElementById('predict-button');
const tfidfPlaceholder = document.getElementById('tfidf-placeholder');
const fasttextPlaceholder = document.getElementById('fasttext-placeholder');

// --- HÀM GỌI API CHO TỪNG MODEL ---
async function callAPI(url, modelName) {
    const message = inputElement.value;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return {
        prediction: data.prediction,
        probability: data.probability,
        model: modelName
    };
}

// --- HÀM HIỂN THỊ KẾT QUẢ ---
function displayResult(resultBox, result) {
    const prediction = result.prediction;
    const probability = (result.probability * 100).toFixed(2);
    const trustScore = result.probability; // 0-1

    // Determine status
    const isScam = prediction === 'Scam';
    const statusClass = isScam ? 'is-danger' : 'is-success';
    const icon = isScam ? 'fa-exclamation-triangle' : 'fa-check-circle';
    const title = isScam ? 'CẢNH BÁO' : 'AN TOÀN';
    const description = isScam
        ? 'Tin nhắn này có dấu hiệu lừa đảo.<br>Hãy cẩn thận trước khi tiếp tục.'
        : 'Tin nhắn này có vẻ hợp pháp.<br>Bạn có thể yên tâm hơn.';

    // Build HTML
    resultBox.className = `result-box ${statusClass}`;
    resultBox.style.display = 'flex';

    resultBox.innerHTML = `
        <div class="result-icon">
            <i class="fas ${icon}"></i>
        </div>
        <h2 class="result-title">${title}</h2>
        <p class="result-description">${description}</p>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Dự đoán</div>
                <div class="stat-value" style="font-size: 22px;">${prediction}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Độ tin cậy</div>
                <div class="stat-value">${probability}%</div>
            </div>
        </div>
        
        <div class="progress-container">
            <div class="progress-label">
                <span>Trust Score</span>
                <span><strong>${probability}%</strong></span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${probability}%;"></div>
            </div>
        </div>
    `;
}

// --- HÀM HIỂN THỊ LỖI ---
function displayError(resultBox, modelName, error) {
    resultBox.className = 'result-box';
    resultBox.style.display = 'flex';

    resultBox.innerHTML = `
        <div class="result-icon" style="color: var(--warning); font-size: 60px;">
            <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3 style="color: var(--warning); margin-bottom: 12px;">Không thể kết nối ${modelName}</h3>
        <p style="color: var(--text-muted); font-size: 14px; text-align: center;">
            Hãy chắc chắn server đang chạy:<br>
            <code style="color: var(--text-secondary);">python ${modelName === 'TF-IDF' ? 'api_server.py' : 'api_server_fasttext.py'}</code>
        </p>
        <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
            ${error.message}
        </p>
    `;
}

// --- HÀM HIỂN THỊ LOADING ---
function showLoading(resultBox, placeholder) {
    placeholder.style.display = 'none';
    resultBox.className = 'result-box';
    resultBox.style.display = 'flex';
    resultBox.innerHTML = `
        <div class="spinner"></div>
        <p style="margin-top: 16px; color: var(--text-secondary); font-size: 14px;">
            Đang phân tích...
        </p>
    `;
}

// --- HÀM CHÍNH: PHÂN TÍCH VỚI CẢ 2 MODELS ---
async function predictMessage() {
    const message = inputElement.value;

    // 1. Kiểm tra input
    if (message.trim() === "") {
        showToast(" Vui lòng nhập nội dung tin nhắn!", "warning");
        return;
    }

    // 2. Disable button và hiển thị loading
    predictButton.disabled = true;
    const originalButtonText = predictButton.innerHTML;
    predictButton.innerHTML = '<span><div class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin-right: 8px;"></div>Đang phân tích...</span>';

    // Show loading cho cả 2 result box
    showLoading(tfidfResultBox, tfidfPlaceholder);
    showLoading(fasttextResultBox, fasttextPlaceholder);

    // 3. Gọi cả 2 APIs song song
    try {
        const [tfidfResult, fasttextResult] = await Promise.allSettled([
            callAPI(TFIDF_API_URL, 'TF-IDF'),
            callAPI(FASTTEXT_API_URL, 'FastText')
        ]);

        // 4. Hiển thị kết quả TF-IDF
        if (tfidfResult.status === 'fulfilled') {
            displayResult(tfidfResultBox, tfidfResult.value);
        } else {
            displayError(tfidfResultBox, 'TF-IDF', tfidfResult.reason);
        }

        // 5. Hiển thị kết quả FastText
        if (fasttextResult.status === 'fulfilled') {
            displayResult(fasttextResultBox, fasttextResult.value);
        } else {
            displayError(fasttextResultBox, 'FastText', fasttextResult.reason);
        }

        // 6. So sánh kết quả (nếu cả 2 đều thành công)
        if (tfidfResult.status === 'fulfilled' && fasttextResult.status === 'fulfilled') {
            const tfidfPred = tfidfResult.value.prediction;
            const fasttextPred = fasttextResult.value.prediction;

            if (tfidfPred !== fasttextPred) {
                showToast(" 2 models cho kết quả khác nhau!", "warning");
            } else {
                showToast(" Cả 2 models đều đồng ý: " + tfidfPred, "success");
            }
        }

    } catch (error) {
        console.error('Unexpected error:', error);
        showToast(" Lỗi không mong đợi: " + error.message, "error");
    } finally {
        // 7. Enable lại button
        predictButton.disabled = false;
        predictButton.innerHTML = originalButtonText;
    }
}

// --- HÀM HIỂN THỊ TOAST NOTIFICATION ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const colors = {
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--danger)',
        info: 'var(--cosmic-purple)'
    };

    toast.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- LẮNG NGHE SỰ KIỆN ---
inputElement.addEventListener("keypress", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        predictButton.click();
    }
});

// --- KHỞI TẠO PARTICLES (giữ nguyên từ code cũ nếu có) ---
const particlesContainer = document.getElementById('particles');
if (particlesContainer) {
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}