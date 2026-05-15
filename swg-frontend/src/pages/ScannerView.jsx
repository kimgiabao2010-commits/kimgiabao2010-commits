import React, { useState } from 'react';
import useScanStore from '../store/scanStore';
import PipelineVisualizer from '../components/security/PipelineVisualizer';
import ScanResultCard from '../components/security/ScanResultCard';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './ScannerView.css';

const EXAMPLES = [
  'Chúc mừng bạn đã trúng thưởng 50 triệu đồng! Liên hệ ngay: 0987654321 để nhận thưởng.',
  'Tuyển nhân viên làm việc tại nhà, lương 20 triệu/tháng, không cần kinh nghiệm.',
  "SELECT * FROM users WHERE username='admin'--",
  "<script>alert('XSS')</script>",
  'Mời bạn đầu tư tiền điện tử, lợi nhuận 300% chỉ trong 30 ngày!',
  'Nhân viên kế toán thực sự, lương cứng 12 triệu + thưởng. Nộp hồ sơ tại công ty.',
];

/* ── Trạng thái badge từng bước ────────────────────────────── */
const StepBadge = ({ status }) => {
  const MAP = {
    idle:     { cls: 'step-badge--idle',     icon: '○', text: 'Chờ' },
    scanning: { cls: 'step-badge--scanning', icon: '⟳', text: 'Đang quét...' },
    done:     { cls: 'step-badge--done',     icon: '✓', text: 'Đã qua' },
    blocked:  { cls: 'step-badge--blocked',  icon: '✕', text: 'BỊ CHẶN' },
    error:    { cls: 'step-badge--error',    icon: '!', text: 'Lỗi' },
  };
  const cfg = MAP[status] || MAP.idle;
  return (
    <span className={`step-badge ${cfg.cls}`}>
      <span className="step-badge__icon">{cfg.icon}</span>
      {cfg.text}
    </span>
  );
};

