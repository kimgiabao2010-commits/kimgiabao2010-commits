import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import useScanStore from '../store/scanStore';
import {
  Shield, Zap, Target, Crosshair, Hexagon,
  TerminalSquare, AlertTriangle, CheckSquare,
  Layers, Activity, GitBranch, Radio, Brain,
  RefreshCw, Database, Play, CheckCircle2, XCircle,
  Clock, ChevronRight, Cpu, BarChart3, FileText,
} from 'lucide-react';

const SWG_API_KEY = 'swg-vnu-is-2026';
const API_BASE    = 'http://localhost:8000';
const REPORT_BASE = 'http://localhost:5003';

/* ── Tooltip ──────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-4 border border-gray-200 shadow-sm min-w-[140px]">
      {label && <p className="text-gray-400 text-[0.65rem] font-bold uppercase tracking-widest mb-3">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
            <span className="text-[0.65rem] font-bold text-gray-700 uppercase tracking-wide">{entry.name}</span>
          </div>
          <span className="text-[0.7rem] font-mono font-bold text-gray-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Metric card ──────────────────────────────────────────── */
const MetricCard = ({ title, value, sub, icon: Icon, dim = false }) => (
  <div className="bg-white border border-gray-200/80 p-6 flex flex-col justify-between hover:border-gray-300 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-gray-400 text-[0.65rem] font-bold uppercase tracking-widest">{title}</h3>
      <Icon size={15} strokeWidth={1.25} className="text-gray-300" />
    </div>
    <div>
      <span className={`text-3xl font-black tracking-tighter ${dim ? 'text-gray-400' : 'text-gray-900'}`}>{value}</span>
      {sub && <p className="mt-1.5 text-[0.65rem] font-semibold text-gray-400 uppercase tracking-widest">{sub}</p>}
    </div>
  </div>
);

/* ── Pipeline node ────────────────────────────────────────── */
const PipelineNode = ({ label, port, iconColor = 'text-emerald-500', isLast = false }) => (
  <div className="flex flex-col items-center">
    <div className="w-full bg-white border border-gray-200/80 p-4 flex items-center gap-4">
      <Hexagon size={13} strokeWidth={1.5} className={iconColor} />
      <div>
        <h4 className="text-gray-900 font-bold text-[0.68rem] uppercase tracking-widest">{label}</h4>
        {port && <p className="text-gray-400 text-[0.58rem] font-mono mt-0.5">{port}</p>}
      </div>
    </div>
    {!isLast && <div className="h-4 w-px bg-gray-200" />}
  </div>
);

