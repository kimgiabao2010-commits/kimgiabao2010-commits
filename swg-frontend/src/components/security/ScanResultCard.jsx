import React from 'react';
import ThreatBadge from './ThreatBadge';
import { formatConfidence, formatDateTime, truncate } from '../../utils/helpers';
import './ScanResultCard.css';

const ConfBar = ({ value, color }) => (
  <div className="conf-bar">
    <div className="conf-bar__fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
  </div>
);

const ScanResultCard = ({ result, inputText, timestamp }) => {
  if (!result) return null;

  const blockedByWAF      = result.blocked === true || result.waf_blocked === true;
  const blockedByFastText = !blockedByWAF && result.fasttext_blocked === true;
  const blockedByDistil   = !blockedByWAF && !blockedByFastText && result.distilbert_blocked === true;
  const isScam = result.label?.toLowerCase() === 'scam' || result.prediction?.toLowerCase() === 'scam';

  let verdictStatus;
  if      (blockedByWAF)      verdictStatus = 'blocked_waf';
  else if (blockedByFastText) verdictStatus = 'blocked_fasttext';
  else if (blockedByDistil)   verdictStatus = 'blocked_distilbert';
  else if (isScam)            verdictStatus = 'scam';
  else                         verdictStatus = 'safe';

  // Confidence: DistilBERT trả confidence_score (0-100), FastText trả confidence (0-1)
  const ftConfidence = result.confidence ?? result.probability ?? null;
  const dbConfidence = result.confidence_score != null ? result.confidence_score / 100 : null;
  const primaryConfidence = dbConfidence ?? ftConfidence;
  const confColor = verdictStatus === 'safe' ? 'var(--green)' : 'var(--red)';

  return (
    <div className={`scan-result-card scan-result-card--${verdictStatus}`} id="scan-result-card">
      {/* Header */}
      <div className="src__header">
        <div className="src__title-row">
          <span className="src__title">Kết Quả Phân Tích</span>
          {timestamp && <span className="src__ts">{formatDateTime(timestamp)}</span>}
        </div>
        <ThreatBadge status={verdictStatus} size="lg" />
      </div>

      {/* Content */}
      <div className="src__body">
        {/* Input preview */}
        <div className="src__section">
          <span className="src__section-label">Nội dung kiểm tra</span>
          <div className="src__text-preview">{truncate(inputText, 120)}</div>
        </div>

        {/* 3 Layer cards */}
        <div className="src__row">
          {/* WAF */}
          <div className="src__layer-card src__layer-card--waf">
            <span className="src__layer-title">🔥 WAF — Layer 1</span>
            {blockedByWAF ? (
              <>
                <span className="src__layer-val src__layer-val--blocked">BLOCKED</span>
                {result.attack_type && (
                  <span className="src__layer-sub">Type: {result.attack_type}</span>
                )}
                {(result.detail || result.reason) && (
                  <span className="src__layer-sub">Lý do: {result.detail || result.reason}</span>
                )}
              </>
            ) : (
              <span className="src__layer-val src__layer-val--pass">PASS ✓</span>
            )}
          </div>

          {/* FastText */}
          <div className="src__layer-card src__layer-card--fasttext">
            <span className="src__layer-title">🧠 FastText — Layer 2</span>
            {blockedByWAF ? (
              <span className="src__layer-val src__layer-val--skip">SKIPPED</span>
            ) : (
              <>
                <span className={`src__layer-val ${result.ft_prediction?.toLowerCase() === 'scam' ? 'src__layer-val--blocked' : 'src__layer-val--pass'}`}>
                  {result.ft_prediction?.toLowerCase() === 'scam' ? 'CẢNH BÁO SCAM' : 'DỰ ĐOÁN AN TOÀN'}
                </span>
                {ftConfidence !== null && (
                  <>
                    <ConfBar value={ftConfidence} color={result.ft_prediction?.toLowerCase() === 'scam' ? 'var(--red)' : 'var(--green)'} />
                    <span className="src__layer-sub">Confidence: {formatConfidence(ftConfidence)}</span>
                  </>
                )}
              </>
            )}
          </div>

          {/* DistilBERT */}
          <div className="src__layer-card src__layer-card--distilbert">
            <span className="src__layer-title">🤖 DistilBERT — Layer 3</span>
            {blockedByWAF ? (
              <span className="src__layer-val src__layer-val--skip">SKIPPED</span>
            ) : result.is_scam != null ? (
              // DistilBERT đã chạy
              <>
                <span className={`src__layer-val ${result.is_scam ? 'src__layer-val--blocked' : 'src__layer-val--pass'}`}>
                  {result.is_scam ? 'BLOCKED' : 'PASS ✓'}
                </span>
                {dbConfidence !== null && (
                  <>
                    <ConfBar value={dbConfidence} color={result.is_scam ? 'var(--red)' : 'var(--green)'} />
                    <span className="src__layer-sub">
                      Confidence: {formatConfidence(dbConfidence)}
                    </span>
                  </>
                )}
                {result.inference_time_ms && (
                  <span className="src__layer-sub" style={{ color: 'var(--text-dim)' }}>
                    Inference: {result.inference_time_ms}ms
                  </span>
                )}
              </>
            ) : (
              // DistilBERT không chạy
              <span className="src__layer-val src__layer-val--skip">
                {blockedByFastText ? 'SKIPPED' : 'N/A'}
              </span>
            )}
          </div>
        </div>

        {/* Verdict message */}
        <div className={`src__verdict src__verdict--${verdictStatus}`}>
          {verdictStatus === 'safe' && '✅ Nội dung này an toàn. Không phát hiện mối đe dọa qua tất cả các layer.'}
          {verdictStatus === 'blocked_waf' && `🔥 Bị chặn bởi WAF: ${result.detail || result.reason || result.attack_type || 'Pattern match phát hiện tấn công'}`}
          {verdictStatus === 'blocked_fasttext' && `🧠 FastText AI xác định nội dung này là lừa đảo (${formatConfidence(ftConfidence || 0)})`}
          {verdictStatus === 'blocked_distilbert' && `🤖 DistilBERT Transformer xác định nội dung này là lừa đảo (${dbConfidence ? formatConfidence(dbConfidence) : '—'})`}
          {verdictStatus === 'scam' && '⚠️ AI phát hiện đây là tin nhắn lừa đảo'}
        </div>
      </div>
    </div>
  );
};

export default ScanResultCard;
