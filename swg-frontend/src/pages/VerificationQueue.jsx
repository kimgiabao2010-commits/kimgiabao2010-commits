/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  VerificationQueue.jsx — Admin SIEM: Hàng chờ kiểm định    ║
 * ║                                                             ║
 * ║  Hiển thị danh sách URL đang bị người dùng report.         ║
 * ║  Admin có thể xác nhận: [Là Scam] hoặc [Là An toàn].      ║
 * ║  Kết quả được ghi vào re_train_dataset.csv để re-train.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import './VerificationQueue.css';

const ADMIN_API = 'http://localhost:5003';
const POLL_INTERVAL_MS = 15_000; // Tự làm mới mỗi 15 giây

// ── Utility ────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncate(str, n = 80) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ── Sub-components ─────────────────────────────────────────────

const StatusBadge = ({ status, verdict }) => {
  if (status === 'verified') {
    return verdict === 'scam'
      ? <span className="vq-badge vq-badge--scam">🚨 Đã xác nhận: SCAM</span>
      : <span className="vq-badge vq-badge--safe">✅ Đã xác nhận: AN TOÀN</span>;
  }
  return <span className="vq-badge vq-badge--pending">⏳ Chờ kiểm định</span>;
};

const ConfBar = ({ value, label }) => {
  const pct = typeof value === 'number' ? value.toFixed(1) : null;
  if (!pct) return <span className="vq-na">N/A</span>;
  const isHigh   = value > 75;
  const isMedium = value >= 40 && value <= 75;
  const cls      = isHigh ? 'high' : isMedium ? 'medium' : 'low';
  return (
    <div className="vq-conf">
      <span className="vq-conf__label">{label}</span>
      <div className="vq-conf__bar-bg">
        <div className={`vq-conf__bar-fill vq-conf__bar-fill--${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="vq-conf__pct">{pct}%</span>
    </div>
  );
};

const ReportRow = ({ report, onVerify, onDiscard, verifying }) => {
  const [expanded, setExpanded] = useState(false);
  const ai = report.ai_prediction || {};
  const ft = ai.fasttext   || {};
  const db = ai.distilbert || {};

  return (
    <div className={`vq-card vq-card--${report.status}`} id={`report-${report.id}`}>
      {/* Header */}
      <div className="vq-card__header" onClick={() => setExpanded(e => !e)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}>
        <div className="vq-card__header-left">
          <StatusBadge status={report.status} verdict={report.admin_verdict} />
          <span className="vq-card__id">#{report.id}</span>
          <span className="vq-card__time">{fmtDate(report.reported_at)}</span>
        </div>
        <div className="vq-card__chevron">{expanded ? '▲' : '▼'}</div>
      </div>

      {/* URL */}
      <div className="vq-card__url">
        <span className="vq-card__url-icon">🔗</span>
        <a href={report.url} target="_blank" rel="noopener noreferrer" title={report.url}>
          {truncate(report.url, 90)}
        </a>
      </div>

      {/* AI Scores */}
      <div className="vq-card__scores">
        <div className="vq-card__score-block">
          <div className="vq-card__score-model">⚡ FastText</div>
          <ConfBar value={ft.confidence} label={ft.prediction || '—'} />
        </div>
        <div className="vq-card__score-sep" />
        <div className="vq-card__score-block">
          <div className="vq-card__score-model">🧠 DistilBERT</div>
          <ConfBar value={db.confidence} label={db.prediction || '—'} />
        </div>
      </div>

      {/* Preview text Always Visible */}
      {report.page_text_preview && (
        <div className="vq-card__preview" style={{ margin: '10px 16px', background: 'var(--surface-50)', padding: '10px', borderRadius: '4px', fontStyle: 'italic', borderLeft: '3px solid var(--amber)' }}>
          <div className="vq-card__preview-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>📄 Nội dung bị bôi đen / phát hiện:</div>
          <div className="vq-card__preview-body" style={{ fontSize: '0.85rem' }}>"{truncate(report.page_text_preview, 400)}"</div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="vq-card__details">
          {report.user_note && (
            <div className="vq-card__note">
              <span className="vq-card__note-label">📝 Ghi chú người dùng:</span>
              <span>{report.user_note}</span>
            </div>
          )}
          {report.status === 'verified' && (
            <div className="vq-card__verified-info">
              <span>✔️ Xác nhận lúc: {fmtDate(report.verified_at)}</span>
              {report.admin_note && <span> — {report.admin_note}</span>}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — chỉ hiển thị khi còn pending */}
      {report.status === 'pending' && (
        <div className="vq-card__actions">
          <button
            id={`btn-scam-${report.id}`}
            className="vq-btn vq-btn--scam"
            onClick={() => onVerify(report.id, 'scam')}
            disabled={verifying === report.id}
          >
            {verifying === report.id ? '⏳ Đang xử lý…' : '🚨 Xác nhận: Là Scam'}
          </button>
          <button
            id={`btn-safe-${report.id}`}
            className="vq-btn vq-btn--safe"
            onClick={() => onVerify(report.id, 'safe')}
            disabled={verifying === report.id}
          >
            {verifying === report.id ? '⏳ Đang xử lý…' : '✅ Xác nhận: Là An toàn'}
          </button>
          <button
            id={`btn-discard-${report.id}`}
            className="vq-btn vq-btn--discard"
            onClick={() => onDiscard(report.id)}
            disabled={verifying === report.id}
            title="Xóa báo cáo này khỏi hàng chờ"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
};

// ── Toast notification ─────────────────────────────────────────
const ToastStack = ({ toasts }) => (
  <div className="vq-toast-stack">
    {toasts.map(t => (
      <div key={t.id} className={`vq-toast vq-toast--${t.type}`}>
        {t.message}
      </div>
    ))}
  </div>
);

// ══ Main Component ══════════════════════════════════════════════
import useScanStore from '../store/scanStore';

const VerificationQueue = () => {
  const [reports,   setReports]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [verifying, setVerifying] = useState(null); // report_id đang được verify
  const [filter,    setFilter]    = useState('pending'); // 'pending' | 'verified' | 'all'
  const [stats,     setStats]     = useState({ pending: 0, verified: 0 });
  const [toasts,    setToasts]    = useState([]);
  const [csvRows,   setCsvRows]   = useState(0);
  const [serverUp,  setServerUp]  = useState(null);
  const pollTimer = useRef(null);

  // ── Toast helper ─────────────────────────────────────────────
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Fetch reports ─────────────────────────────────────────────
  const fetchReports = useCallback(async (statusFilter = filter) => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}&limit=100` : '?limit=100';
      const res = await fetch(`${ADMIN_API}/api/reports${params}`);
      if (!res.ok) throw new Error(`Server trả về ${res.status}`);
      const data = await res.json();
      setReports(data.reports || []);
      setStats({ pending: data.pending_count || 0, verified: data.verified_count || 0 });
      setServerUp(true);
      setError(null);
    } catch (e) {
      setServerUp(false);
      setError(`Không thể kết nối Admin Server (port 5003): ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // ── Health check để lấy csv_rows ─────────────────────────────
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_API}/health`);
      const data = await res.json();
      setCsvRows(data.csv_rows || 0);
    } catch { /* ignore */ }
  }, []);

  // ── Polling & mount ──────────────────────────────────────────
  useEffect(() => {
    fetchReports(filter);
    fetchHealth();
    pollTimer.current = setInterval(() => {
      fetchReports(filter);
      fetchHealth();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer.current);
  }, [filter, fetchReports, fetchHealth]);

  // ── Verify action ─────────────────────────────────────────────
  const handleVerify = useCallback(async (reportId, verdict) => {
    setVerifying(reportId);
    try {
      const res = await fetch(`${ADMIN_API}/api/verify/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      addToast(
        verdict === 'scam'
          ? `🚨 Đã xác nhận SCAM! Dữ liệu ghi vào CSV re-train.`
          : `✅ Đã xác nhận AN TOÀN! Dữ liệu ghi vào CSV re-train.`,
        verdict === 'scam' ? 'scam' : 'safe',
      );
      // Cập nhật local state
      setReports(prev =>
        filter === 'pending'
          ? prev.filter(r => r.id !== reportId)
          : prev.map(r => r.id === reportId ? { ...r, ...data.report } : r)
      );
      setStats(prev => ({
        pending:  Math.max(0, prev.pending - 1),
        verified: prev.verified + 1,
      }));
      setCsvRows(n => n + 1);

      // Cập nhật lên Dashboard Tổng Quan
      useScanStore.getState().addVerifiedRecord(data.report);

    } catch (e) {
      addToast(`❌ Lỗi xác nhận: ${e.message}`, 'error');
    } finally {
      setVerifying(null);
    }
  }, [filter, addToast]);

  // ── Discard action ────────────────────────────────────────────
  const handleDiscard = useCallback(async (reportId) => {
    if (!window.confirm('Xóa báo cáo này khỏi hàng chờ?')) return;
    try {
      const res = await fetch(`${ADMIN_API}/api/report/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReports(prev => prev.filter(r => r.id !== reportId));
      setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
      addToast('🗑️ Đã xóa báo cáo.', 'info');
    } catch (e) {
      addToast(`❌ Lỗi xóa: ${e.message}`, 'error');
    }
  }, [addToast]);

  // ── Export CSV ────────────────────────────────────────────────
  const handleExportCSV = () => {
    window.open(`${ADMIN_API}/api/export`, '_blank');
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="vq-root" id="verification-queue-page">
      <ToastStack toasts={toasts} />

      {/* Header */}
      <div className="vq-header">
        <div className="vq-header__left">
          <h1 className="vq-title">🔬 Hàng chờ kiểm định AI</h1>
          <p className="vq-subtitle">
            Human-in-the-Loop — Admin xác nhận kết quả AI để tái huấn luyện DistilBERT
          </p>
        </div>
        <div className="vq-header__right">
          <button
            id="btn-export-csv"
            className="vq-btn-export"
            onClick={handleExportCSV}
            title="Tải file CSV để re-train DistilBERT"
          >
            ⬇️ Xuất CSV re-train ({csvRows} dòng)
          </button>
          <button
            id="btn-refresh"
            className="vq-btn-refresh"
            onClick={() => { setLoading(true); fetchReports(filter); fetchHealth(); }}
            title="Làm mới"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Server status */}
      {serverUp === false && (
        <div className="vq-offline-banner">
          ⚠️ <strong>Admin Report Server đang offline!</strong>
          &nbsp;Hãy chạy: <code>python api_server_report.py</code>
        </div>
      )}

      {/* Stats bar */}
      <div className="vq-stats">
        <div className="vq-stat vq-stat--pending">
          <span className="vq-stat__num">{stats.pending}</span>
          <span className="vq-stat__label">Chờ kiểm định</span>
        </div>
        <div className="vq-stat vq-stat--verified">
          <span className="vq-stat__num">{stats.verified}</span>
          <span className="vq-stat__label">Đã xác nhận</span>
        </div>
        <div className="vq-stat vq-stat--csv">
          <span className="vq-stat__num">{csvRows}</span>
          <span className="vq-stat__label">Dòng CSV re-train</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="vq-tabs" role="tablist">
        {[
          { key: 'pending',  label: '⏳ Chờ duyệt', count: stats.pending },
          { key: 'verified', label: '✔️ Đã duyệt',  count: stats.verified },
          { key: 'all',      label: '📋 Tất cả',    count: stats.pending + stats.verified },
        ].map(tab => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            aria-selected={filter === tab.key}
            className={`vq-tab ${filter === tab.key ? 'vq-tab--active' : ''}`}
            onClick={() => { setFilter(tab.key); setLoading(true); }}
          >
            {tab.label}
            <span className="vq-tab__count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="vq-content">
        {loading ? (
          <div className="vq-loading">
            <div className="vq-spinner" />
            <span>Đang tải dữ liệu từ Admin Server…</span>
          </div>
        ) : error && serverUp === false ? (
          <div className="vq-error">
            <div className="vq-error__icon">🔌</div>
            <div className="vq-error__text">{error}</div>
            <div className="vq-error__hint">
              Khởi động server bằng lệnh:<br />
              <code>python api_server_report.py</code>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="vq-empty">
            <div className="vq-empty__icon">
              {filter === 'pending' ? '🎉' : '📭'}
            </div>
            <div className="vq-empty__text">
              {filter === 'pending'
                ? 'Không có báo cáo nào đang chờ duyệt!'
                : 'Chưa có dữ liệu trong bộ lọc này.'}
            </div>
            {filter === 'pending' && (
              <div className="vq-empty__sub">
                Khi Extension phát hiện trang nghi ngờ (AI confidence 40–80%),<br />
                người dùng có thể nhấn "Báo cáo Admin" để gửi về đây.
              </div>
            )}
          </div>
        ) : (
          <div className="vq-list">
            {reports.map(report => (
              <ReportRow
                key={report.id}
                report={report}
                onVerify={handleVerify}
                onDiscard={handleDiscard}
                verifying={verifying}
              />
            ))}
          </div>
        )}
      </div>

      {/* Auto-refresh notice */}
      <div className="vq-footer">
        <span>🔄 Tự động làm mới mỗi {POLL_INTERVAL_MS / 1000}s</span>
        {serverUp === true && <span className="vq-server-ok">● Admin Server: Online (port 5003)</span>}
      </div>
    </div>
  );
};

export default VerificationQueue;