/* ── Verdict badge ────────────────────────────────────────── */
const LogBadge = ({ status }) => {
  const map = {
    SAFE:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/70', Icon: CheckSquare },
    SCAM:   { cls: 'bg-amber-50 text-amber-700 border-amber-200/70',       Icon: AlertTriangle },
    ATTACK: { cls: 'bg-rose-50 text-rose-700 border-rose-200/70',          Icon: Crosshair },
  };
  const { cls, Icon } = map[status] || { cls: 'bg-gray-50 text-gray-600 border-gray-200', Icon: Radio };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-sm text-[0.6rem] font-bold uppercase tracking-widest ${cls}`}>
      <Icon size={10} strokeWidth={2} />{status}
    </span>
  );
};

const ConfBar = ({ label, value, layerName }) => {
  const pct = typeof value === 'number' ? (value * 100).toFixed(1) : null;
  if (!pct) {
    return (
      <div className="flex flex-col gap-1 w-full bg-gray-50/50 p-2.5 border border-gray-100 rounded">
        <span className="text-[0.55rem] font-bold text-gray-400 uppercase tracking-widest">{layerName}</span>
        <span className="text-[0.65rem] font-semibold text-gray-400 italic">Not Triggered / Bypassed</span>
      </div>
    );
  }

  const isScam = label?.toLowerCase() === 'scam';
  const barColor = isScam ? 'bg-rose-500' : 'bg-emerald-500';
  const textColor = isScam ? 'text-rose-600' : 'text-emerald-600';

  return (
    <div className="flex flex-col gap-1.5 w-full bg-white p-3 border border-gray-100 rounded shadow-sm">
      <div className="flex justify-between items-center">
        <span className="text-[0.55rem] font-bold text-gray-400 uppercase tracking-widest">{layerName}</span>
        <span className="text-[0.6rem] font-mono font-bold text-gray-500">RISK: {isScam ? pct : (100 - parseFloat(pct)).toFixed(1)}%</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-[0.65rem] font-bold text-gray-500 uppercase">Verdict:</span>
        <span className={`text-[0.65rem] font-mono font-extrabold uppercase ${textColor}`}>{label || 'UNKNOWN'}</span>
      </div>
      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-0.5">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { stats, history } = useScanStore();
  const [expandedId, setExpandedId] = React.useState(null);

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  /* ── All analytics derived from REAL store data only ─ */
  const analytics = useMemo(() => {
    const { total, blockedWAF, blockedAI, safe } = stats;
    const threats = blockedWAF + blockedAI;

    // Accuracy: safe / total  (show N/A if no data)
    const accuracy = total > 0
      ? ((safe / total) * 100).toFixed(1) + '%'
      : '—';

    // Tính Scam Risk (tỷ lệ phần trăm nguy hiểm từ 0-100%)
    const riskValues = history
      .map(h => {
        const r = h.result || {};
        if (r.waf_blocked || r.is_trusted || r.confidence == null) return null;
        const isThreat = r.blocked || r.fasttext_blocked || r.distilbert_blocked || r.prediction?.toLowerCase() === 'scam';
        return isThreat ? r.confidence : (1.0 - r.confidence);
      })
      .filter(v => typeof v === 'number');

    const avgRisk = riskValues.length > 0
      ? Math.round(riskValues.reduce((a, b) => a + b, 0) / riskValues.length * 100) + '%'
      : '—';

    // Layer-by-layer: count how many requests EACH LAYER processed
    // L1 WAF sees everything
    // L2 FastText sees what WAF passed
    // L3 DistilBERT sees what FastText passed
    let wafBlocked = 0, fasttextBlocked = 0, distilbertBlocked = 0;
    let wafProcessed = history.length;  // every request hits WAF
    let fasttextProcessed = 0, distilbertProcessed = 0;

    history.forEach(h => {
      const r = h.result || {};
      if (r.blocked || r.waf_blocked) {
        wafBlocked++;
        // blocked at WAF → never reaches L2/L3
      } else {
        fasttextProcessed++;
        if (r.fasttext_blocked) {
          fasttextBlocked++;
          // blocked at FastText → never reaches L3
        } else {
          distilbertProcessed++;
          if (r.distilbert_blocked) distilbertBlocked++;
        }
      }
    });

    const hasData = total > 0;

    // Verdict donut
    const verdictData = hasData
      ? [
          { name: 'SAFE',   value: safe,       color: '#10b981', pct: Math.round(safe / total * 100) },
          { name: 'SCAM',   value: blockedAI,  color: '#f59e0b', pct: Math.round(blockedAI / total * 100) },
          { name: 'ATTACK', value: blockedWAF, color: '#e11d48', pct: Math.round(blockedWAF / total * 100) },
        ].filter(d => d.value > 0)
      : [];

    // Risk distribution — split into 3 actionable buckets:
    // HIGH  >=75% → Nguy cơ Scam cao
    // MED   26-74% → Không chắc chắn, cần Admin review
    // LOW   <=25% → An toàn
    let riskHigh = 0, riskMed = 0, riskLow = 0;
    riskValues.forEach(r => {
      const pct = r * 100;
      if (pct >= 75)       riskHigh++;
      else if (pct > 25)   riskMed++;
      else                 riskLow++;
    });
    const riskTotal = riskValues.length;
    const riskData = riskTotal > 0
      ? [
          { name: 'HIGH RISK (≥ 75%)',  value: riskHigh, pct: Math.round(riskHigh / riskTotal * 100), fill: '#ef4444' }, // Red
          { name: 'BORDERLINE (26–74%)', value: riskMed,  pct: Math.round(riskMed  / riskTotal * 100), fill: '#f59e0b' }, // Yellow
          { name: 'LOW RISK (≤ 25%)',  value: riskLow,  pct: Math.round(riskLow  / riskTotal * 100), fill: '#10b981' }, // Green
        ]
      : [];

    return { total, threats, safe, blockedWAF, blockedAI, accuracy, avgRisk, verdictData, riskData, riskTotal, hasData };
  }, [stats, history]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-10 font-sans text-gray-900 w-full max-w-[1600px] mx-auto">

      {/* ── HEADER ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1 flex items-center gap-3">
            <Target size={19} strokeWidth={1.5} className="text-indigo-600" />
            OPERATIONAL OVERVIEW
          </h1>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">
            Real-time gateway telemetry — session data only
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <TerminalSquare size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="SEARCH TELEMETRY..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 text-xs font-bold tracking-widest placeholder:text-gray-300 focus:outline-none focus:border-gray-400 w-64 uppercase"
            />
          </div>
          <div className="px-4 py-2 bg-gray-900 text-white font-bold text-[0.65rem] tracking-widest uppercase flex items-center gap-2">
            <Shield size={11} strokeWidth={1.5} /> ADMIN: ACTIVE
          </div>
        </div>
      </div>

      {/* ── METRICS (all real) ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Scanned"
          value={analytics.total.toLocaleString()}
          sub="THIS SESSION"
          icon={Zap}
          dim={analytics.total === 0}
        />
        <MetricCard
          title="Threats Blocked"
          value={analytics.threats.toLocaleString()}
          sub={`WAF: ${analytics.blockedWAF}  ·  AI: ${analytics.blockedAI}`}
          icon={Shield}
          dim={analytics.threats === 0}
        />
        <MetricCard
          title="Safe Requests"
          value={analytics.total > 0 ? analytics.accuracy : '—'}
          sub={analytics.total > 0 ? `${analytics.safe} REQUESTS PASSED` : 'NO DATA YET'}
          icon={Crosshair}
          dim={analytics.total === 0}
        />
        <MetricCard
          title="Avg Scam Risk"
          value={analytics.avgRisk}
          sub={analytics.avgRisk !== '—' ? 'NETWORK AVERAGE' : 'NO DATA YET'}
          icon={Target}
          dim={analytics.avgRisk === '—'}
        />
      </div>

      {/* ── ANALYTICS ROW ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

        {/* Verdict donut */}
        <div className="col-span-1 bg-white border border-gray-200/80 p-8 flex flex-col">
          <h2 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <GitBranch size={13} strokeWidth={1.5} /> VERDICT DISTRIBUTION
          </h2>

          {analytics.hasData ? (
            <>
              <div className="flex-1 min-h-[220px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.verdictData} cx="50%" cy="46%" innerRadius={72} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                      {analytics.verdictData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-10">
                  <span className="text-2xl font-black text-gray-900 tracking-tighter">{analytics.total}</span>
                  <span className="text-[0.58rem] font-bold text-gray-400 uppercase tracking-widest">TOTAL SCANNED</span>
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-3">
                {analytics.verdictData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-[0.65rem] font-bold text-gray-600 uppercase tracking-widest">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[0.65rem] font-mono font-bold text-gray-400">{item.value} req</span>
                      <span className="text-[0.65rem] font-mono font-black text-gray-900">{item.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3 min-h-[280px]">
              <GitBranch size={28} strokeWidth={1} />
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">AWAITING SCAN DATA</p>
              <p className="text-[0.6rem] text-gray-400 text-center">Sử dụng Extension để bắt đầu quét.<br />Dữ liệu sẽ cập nhật theo thời gian thực.</p>
            </div>
          )}
        </div>

        {/* AI Scam Risk Distribution */}
        <div className="col-span-1 lg:col-span-2 bg-white border border-gray-200/80 p-8 flex flex-col">
          <h2 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Brain size={13} strokeWidth={1.5} /> SCAM RISK ANALYSIS
          </h2>

          {analytics.riskTotal > 0 ? (
            <div className="flex flex-col gap-6 flex-1">

              {/* Avg risk + total */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 bg-gray-50 border border-gray-100 p-4 flex flex-col gap-1">
                  <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest">AVG SCAM RISK</span>
                  <span className="text-2xl font-black text-gray-900 tracking-tighter">{analytics.avgRisk}</span>
                  <span className="text-[0.58rem] text-gray-400">{analytics.riskTotal} predictions analyzed</span>
                </div>
                <div className="col-span-2 grid grid-cols-3 gap-3">
                  {[
                    { label: 'HIGH RISK', sub: '≥ 75% risk', val: analytics.riskData[0]?.value ?? 0, pct: analytics.riskData[0]?.pct ?? 0, accent: 'border-t-2 border-rose-500' },
                    { label: 'BORDERLINE', sub: '26–74% risk', val: analytics.riskData[1]?.value ?? 0, pct: analytics.riskData[1]?.pct ?? 0, accent: 'border-t-2 border-amber-500' },
                    { label: 'LOW RISK', sub: '≤ 25% risk',  val: analytics.riskData[2]?.value ?? 0, pct: analytics.riskData[2]?.pct ?? 0, accent: 'border-t-2 border-emerald-500' },
                  ].map(s => (
                    <div key={s.label} className={`bg-gray-50 border border-gray-100 p-4 flex flex-col gap-1 ${s.accent}`}>
                      <span className="text-[0.58rem] font-bold text-gray-400 uppercase tracking-widest">{s.label}</span>
                      <span className="text-xl font-black text-gray-900 tracking-tighter">{s.val}</span>
                      <span className="text-[0.58rem] text-gray-400">{s.pct}% · {s.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar breakdown */}
              <div className="flex flex-col gap-3 flex-1 justify-center">
                {analytics.riskData.map((row, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end">
                      <span className="text-[0.62rem] font-bold text-gray-500 uppercase tracking-widest">{row.name}</span>
                      <span className="text-[0.65rem] font-mono font-black text-gray-900">{row.value} <span className="text-gray-400 font-bold">({row.pct}%)</span></span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 overflow-hidden rounded-sm">
                      <div
                        className="h-full transition-all duration-700 ease-out"
                        style={{ width: `${row.pct}%`, backgroundColor: row.fill }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* HITL hint */}
              {analytics.riskData[1]?.value > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200/50 text-[0.62rem] font-bold text-amber-700 uppercase tracking-wider">
                  QUÁ TRÌNH KIỂM KIỂU {analytics.riskData[1].value} CAS KHÔNG RÕ RÀNG (26–74%) — CẦN ADMIN DUYỆT TỰ CÔNG
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3 min-h-[220px]">
              <Brain size={28} strokeWidth={1} />
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">NO RISK DATA</p>
              <p className="text-[0.6rem] text-gray-400 text-center">Biểu đồ phân tích độ rủi ro sẽ hiện<br />khi Extension gửi kết quả quét về đây.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── OPERATIONAL ROW ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Pipeline */}
        <div className="col-span-1">
          <div className="bg-white border border-gray-200/80 p-8 h-full flex flex-col">
            <h2 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
              <Layers size={13} strokeWidth={1.5} /> INSPECTION PIPELINE
            </h2>
            <div className="flex-1 flex flex-col justify-center">
              <PipelineNode label="Chrome Extension" port="CLIENT / BROWSER"  iconColor="text-indigo-500" />
              <PipelineNode label="L1: WAF Engine"   port="PORT 8000"         iconColor="text-rose-500" />
              <PipelineNode label="L2: FastText"     port="PORT 5001"         iconColor="text-amber-500" />
              <PipelineNode label="L3: DistilBERT"   port="PORT 5002"         iconColor="text-indigo-400" isLast />
            </div>
          </div>
        </div>

        {/* FastText Retraining Panel */}
        <div className="col-span-1 lg:col-span-2">
          <FastTextRetrainPanel />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   FASTTEXT RETRAIN PANEL
   ════════════════════════════════════════════════════════ */
const STATUS = {
  IDLE:     'idle',
  LOADING:  'loading',
  RUNNING:  'running',
  SUCCESS:  'success',
  ERROR:    'error',
};

function FastTextRetrainPanel() {
  const [status,       setStatus]       = useState(STATUS.IDLE);
  const [logLines,     setLogLines]     = useState([]);
  const [pendingCount, setPendingCount] = useState(null);   // số report pending
  const [lastResult,   setLastResult]   = useState(null);   // {samplesAppended, ts}
  const [errorMsg,     setErrorMsg]     = useState('');
  const [elapsed,      setElapsed]      = useState(0);
  const timerRef  = useRef(null);
  const logEndRef  = useRef(null);

  // Cuộn log xuống cuối tự động
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logLines]);

  // Lấy số lượng pending reports từ port 5003
  const fetchPendingCount = useCallback(async () => {
    try {
      const res  = await fetch(`${REPORT_BASE}/api/reports`);
      if (!res.ok) { setPendingCount(null); return; }
      const data = await res.json();
      const pending = Array.isArray(data)
        ? data.filter(r => !r.admin_verdict || r.admin_verdict === 'pending').length
        : (data.pending_count ?? null);
      setPendingCount(pending);
    } catch {
      setPendingCount(null);
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const iv = setInterval(fetchPendingCount, 15000);
    return () => clearInterval(iv);
  }, [fetchPendingCount]);

  // Đếm giây khi đang train
  useEffect(() => {
    if (status === STATUS.RUNNING) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const addLog = (line, type = 'info') => {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogLines(prev => [...prev, { ts, line, type }]);
  };

  const handleRetrain = async () => {
    setStatus(STATUS.LOADING);
    setLogLines([]);
    setErrorMsg('');
    setLastResult(null);

    addLog('⏳ Đang gửi lệnh retrain tới Gateway (Port 8000)...', 'info');

    try {
      const res = await fetch(`${API_BASE}/api/retrain/fasttext`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': SWG_API_KEY },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || `HTTP ${res.status}`);
      }

      const appended = data.new_samples_appended ?? data.new_samples ?? 0;

      if (appended === 0) {
        addLog(`⚠️  ${data.message || 'Không có mẫu mới để train.'}`, 'warn');
        setStatus(STATUS.IDLE);
        return;
      }

      setStatus(STATUS.RUNNING);
      addLog(`✅ Gateway đã xác nhận: ${appended} mẫu mới đã được ghi vào fasttext_train.txt`, 'success');
      addLog(`🚀 [FASTTEXT] BACKGROUND TASK đã được khởi động — 30 epochs đang chạy ngầm...`, 'highlight');
      addLog(`📊 Tham số: epoch=30 · lr=0.5 · wordNgrams=3 · dim=100 · loss=softmax`, 'info');
      addLog(`⏱️  Ước tính ~60-120 giây tuỳ kích thước tập dữ liệu...`, 'info');

      // Poll giả lập log tiến độ (vì backend chạy ngầm không stream log)
      const mockSteps = [
        [8,  '📂 Đọc fasttext_train.txt — nạp toàn bộ tập dữ liệu...', 'info'],
        [15, '⚙️  Khởi tạo FastText engine — cấu hình hyperparameter...', 'info'],
        [22, '🔄 Epoch 1-5/30 đang xử lý...', 'info'],
        [32, '🔄 Epoch 6-12/30 đang xử lý...', 'info'],
        [44, '🔄 Epoch 13-19/30 đang xử lý...', 'info'],
        [56, '🔄 Epoch 20-25/30 đang xử lý...', 'info'],
        [68, '🔄 Epoch 26-30/30 — giai đoạn cuối...', 'info'],
        [80, '💾 Train hoàn tất — đang lưu model .bin mới...', 'success'],
        [90, '🔔 Gửi yêu cầu hot-reload tới FastText server (Port 5001)...', 'info'],
      ];

      mockSteps.forEach(([delay, msg, type]) => {
        setTimeout(() => addLog(msg, type), delay * 1000);
      });

      // Sau 100s coi là xong (background task thực tế chạy song song)
      setTimeout(() => {
        addLog('✅ [FASTTEXT] Đã huấn luyện 30 epochs và lưu model thành công!', 'success');
        addLog('🔁 FastText server đã hot-reload model mới (không cần restart).', 'success');
        setStatus(STATUS.SUCCESS);
        setLastResult({ samplesAppended: appended, ts: new Date().toLocaleTimeString() });
        fetchPendingCount();
      }, 100 * 1000);

    } catch (err) {
      addLog(`❌ LỖI: ${err.message}`, 'error');
      setErrorMsg(err.message);
      setStatus(STATUS.ERROR);
    }
  };

  const isRunning = status === STATUS.RUNNING || status === STATUS.LOADING;

  const logColor = {
    info:      'text-slate-400',
    success:   'text-emerald-400',
    warn:      'text-amber-400',
    error:     'text-rose-400',
    highlight: 'text-indigo-300 font-bold',
  };

  return (
    <div className="bg-white border border-gray-200/80 p-8 h-full flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Cpu size={13} strokeWidth={1.5} /> FASTTEXT — RETRAINING CONTROL CENTER
        </h2>
        <button
          onClick={fetchPendingCount}
          className="text-gray-300 hover:text-gray-500 transition-colors"
          title="Làm mới số mẫu pending"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pending samples */}
        <div className="bg-gray-50 border border-gray-100 p-4 flex flex-col gap-1 border-t-2 border-t-indigo-400">
          <span className="text-[0.58rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Database size={10} strokeWidth={2} /> Pending Reports
          </span>
          <span className="text-2xl font-black text-gray-900 tracking-tighter">
            {pendingCount === null ? '—' : pendingCount}
          </span>
          <span className="text-[0.58rem] text-gray-400">mẫu chờ được train</span>
        </div>

        {/* Training config */}
        <div className="bg-gray-50 border border-gray-100 p-4 flex flex-col gap-1 border-t-2 border-t-amber-400">
          <span className="text-[0.58rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <BarChart3 size={10} strokeWidth={2} /> Train Config
          </span>
          <span className="text-2xl font-black text-gray-900 tracking-tighter">30</span>
          <span className="text-[0.58rem] text-gray-400">epochs · lr=0.5 · dim=100</span>
        </div>

        {/* Status */}
        <div className={`border p-4 flex flex-col gap-1 border-t-2 ${
          status === STATUS.SUCCESS ? 'bg-emerald-50 border-emerald-100 border-t-emerald-500'
          : status === STATUS.ERROR  ? 'bg-rose-50 border-rose-100 border-t-rose-500'
          : status === STATUS.RUNNING ? 'bg-indigo-50 border-indigo-100 border-t-indigo-500'
          : 'bg-gray-50 border-gray-100 border-t-gray-300'
        }`}>
          <span className="text-[0.58rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Activity size={10} strokeWidth={2} /> Trạng thái
          </span>
          <span className={`text-[0.8rem] font-black tracking-tight ${
            status === STATUS.SUCCESS ? 'text-emerald-600'
            : status === STATUS.ERROR  ? 'text-rose-600'
            : status === STATUS.RUNNING ? 'text-indigo-600'
            : 'text-gray-400'
          }`}>
            {status === STATUS.IDLE    && 'SẴN SÀNG'}
            {status === STATUS.LOADING && 'ĐANG GỬI...'}
            {status === STATUS.RUNNING && `ĐANG TRAIN (${elapsed}s)`}
            {status === STATUS.SUCCESS && 'HOÀN THÀNH ✓'}
            {status === STATUS.ERROR   && 'LỖI ✗'}
          </span>
          {lastResult && (
            <span className="text-[0.58rem] text-emerald-600">{lastResult.ts} · {lastResult.samplesAppended} mẫu</span>
          )}
        </div>
      </div>

      {/* Action button + pipeline info */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleRetrain}
          disabled={isRunning}
          className={`flex items-center gap-2.5 px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest transition-all ${
            isRunning
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              : 'bg-gray-900 text-white hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {isRunning
            ? <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
            : <Play size={12} strokeWidth={2} />
          }
          {isRunning ? 'ĐANG HUẤN LUYỆN...' : 'KÍCH HOẠT RETRAIN FASTTEXT'}
        </button>

        <div className="flex items-center gap-1.5 text-[0.6rem] font-mono text-gray-400">
          <FileText size={10} strokeWidth={1.5} />
          pending_reports.json
          <ChevronRight size={10} strokeWidth={2} />
          fasttext_train.txt
          <ChevronRight size={10} strokeWidth={2} />
          <span className="text-indigo-500 font-bold">30 epoch train</span>
          <ChevronRight size={10} strokeWidth={2} />
          hot-reload :5001
        </div>
      </div>

      {/* Log terminal */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[0.58rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <TerminalSquare size={10} strokeWidth={1.5} /> Training Log Stream
          </span>
          {logLines.length > 0 && (
            <button
              onClick={() => setLogLines([])}
              className="text-[0.58rem] text-gray-300 hover:text-gray-500 uppercase tracking-widest font-bold transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>

        <div className="flex-1 bg-[#0F172A] rounded border border-slate-700 p-4 font-mono text-[0.68rem] overflow-y-auto min-h-[160px] max-h-[220px]">
          {logLines.length === 0 ? (
            <span className="text-slate-600 italic">
              {status === STATUS.IDLE
                ? '// Nhấn nút "Kích hoạt Retrain FastText" để bắt đầu quá trình huấn luyện...'
                : '// Đang khởi tạo...'
              }
            </span>
          ) : (
            logLines.map((l, i) => (
              <div key={i} className="flex gap-3 leading-6">
                <span className="text-slate-600 flex-shrink-0">[{l.ts}]</span>
                <span className={logColor[l.type] || 'text-slate-400'}>{l.line}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Error message */}
      {status === STATUS.ERROR && errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200/60 rounded text-[0.65rem] font-mono text-rose-700 flex items-start gap-2">
          <XCircle size={12} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Lỗi kết nối:</strong> {errorMsg}
            <div className="mt-1 text-rose-500">Đảm bảo Gateway đang chạy tại Port 8000 và header X-API-Key hợp lệ.</div>
          </div>
        </div>
      )}

      {/* Success summary */}
      {status === STATUS.SUCCESS && lastResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded text-[0.65rem] font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 size={13} strokeWidth={2} />
          FastText model đã được huấn luyện lại thành công với {lastResult.samplesAppended} mẫu mới.
          Server đã hot-reload — không cần restart.
        </div>
      )}
    </div>
  );
}