/* ── Kết quả WAF nhỏ gọn ───────────────────────────────────── */
const WAFMiniResult = ({ wafResult, stepStatus }) => {
  if (!wafResult) return null;
  const blocked = stepStatus === 'blocked';
  return (
    <div className={`mini-result mini-result--${blocked ? 'blocked' : 'pass'}`}>
      <div className="mini-result__header">
        <span className="mini-result__layer">🔥 WAF — Layer 1</span>
        <StepBadge status={stepStatus} />
      </div>
      <div className="mini-result__body">
        {blocked ? (
          <>
            <div className="mini-result__row">
              <span className="mini-result__label">Loại tấn công</span>
              <span className="mini-result__val mini-result__val--danger">
                {wafResult.attack_type || 'UNKNOWN'}
              </span>
            </div>
            {wafResult.detail && (
              <div className="mini-result__row">
                <span className="mini-result__label">Chi tiết</span>
                <span className="mini-result__val">{wafResult.detail}</span>
              </div>
            )}
          </>
        ) : (
          <div className="mini-result__row">
            <span className="mini-result__label">Trạng thái</span>
            <span className="mini-result__val mini-result__val--safe">
              ✓ Payload sạch — cho phép qua Layer 2
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Kết quả FastText nhỏ gọn ──────────────────────────────── */
const FastTextMiniResult = ({ ftResult, stepStatus }) => {
  if (!ftResult) return null;
  
  // FastText không "block" pipeline, nhưng về mặt hiển thị ta cần tô đỏ nếu nó là Scam
  const isScam = ftResult.prediction?.toLowerCase() === 'scam';
  const confPct = ftResult.confidence ? Math.round(ftResult.confidence * 100) : null;
  
  return (
    <div className={`mini-result mini-result--${isScam ? 'blocked' : 'pass'}`}>
      <div className="mini-result__header">
        <span className="mini-result__layer">🧠 FastText AI — Layer 2</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {ftResult.cached && <span className="cache-tag">CACHE</span>}
          {/* Thay vì dùng StepBadge mặc định (luôn Done), ta tùy biến riêng */}
          <span className={`step-badge ${isScam ? 'step-badge--blocked' : 'step-badge--done'}`} style={{ backgroundColor: isScam ? 'var(--red-dark)' : 'var(--green-dark)' }}>
            <span className="step-badge__icon">{isScam ? '!' : '✓'}</span>
            {isScam ? 'Nghi ngờ' : 'Đã qua'}
          </span>
        </div>
      </div>
      <div className="mini-result__body">
        <div className="mini-result__row">
          <span className="mini-result__label">Phân loại</span>
          <span className={`mini-result__val ${isScam ? 'mini-result__val--danger' : 'mini-result__val--safe'}`}>
            {ftResult.prediction}
          </span>
        </div>
        {confPct !== null && (
          <div className="mini-result__row">
            <span className="mini-result__label">Độ tin cậy</span>
            <div className="mini-conf">
              <div className="mini-conf__bar">
                <div className="mini-conf__fill" style={{
                  width: `${confPct}%`,
                  background: isScam ? 'var(--red)' : 'var(--green)',
                }} />
              </div>
              <span className="mini-conf__pct">{confPct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Kết quả DistilBERT nhỏ gọn ──────────────────────────────── */
const DistilBERTMiniResult = ({ dbResult, stepStatus }) => {
  if (!dbResult) return null;
  const blocked = stepStatus === 'blocked';
  const confPct = dbResult.confidence_score != null ? Math.round(dbResult.confidence_score) : null;
  return (
    <div className={`mini-result mini-result--${blocked ? 'blocked' : 'pass'}`}>
      <div className="mini-result__header">
        <span className="mini-result__layer">🤖 DistilBERT — Layer 3</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {dbResult.cached && <span className="cache-tag">CACHE</span>}
          <StepBadge status={stepStatus} />
        </div>
      </div>
      <div className="mini-result__body">
        <div className="mini-result__row">
          <span className="mini-result__label">Phân loại</span>
          <span className={`mini-result__val ${blocked ? 'mini-result__val--danger' : 'mini-result__val--safe'}`}>
            {dbResult.prediction}
          </span>
        </div>
        {confPct !== null && (
          <div className="mini-result__row">
            <span className="mini-result__label">Độ tin cậy</span>
            <div className="mini-conf">
              <div className="mini-conf__bar">
                <div className="mini-conf__fill" style={{
                  width: `${confPct}%`,
                  background: blocked ? 'var(--red)' : 'var(--green)',
                }} />
              </div>
              <span className="mini-conf__pct">{confPct}%</span>
            </div>
          </div>
        )}
        {dbResult.inference_time_ms != null && (
          <div className="mini-result__row">
            <span className="mini-result__label">Thời gian</span>
            <span className="mini-result__val" style={{ color: 'var(--text-muted)' }}>
              {dbResult.inference_time_ms}ms
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
const ScannerView = () => {
  const {
    inputText, setInputText,
    stepStatus,
    wafResult, fastTextResult, distilbertResult,
    runWAFScan, runAIScan, runDistilBERTScan,
    resetScan,
    error,
    history,
    hasConflict, conflictDetail,
    sendAdminReport,
    cacheHit,
    distilbertOnline,
  } = useScanStore();

  const [charCount, setCharCount] = useState(0);

  // Derived states
  const wafScanning  = stepStatus.waf === 'scanning';
  const ftScanning   = stepStatus.fasttext === 'scanning';
  const dbScanning   = stepStatus.distilbert === 'scanning';
  const wafDone      = stepStatus.waf === 'done';
  const wafBlocked   = stepStatus.waf === 'blocked';
  const wafFinished  = wafDone || wafBlocked;
  const ftFinished   = stepStatus.fasttext === 'done' || stepStatus.fasttext === 'blocked';
  const dbFinished   = stepStatus.distilbert === 'done' || stepStatus.distilbert === 'blocked' || stepStatus.distilbert === 'error';
  const anyScanning  = wafScanning || ftScanning || dbScanning;

  // DistilBERT có thể trigger thủ công nếu FastText xong mà DistilBERT chưa chạy
  const canManualDistilBERT = ftFinished && stepStatus.distilbert === 'idle' && distilbertOnline;

  const handleInput = (e) => {
    setInputText(e.target.value);
    setCharCount(e.target.value.length);
    if (wafFinished) resetScan();
  };

  const handleExample = (ex) => {
    setInputText(ex);
    setCharCount(ex.length);
    resetScan();
  };

  const handleClear = () => {
    setInputText('');
    setCharCount(0);
    resetScan();
  };

  // Combined result cho ScanResultCard
  const combined = (wafResult || fastTextResult || distilbertResult) ? {
    ...(wafResult         || {}),
    ...(fastTextResult    || {}),
    ...(distilbertResult  || {}),
    waf_blocked:        wafBlocked,
    blocked:            wafBlocked,
    fasttext_blocked:   stepStatus.fasttext === 'blocked',
    distilbert_blocked: distilbertResult?.distilbert_blocked || false,
  } : null;

  const lastEntry = history[0];

  return (
    <div className="scanner" id="scanner-page">
      {/* Pipeline */}
      <PipelineVisualizer />

      {/* Cache hit indicator */}
      {cacheHit && (
        <div className="cache-banner">
          ⚡ Kết quả được lấy từ bộ nhớ đệm (cache) — không cần gọi lại API
        </div>
      )}

      {/* ── Input Card ─────────────────────────────────────── */}
      <div className="scanner__card" id="scanner-input-card">
        <div className="scanner__card-header">
          <span>✏️</span>
          <span>Nhập nội dung cần kiểm tra</span>
          {wafFinished && (
            <button className="scanner__reset-btn" onClick={handleClear} title="Quét lại từ đầu">
              ↺ Quét mới
            </button>
          )}
        </div>

        <textarea
          id="scanner-textarea"
          className="scanner__textarea"
          placeholder={`Dán tin nhắn tuyển dụng, quảng cáo hoặc nội dung bất kỳ...\n\nVí dụ: 'Tuyển nhân viên làm việc tại nhà, lương 15 triệu/tháng...'`}
          value={inputText}
          onChange={handleInput}
          disabled={anyScanning || wafFinished}
          rows={5}
        />

        <div className="scanner__actions">
          <span className="char-count">{charCount} ký tự</span>
          <div className="scanner__btns">
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={anyScanning} id="scanner-clear-btn">
              🗑 Xóa
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => handleExample(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
              disabled={anyScanning || wafFinished}
              id="scanner-example-btn"
            >
              💡 Ví dụ
            </Button>
          </div>
        </div>
      </div>

      {/* ── Thử nhanh ──────────────────────────────────────── */}
      {!wafFinished && (
        <div className="scanner__examples">
          <span className="examples-label">Thử nhanh:</span>
          <div className="examples-list">
            {EXAMPLES.slice(0, 4).map((ex, i) => (
              <button
                key={i}
                id={`example-${i}`}
                className="example-chip"
                onClick={() => handleExample(ex)}
                disabled={anyScanning}
              >
                {ex.slice(0, 38)}…
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ Khu vực 3 bước ══════════════════════════════════ */}
      <div className="steps-area">

        {/* ── Bước 1: WAF ──────────────────────────────────── */}
        <div className={`step-card ${wafFinished ? (wafBlocked ? 'step-card--blocked' : 'step-card--done') : 'step-card--active'}`}
             id="step-waf">
          <div className="step-card__head">
            <div className="step-num">1</div>
            <div className="step-card__title-group">
              <span className="step-card__title">🔥 WAF — Layer 1</span>
              <span className="step-card__sub">ModSecurity Rule-based Filter</span>
            </div>
            <StepBadge status={stepStatus.waf} />
          </div>

          {wafResult && <WAFMiniResult wafResult={wafResult} stepStatus={stepStatus.waf} />}

          {wafScanning && (
            <div className="step-loading">
              <LoadingSpinner size="sm" />
              <span>Đang kiểm tra qua WAF Engine...</span>
            </div>
          )}

          {!wafFinished && (
            <Button
              id="btn-scan-waf"
              variant="primary" size="md"
              onClick={runWAFScan}
              loading={wafScanning}
              disabled={!inputText.trim() || anyScanning}
              className="step-card__btn"
            >
              🔥 Bước 1: Quét WAF
            </Button>
          )}

          {wafBlocked && (
            <div className="step-blocked-msg">
              🚫 WAF đã chặn request. Không cần tiếp tục sang Layer 2.
            </div>
          )}
        </div>

        {/* ── Bước 2: FastText ─────────────────────────────── */}
        <div className={`step-card
            ${!wafDone ? 'step-card--disabled' : ''}
            ${stepStatus.fasttext === 'done'    ? 'step-card--done' : ''}
            ${stepStatus.fasttext === 'blocked' ? 'step-card--blocked' : ''}
            ${wafDone && stepStatus.fasttext === 'idle' ? 'step-card--active' : ''}
          `}
          id="step-fasttext"
        >
          <div className="step-card__head">
            <div className={`step-num ${!wafDone ? 'step-num--disabled' : ''}`}>2</div>
            <div className="step-card__title-group">
              <span className="step-card__title">🧠 FastText AI — Layer 2</span>
              <span className="step-card__sub">Machine Learning Classification</span>
            </div>
            <StepBadge status={stepStatus.fasttext} />
          </div>

          {!wafDone && !ftScanning && stepStatus.fasttext === 'idle' && (
            <div className="step-locked">🔒 Hoàn thành Bước 1 trước</div>
          )}

          {fastTextResult && (
            <FastTextMiniResult ftResult={fastTextResult} stepStatus={stepStatus.fasttext} />
          )}

          {ftScanning && (
            <div className="step-loading">
              <LoadingSpinner size="sm" />
              <span>FastText AI đang phân tích ngữ nghĩa...</span>
            </div>
          )}

          {wafDone && stepStatus.fasttext === 'idle' && (
            <Button
              id="btn-scan-ai"
              variant="primary" size="md"
              onClick={runAIScan}
              loading={ftScanning}
              disabled={!wafDone || ftScanning}
              className="step-card__btn"
            >
              🧠 Bước 2: Phân Tích AI
            </Button>
          )}
        </div>

        {/* ── Bước 3: DistilBERT ──────────────────────────── */}
        <div className={`step-card step-card--wide
            ${!ftFinished ? 'step-card--disabled' : ''}
            ${stepStatus.distilbert === 'done'    ? 'step-card--done' : ''}
            ${stepStatus.distilbert === 'blocked' ? 'step-card--blocked' : ''}
            ${stepStatus.distilbert === 'scanning' ? 'step-card--active' : ''}
            ${stepStatus.distilbert === 'error' ? 'step-card--error-state' : ''}
          `}
          id="step-distilbert"
        >
          <div className="step-card__head">
            <div className={`step-num ${!ftFinished ? 'step-num--disabled' : ''}`}
                 style={{ '--num-color': 'var(--amber)' }}>3</div>
            <div className="step-card__title-group">
              <span className="step-card__title">🤖 DistilBERT — Layer 3</span>
              <span className="step-card__sub">Transformer Deep NLP Analysis (Thẩm định sâu)</span>
            </div>
            <StepBadge status={stepStatus.distilbert} />
          </div>

          {/* Locked */}
          {!ftFinished && stepStatus.distilbert === 'idle' && (
            <div className="step-locked">
              🔒 Layer 3 tự động kích hoạt khi FastText phát hiện Scam hoặc kết quả nghi ngờ
            </div>
          )}

          {/* DistilBERT result */}
          {distilbertResult && (
            <DistilBERTMiniResult dbResult={distilbertResult} stepStatus={stepStatus.distilbert} />
          )}

          {/* Loading */}
          {dbScanning && (
            <div className="step-loading">
              <LoadingSpinner size="sm" />
              <span>DistilBERT Transformer đang phân tích sâu...</span>
            </div>
          )}

          {/* Manual trigger button */}
          {canManualDistilBERT && (
            <Button
              id="btn-scan-distilbert"
              variant="secondary" size="md"
              onClick={runDistilBERTScan}
              loading={dbScanning}
              disabled={dbScanning}
              className="step-card__btn"
            >
              🤖 Thẩm định sâu bằng DistilBERT
            </Button>
          )}

          {/* DistilBERT offline notice */}
          {ftFinished && stepStatus.distilbert === 'idle' && !distilbertOnline && (
            <div className="step-offline-notice">
              ⚠️ DistilBERT server đang offline (port 5002). Kết quả dựa trên FastText Layer 2.
            </div>
          )}

          {/* DistilBERT error — graceful degradation */}
          {stepStatus.distilbert === 'error' && (
            <div className="step-error-notice">
              ⚠️ DistilBERT gặp lỗi — hệ thống vẫn hoạt động với kết quả FastText.
            </div>
          )}
        </div>
      </div>

      {/* ── Conflict Alert: FastText vs DistilBERT ────────── */}
      {hasConflict && conflictDetail && (
        <div className="conflict-alert" id="conflict-alert">
          <div className="conflict-alert__icon">⚠️</div>
          <div className="conflict-alert__body">
            <div className="conflict-alert__title">Kết quả mâu thuẫn giữa 2 mô hình AI</div>
            <div className="conflict-alert__detail">
              <div className="conflict-item">
                <span className="conflict-model">🧠 FastText:</span>
                <span className={conflictDetail.fasttext.is_scam ? 'conflict-scam' : 'conflict-safe'}>
                  {conflictDetail.fasttext.prediction}
                </span>
                <span className="conflict-conf">
                  ({Math.round(conflictDetail.fasttext.confidence * 100)}%)
                </span>
              </div>
              <div className="conflict-item">
                <span className="conflict-model">🤖 DistilBERT:</span>
                <span className={conflictDetail.distilbert.is_scam ? 'conflict-scam' : 'conflict-safe'}>
                  {conflictDetail.distilbert.prediction}
                </span>
                <span className="conflict-conf">
                  ({Math.round(conflictDetail.distilbert.confidence_score)}%)
                </span>
              </div>
            </div>
            <Button
              id="btn-admin-report"
              variant="danger" size="sm"
              onClick={sendAdminReport}
              className="conflict-alert__btn"
            >
              📧 Gửi báo cáo cho Admin
            </Button>
          </div>
        </div>
      )}

      {/* ── Lỗi kết nối ────────────────────────────────────── */}
      {error && (
        <div className="scanner__error" id="scanner-error">
          <span>⚠️</span>
          <div>
            <div className="error-title">Lỗi kết nối</div>
            <div className="error-msg">{error}</div>
            <div className="error-hint">Đảm bảo các server đang chạy (WAF:8000, FastText:5001, DistilBERT:5002)</div>
          </div>
        </div>
      )}

      {/* ── Kết quả tổng hợp ────────────────────────────────── */}
      {combined && lastEntry && (
        <ScanResultCard
          result={combined}
          inputText={lastEntry.text}
          timestamp={lastEntry.timestamp}
        />
      )}
    </div>
  );
};

export default ScannerView;
