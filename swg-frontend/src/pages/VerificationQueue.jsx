import React, { useCallback, useEffect, useRef, useState } from 'react';
import useScanStore from '../store/scanStore';

const ADMIN_API = 'http://localhost:5003';
const POLL_INTERVAL_MS = 15_000;

function truncate(str, n = 80) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

const StatusBadge = ({ status, verdict }) => {
  if (status === 'verified') {
    return verdict === 'scam'
      ? <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">VERIFIED: SCAM</span>
      : <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">VERIFIED: SAFE</span>;
  }
  return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">PENDING REVIEW</span>;
};

const ConfBar = ({ value, label }) => {
  const pct = typeof value === 'number' ? value.toFixed(1) : null;
  if (!pct) return <span className="text-xs font-semibold text-gray-400">N/A</span>;
  const isHigh = value > 75;
  const isMedium = value >= 40 && value <= 75;
  const colorClass = isHigh ? 'bg-rose-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-end">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-[0.65rem] font-mono font-bold text-gray-900">{pct}%</span>
      </div>
      <div className="h-1 w-full bg-gray-200 overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

/* ─── ReportRow ─────────────────────────────────────────────────────── */
const ReportRow = ({ report, onVerify, onDiscard, verifying }) => {
  const [expanded, setExpanded]   = useState(false);
  const [dbChecking, setDbChecking] = useState(false);
  const [dbResult,   setDbResult]   = useState(null);
  const [dbError,    setDbError]    = useState(null);

  const ai = report.ai_prediction || {};
  const ft = ai.fasttext  || {};
  const db = ai.distilbert || {};

  /* Call DistilBERT directly (port 5002) with the report's text content */
  const handleCheckDistilbert = async (e) => {
    e.stopPropagation();
    const textToScan = report.page_text_preview || report.url || '';
    if (!textToScan) { setDbError('No text content available to scan.'); return; }

    setDbChecking(true);
    setDbResult(null);
    setDbError(null);
    try {
      const res = await fetch('http://localhost:5002/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToScan }),
      });
      if (!res.ok) throw new Error(`DistilBERT server returned HTTP ${res.status}`);
      const data = await res.json();
      setDbResult(data);
    } catch (err) {
      setDbError(err.message || 'Could not connect to DistilBERT (port 5002).');
    } finally {
      setDbChecking(false);
    }
  };

  /* Normalise live DistilBERT response (handles both confidence_score and confidence fields) */
  const liveDbConf  = dbResult
    ? (dbResult.confidence_score != null
        ? dbResult.confidence_score
        : dbResult.confidence != null ? dbResult.confidence * 100 : null)
    : null;
  const liveDbLabel = dbResult ? (dbResult.prediction || dbResult.label || '—') : null;
  const liveIsScam  = liveDbLabel?.toLowerCase() === 'scam';

  return (
    <div className={`bg-white border transition-colors ${expanded ? 'border-gray-400' : 'border-gray-200 hover:border-gray-300'}`}>

      {/* Header row — click to expand */}
      <div className="flex justify-between items-center px-6 py-4 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-4">
          <StatusBadge status={report.status} verdict={report.admin_verdict} />
          <span className="text-xs font-mono font-bold text-gray-400">ID:{report.id.slice(0,8).toUpperCase()}</span>
          <span className="text-[0.65rem] font-mono font-semibold text-gray-400">
            {new Date(report.reported_at).toISOString().replace('T', ' ').slice(0, 19)}
          </span>
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {expanded ? 'COLLAPSE' : 'EXPAND'}
        </div>
      </div>

      {/* Target URL */}
      <div className="px-6 pb-4 flex items-start gap-3">
        <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mt-1">TARGET</span>
        <a href={report.url} target="_blank" rel="noopener noreferrer"
           className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline break-all">
          {truncate(report.url, 120)}
        </a>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/50">

          {/* Original AI prediction bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">FASTTEXT LAYER</span>
              <ConfBar value={ft.confidence} label={ft.prediction || '—'} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">DISTILBERT LAYER</span>
              <ConfBar value={db.confidence} label={db.prediction || '—'} />
            </div>
          </div>

          {/* ── LIVE DISTILBERT RESULT BOX ─────────────────────────────── */}
          {(dbResult || dbChecking || dbError) && (
            <div className={`mb-6 p-4 border rounded-sm ${
              dbError         ? 'bg-rose-50 border-rose-200'
              : liveIsScam    ? 'bg-amber-50 border-amber-300'
                              : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className="text-[0.6rem] font-bold uppercase tracking-widest text-gray-500 block mb-3">
                LIVE DISTILBERT VERDICT
              </span>

              {dbChecking && (
                <span className="text-xs font-mono font-bold text-indigo-600 animate-pulse">
                  RUNNING DISTILBERT ANALYSIS...
                </span>
              )}

              {dbError && !dbChecking && (
                <span className="text-xs font-mono font-bold text-rose-600">ERROR: {dbError}</span>
              )}

              {dbResult && !dbChecking && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded border ${
                      liveIsScam
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-emerald-600 text-white border-emerald-700'
                    }`}>
                      {liveDbLabel?.toUpperCase() || 'UNKNOWN'}
                    </span>
                    {liveDbConf != null && (
                      <span className="text-sm font-black font-mono text-gray-900">
                        {liveDbConf.toFixed(1)}%&nbsp;CONFIDENCE
                      </span>
                    )}
                  </div>
                  {liveDbConf != null && (
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${liveIsScam ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(liveDbConf, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* ─────────────────────────────────────────────────────────────── */}

          {/* Extracted text preview */}
          {report.page_text_preview && (
            <div className="mb-6">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                EXTRACTED CONTENT PREVIEW
              </span>
              <div className="bg-gray-100 p-3 font-mono text-[0.7rem] text-gray-700 whitespace-pre-wrap break-words border border-gray-200">
                {truncate(report.page_text_preview, 500)}
              </div>
            </div>
          )}

          {/* User note */}
          {report.user_note && (
            <div className="mb-6 flex gap-2 text-sm text-gray-600">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest shrink-0">USER NOTE:</span>
              <span className="italic">"{report.user_note}"</span>
            </div>
          )}

          {/* Verified timestamp */}
          {report.status === 'verified' && (
            <div className="text-[0.65rem] font-bold text-emerald-600 uppercase tracking-widest mb-2">
              VERIFIED AT: {new Date(report.verified_at).toISOString().replace('T', ' ').slice(0, 19)}
            </div>
          )}

          {/* Action buttons — pending only */}
          {report.status === 'pending' && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
              {/* MARK AS SCAM */}
              <button
                onClick={() => onVerify(report.id, 'scam')}
                disabled={verifying === report.id}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
              >
                {verifying === report.id ? 'PROCESSING...' : 'MARK AS SCAM'}
              </button>

              {/* MARK AS SAFE */}
              <button
                onClick={() => onVerify(report.id, 'safe')}
                disabled={verifying === report.id}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
              >
                {verifying === report.id ? 'PROCESSING...' : 'MARK AS SAFE'}
              </button>

              {/* CHECK DISTILBERT — new button */}
              <button
                onClick={handleCheckDistilbert}
                disabled={dbChecking || verifying === report.id}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {dbChecking
                  ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />SCANNING...</>
                  : 'CHECK DISTILBERT'}
              </button>

              <div className="flex-1" />

              {/* DISCARD */}
              <button
                onClick={() => onDiscard(report.id)}
                disabled={verifying === report.id}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-rose-600 uppercase tracking-widest transition-colors"
              >
                DISCARD
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Main page ─────────────────────────────────────────────────────── */
export default function VerificationQueue() {
  const [reports,   setReports]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [filter,    setFilter]    = useState('pending');
  const [stats,     setStats]     = useState({ pending: 0, verified: 0 });
  const [toasts,    setToasts]    = useState([]);
  const [csvRows,   setCsvRows]   = useState(0);
  const [serverUp,  setServerUp]  = useState(null);
  const [isRetraining, setIsRetraining] = useState(false);
  const pollTimer = useRef(null);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchReports = useCallback(async (statusFilter = filter) => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}&limit=100` : '?limit=100';
      const res = await fetch(`${ADMIN_API}/api/reports${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setReports(data.reports || []);
      setStats({ pending: data.pending_count || 0, verified: data.verified_count || 0 });
      setServerUp(true);
      setError(null);
    } catch (e) {
      setServerUp(false);
      setError(`Cannot connect to Admin API (port 5003).`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchHealth = useCallback(async () => {
    try {
      const res  = await fetch(`${ADMIN_API}/health`);
      const data = await res.json();
      setCsvRows(data.csv_rows || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchReports(filter);
    fetchHealth();
    pollTimer.current = setInterval(() => {
      fetchReports(filter);
      fetchHealth();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer.current);
  }, [filter, fetchReports, fetchHealth]);

  const handleVerify = useCallback(async (reportId, verdict) => {
    setVerifying(reportId);
    try {
      const res = await fetch(`${ADMIN_API}/api/verify/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      addToast(`MARKED AS ${verdict.toUpperCase()}`, 'success');
      setReports(prev =>
        filter === 'pending'
          ? prev.filter(r => r.id !== reportId)
          : prev.map(r => r.id === reportId ? { ...r, ...data.report } : r)
      );
      setStats(prev => ({ pending: Math.max(0, prev.pending - 1), verified: prev.verified + 1 }));
      setCsvRows(n => n + 1);
      useScanStore.getState().addVerifiedRecord(data.report);
    } catch (e) {
      addToast(`VERIFICATION ERROR: ${e.message}`, 'error');
    } finally {
      setVerifying(null);
    }
  }, [filter, addToast]);

  const handleDiscard = useCallback(async (reportId) => {
    if (!window.confirm('Discard this report entirely?')) return;
    try {
      const res = await fetch(`${ADMIN_API}/api/report/${reportId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReports(prev => prev.filter(r => r.id !== reportId));
      setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
      addToast('REPORT DISCARDED', 'info');
    } catch (e) {
      addToast(`DISCARD ERROR: ${e.message}`, 'error');
    }
  }, [addToast]);

  const handleRetrainFastText = useCallback(async () => {
    if (!window.confirm(
      'Bạn có chắc chắn muốn nạp các dữ liệu đã duyệt và tiến hành tái huấn luyện mô hình FastText với 30 Epochs ngầm không?'
    )) return;

    setIsRetraining(true);
    try {
      const res = await fetch('https://localhost:8080/api/retrain/fasttext', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'swg-vnu-is-2026',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      alert(data.message
        + (data.new_samples_appended != null
          ? `\n\n✅ Số mẫu mới đã nạp: ${data.new_samples_appended} / ${data.total_reports_read} reports.`
          : ''));
    } catch (e) {
      alert(`❌ Lỗi kết nối: ${e.message}`);
    } finally {
      setIsRetraining(false);
    }
  }, []);

  return (
    <div className="p-10 w-full font-sans text-gray-900 max-w-[1600px] mx-auto relative">

      {/* Toast notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 font-mono text-[0.7rem] font-bold tracking-widest uppercase border ${
            t.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-900 text-white border-gray-800'
          }`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">VERIFICATION QUEUE</h1>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Human-in-the-loop AI model retraining pipeline</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setLoading(true); fetchReports(filter); fetchHealth(); }}
            className="text-xs font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest transition-colors"
          >
            {loading ? 'SYNCING...' : 'SYNC DATA'}
          </button>
          <button
            onClick={handleRetrainFastText}
            disabled={isRetraining}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            {isRetraining ? '⚙️ Đang kích hoạt...' : '🚀 Huấn luyện lại FastText'}
          </button>
        </div>
      </div>

      {serverUp === false && (
        <div className="mb-8 p-3 bg-rose-50 border border-rose-200 text-[0.7rem] font-bold tracking-widest uppercase text-rose-700">
          API OFFLINE: START SERVER USING `python api_server_report.py`
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-6 mb-8">
        {[
          { key: 'pending',  label: 'PENDING',  count: stats.pending },
          { key: 'verified', label: 'VERIFIED', count: stats.verified },
          { key: 'all',      label: 'ALL',      count: stats.pending + stats.verified },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setFilter(t.key); setLoading(true); }}
            className={`text-[0.7rem] font-bold uppercase tracking-widest transition-colors pb-1 border-b-2 ${
              filter === t.key ? 'text-gray-900 border-gray-900' : 'text-gray-400 border-transparent hover:text-gray-700'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Report list */}
      <div className="flex flex-col gap-3 min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-gray-400">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest animate-pulse">FETCHING TELEMETRY...</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 border border-gray-200 bg-white">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-gray-400">NO REPORTS IN QUEUE</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
    </div>
  );
}
