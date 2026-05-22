import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Tooltip,
} from 'recharts';
import useScanStore from '../store/scanStore';
import {
  Shield, Zap, Target, Crosshair, Hexagon,
  TerminalSquare, AlertTriangle, CheckSquare,
  Layers, Activity, GitBranch, Radio, Brain
} from 'lucide-react';

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

        {/* Live logs */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-white border border-gray-200/80 p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <TerminalSquare size={13} strokeWidth={1.5} /> LIVE INTERCEPT LOGS
              </h2>
              {history.length > 0 && (
                <span className="text-[0.6rem] font-mono font-bold text-gray-400">{history.length} RECORDS</span>
              )}
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[0.65rem] uppercase tracking-widest text-gray-400 font-bold">
                    <th className="pb-3 pr-4">Payload Snapshot</th>
                    <th className="pb-3 px-4 text-center">Layer</th>
                    <th className="pb-3 px-4 text-center">Risk Score</th>
                    <th className="pb-3 px-4 text-center">Verdict</th>
                    <th className="pb-3 pl-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.slice(0, 7).map((log, idx) => {
                    const r     = log.result || {};
                    const isThreat = r.blocked || r.waf_blocked || r.prediction?.toLowerCase() === 'scam' || r.prediction?.toLowerCase() === 'attack';
                    let layer = "UNKNOWN";
                    if (r.layer_info) {
                        layer = r.layer_info;
                    } else {
                        layer = r.waf_blocked ? 'WAF' : (r.distilbert_blocked !== undefined ? 'DISTILBERT' : 'FASTTEXT');
                    }
                    const status = isThreat ? (r.waf_blocked ? 'ATTACK' : 'SCAM') : 'SAFE';
                      
                    let confDisplay = '—';
                    if (r.waf_blocked) {
                        confDisplay = '100%';
                    } else if (r.is_trusted || layer === 'TRUSTED_CITATION' || layer === 'TRUSTED_DOMAIN') {
                        confDisplay = 'BYPASS';
                    } else if (r.confidence != null) {
                        // Tính Risk Score
                        const risk = isThreat ? Math.round(r.confidence * 100) : Math.round((1.0 - r.confidence) * 100);
                        confDisplay = `${risk}%`;
                    }

                    const isExpanded = expandedId === log.id;

                    // Extract model data
                    const ftData = r.fasttext || {};
                    const dbData = r.distilbert || {};
                    const patternEngine = r.pattern_engine || {};

                    const ftConf = ftData.confidence != null ? ftData.confidence : (ftData.probability != null ? ftData.probability : null);
                    const dbConf = dbData.confidence_score != null ? dbData.confidence_score / 100 : (dbData.confidence != null ? dbData.confidence : null);

                    return (
                      <React.Fragment key={log.id || idx}>
                        <tr 
                          onClick={() => toggleExpand(log.id)}
                          className={`hover:bg-gray-50/50 transition-colors cursor-pointer group ${isExpanded ? 'bg-gray-50/30' : ''}`}
                        >
                          <td className="py-3.5 pr-4 max-w-[220px]">
                            <span className="text-xs font-semibold text-gray-700 truncate block" title={log.text}>{log.text}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-[0.6rem] font-mono font-bold text-gray-400 tracking-widest">{layer}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-[0.65rem] font-mono font-bold text-gray-500">{confDisplay}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <LogBadge status={status} />
                          </td>
                          <td className="py-3.5 pl-4 text-right flex items-center justify-end gap-2.5">
                            <span className="text-[0.65rem] text-gray-400 font-mono font-bold">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-[0.6rem] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan="5" className="p-0 border-b border-gray-100 bg-[#FAFAFC]">
                              <div className="px-6 py-5 border-t border-gray-100 flex flex-col gap-4">
                                
                                {/* Side-by-side Layer bars */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <ConfBar 
                                    layerName="FastText Layer"
                                    label={ftData.prediction}
                                    value={ftConf}
                                  />
                                  <ConfBar 
                                    layerName="DistilBERT Layer"
                                    label={dbData.prediction}
                                    value={dbConf}
                                  />

                                  {/* Pattern Engine Box */}
                                  <div className="flex flex-col gap-1.5 w-full bg-white p-3 border border-gray-100 rounded shadow-sm">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[0.55rem] font-bold text-gray-400 uppercase tracking-widest">Rule-Based Patterns</span>
                                      <span className={`text-[0.6rem] font-mono font-bold ${patternEngine.is_scam ? 'text-rose-500' : 'text-gray-400'}`}>
                                        {patternEngine.risk_score || 0}/100 PTS
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                      <span className="text-[0.65rem] font-bold text-gray-500 uppercase">Status:</span>
                                      <span className={`text-[0.65rem] font-mono font-extrabold uppercase ${patternEngine.is_scam ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {patternEngine.is_scam ? 'SCAM FOUND' : 'CLEARED'}
                                      </span>
                                    </div>

                                    {patternEngine.matched_rules && patternEngine.matched_rules.length > 0 ? (
                                      <div className="mt-1 text-[0.6rem] font-mono text-rose-600 bg-rose-50/50 p-1.5 border border-rose-100 rounded leading-relaxed max-h-[60px] overflow-y-auto">
                                        {patternEngine.matched_rules.map((rule, ri) => (
                                          <div key={ri}>• {rule}</div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-[0.6rem] italic text-gray-400 p-1.5 bg-gray-50/30 rounded border border-gray-100 text-center">
                                        No threat signatures matched
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Extracted text preview block */}
                                <div>
                                  <span className="text-[0.55rem] font-bold text-gray-400 uppercase tracking-widest block mb-1">Extracted Payload Preview</span>
                                  <div className="bg-white p-3 font-mono text-[0.65rem] text-gray-600 whitespace-pre-wrap break-words border border-gray-150 rounded leading-relaxed max-h-[120px] overflow-y-auto">
                                    {log.text}
                                  </div>
                                </div>

                                {r.override_reason && (
                                  <div className="p-2.5 bg-amber-50 border border-amber-100 rounded text-[0.65rem] text-amber-800 font-mono">
                                    <strong>⚠️ Pipeline Override:</strong> Escaped detection overridden. Reason: {r.override_reason}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {history.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-14 text-center">
                        <Activity size={20} strokeWidth={1.25} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">WAITING FOR TELEMETRY...</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
