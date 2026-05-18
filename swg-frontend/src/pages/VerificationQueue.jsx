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

const ReportRow = ({ report, onVerify, onDiscard, verifying }) => {
  const [expanded, setExpanded] = useState(false);
  const ai = report.ai_prediction || {};
  const ft = ai.fasttext || {};
  const db = ai.distilbert || {};

  return (
    <div className={`bg-white border transition-colors ${expanded ? 'border-gray-400' : 'border-gray-200 hover:border-gray-300'}`}>
      
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

      <div className="px-6 pb-4 flex items-start gap-3">
        <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mt-1">TARGET</span>
        <a href={report.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline break-all">
          {truncate(report.url, 120)}
        </a>
      </div>

      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/50">
          
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

          {report.page_text_preview && (
            <div className="mb-6">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest block mb-2">EXTRACTED CONTENT PREVIEW</span>
              <div className="bg-gray-100 p-3 font-mono text-[0.7rem] text-gray-700 whitespace-pre-wrap break-words border border-gray-200">
                {truncate(report.page_text_preview, 500)}
              </div>
            </div>
          )}

          {report.user_note && (
            <div className="mb-6 flex gap-2 text-sm text-gray-600">
              <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">USER NOTE:</span>
              <span className="italic">"{report.user_note}"</span>
            </div>
          )}

          {report.status === 'verified' && (
            <div className="text-[0.65rem] font-bold text-emerald-600 uppercase tracking-widest mb-2">
              VERIFIED AT: {new Date(report.verified_at).toISOString().replace('T', ' ').slice(0, 19)}
            </div>
          )}

          {report.status === 'pending' && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => onVerify(report.id, 'scam')}
                disabled={verifying === report.id}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
              >
                {verifying === report.id ? 'PROCESSING...' : 'MARK AS SCAM'}
              </button>
              <button
                onClick={() => onVerify(report.id, 'safe')}
                disabled={verifying === report.id}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
              >
                {verifying === report.id ? 'PROCESSING...' : 'MARK AS SAFE'}
              </button>
              <div className="flex-1"></div>
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
      const res = await fetch(`${ADMIN_API}/health`);
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
      
      setReports(prev => filter === 'pending' ? prev.filter(r => r.id !== reportId) : prev.map(r => r.id === reportId ? { ...r, ...data.report } : r));
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

  return (
    <div className="p-10 w-full font-sans text-gray-900 max-w-[1600px] mx-auto relative">
      
      {/* Toasts */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 font-mono text-[0.7rem] font-bold tracking-widest uppercase border ${t.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-900 text-white border-gray-800'}`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">VERIFICATION QUEUE</h1>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Human-in-the-loop AI model retraining pipeline</p>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => { setLoading(true); fetchReports(filter); fetchHealth(); }} className="text-xs font-bold text-gray-400 hover:text-gray-900 uppercase tracking-widest transition-colors">
            {loading ? 'SYNCING...' : 'SYNC DATA'}
          </button>
          <button onClick={() => window.open(`${ADMIN_API}/api/export`, '_blank')} className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest transition-colors">
            EXPORT DATASET ({csvRows})
          </button>
        </div>
      </div>

      {serverUp === false && (
        <div className="mb-8 p-3 bg-rose-50 border border-rose-200 text-[0.7rem] font-bold tracking-widest uppercase text-rose-700">
          API OFFLINE: START SERVER USING `python api_server_report.py`
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 mb-8">
        {[
          { key: 'pending',  label: 'PENDING', count: stats.pending },
          { key: 'verified', label: 'VERIFIED', count: stats.verified },
          { key: 'all',      label: 'ALL',   count: stats.pending + stats.verified },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setFilter(t.key); setLoading(true); }}
            className={`text-[0.7rem] font-bold uppercase tracking-widest transition-colors pb-1 border-b-2 ${filter === t.key ? 'text-gray-900 border-gray-900' : 'text-gray-400 border-transparent hover:text-gray-700'}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Content */}
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
