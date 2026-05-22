import React from 'react';
import useScanStore from '../store/scanStore';

const ThreatBadge = ({ status }) => {
  if (status === 'safe') {
    return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">AN TOÀN</span>;
  }
  if (status === 'blocked_waf') {
    return <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">WAF SCAM</span>;
  }
  if (status === 'blocked_distilbert') {
    return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">DISTILBERT SCAM</span>;
  }
  if (status === 'blocked_fasttext') {
    return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">FASTTEXT SCAM</span>;
  }
  return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">AI SCAM</span>;
};

// Elegant, context-aware progress bar component for ML layers
const ConfBar = ({ label, value, layerName, isScamVerdict }) => {
  const pct = typeof value === 'number' ? (value * 100).toFixed(1) : null;
  if (!pct) {
    return (
      <div className="flex flex-col gap-1 w-full bg-gray-50/50 p-3 border border-gray-100 rounded">
        <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest">{layerName}</span>
        <span className="text-xs font-semibold text-gray-400 italic">Not Triggered / Bypassed</span>
      </div>
    );
  }

  // If the label is Legit/Safe, color is green; if Scam/Phishing, color is red/rose.
  const isScam = label?.toLowerCase() === 'scam';
  const barColor = isScam ? 'bg-rose-500' : 'bg-emerald-500';
  const textColor = isScam ? 'text-rose-600' : 'text-emerald-600';

  return (
    <div className="flex flex-col gap-2 w-full bg-white p-4 border border-gray-100/80 shadow-sm rounded">
      <div className="flex justify-between items-center">
        <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest">{layerName}</span>
        <span className="text-[0.65rem] font-mono font-bold text-gray-500">{pct}% CONFIDENCE</span>
      </div>
      <div className="flex justify-between items-baseline mt-1">
        <span className="text-xs font-bold text-gray-700 uppercase">Verdict:</span>
        <span className={`text-xs font-mono font-extrabold uppercase ${textColor}`}>{label || 'UNKNOWN'}</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-1">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

const HistoryLogs = () => {
  const { history, wafEvents, clearHistory, clearWafEvents } = useScanStore();
  const [expandedId, setExpandedId] = React.useState(null);

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="p-10 w-full font-sans text-gray-900 max-w-[1600px] mx-auto">
      
      <div className="flex flex-col gap-14">
        
        {/* Lịch Sử Phiên Này */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-1">ANALYSIS LOG</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Real-time gateway telemetry stream</p>
            </div>
            {history.length > 0 && (
              <button 
                onClick={clearHistory}
                className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-rose-600 transition-colors"
              >
                PURGE DATA
              </button>
            )}
          </div>

          <div className="bg-white border border-gray-200/80 shadow-sm rounded-lg overflow-hidden">
            {history.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <p className="text-xs font-bold uppercase tracking-widest">NO TELEMETRY RECORDED</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50 text-[0.65rem] uppercase tracking-widest text-gray-500 font-bold">
                      <th className="py-3 px-6 w-32">Verdict</th>
                      <th className="py-3 px-6 w-32">Layer</th>
                      <th className="py-3 px-6">Payload Snapshot</th>
                      <th className="py-3 px-6 text-center w-32">Confidence</th>
                      <th className="py-3 px-6 text-right w-48">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((h) => {
                      const resData      = h.result || {};
                      const blockedByWAF = resData.blocked || resData.waf_blocked;
                      const blockedByFT  = resData.fasttext_blocked;
                      const blockedByDB  = resData.distilbert_blocked;
                      const isTrusted    = resData.is_trusted;
                      const isExpanded   = expandedId === h.id;

                      let status = 'safe';
                      if (blockedByWAF) status = 'blocked_waf';
                      else if (blockedByDB) status = 'blocked_distilbert';
                      else if (blockedByFT) status = 'blocked_fasttext';

                      // Layer label
                      let layerLabel = resData.layer_info || (blockedByWAF ? 'WAF' : (blockedByDB ? 'DistilBERT' : 'FastText'));

                      let confidence = resData.confidence ?? null;
                      if (status === 'blocked_waf') {
                        confidence = 1.0;
                      }

                      // ML Layer Data extraction
                      const ftData = resData.fasttext || {};
                      const dbData = resData.distilbert || {};
                      const patternEngine = resData.pattern_engine || {};

                      // Extract confidence scores nicely
                      const ftConf = ftData.confidence != null ? ftData.confidence : (ftData.probability != null ? ftData.probability : null);
                      const dbConf = dbData.confidence_score != null ? dbData.confidence_score / 100 : (dbData.confidence != null ? dbData.confidence : null);

                      return (
                        <React.Fragment key={h.id}>
                          <tr 
                            onClick={() => toggleExpand(h.id)}
                            className={`hover:bg-gray-50/50 transition-colors group cursor-pointer ${isExpanded ? 'bg-gray-50/30' : ''}`}
                          >
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              <ThreatBadge status={status} />
                            </td>
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              <span className="text-[0.6rem] font-mono font-bold text-gray-400 tracking-widest uppercase">{layerLabel}</span>
                            </td>
                            <td className="py-3.5 px-6 max-w-xl">
                              <span className="text-xs font-semibold text-gray-700 truncate block w-full" title={h.text}>
                                {h.text}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              {isTrusted ? (
                                <span className="text-[0.65rem] font-mono font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">BYPASS</span>
                              ) : confidence !== null ? (
                                <span className="text-[0.65rem] font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200/50">
                                  {(confidence * 100).toFixed(1)}%
                                </span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap flex items-center justify-end gap-3">
                              <span className="text-[0.7rem] font-mono font-semibold text-gray-400">
                                {new Date(h.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                              </span>
                              <span className="text-[0.65rem] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isExpanded ? 'COLLAPSE ▲' : 'DETAILS ▼'}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded sub-row rendering ML details */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="5" className="p-0 border-b border-gray-200">
                                <div className="bg-gray-50/50 px-8 py-6 border-t border-gray-100 flex flex-col gap-6">
                                  
                                  {/* ML Layers side-by-side details */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                    
                                    {/* Rule-Based Scam Pattern Engine status */}
                                    <div className="flex flex-col gap-2 w-full bg-white p-4 border border-gray-100/80 shadow-sm rounded">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-widest">Rule-Based Pattern Engine</span>
                                        <span className={`text-[0.65rem] font-mono font-bold ${patternEngine.is_scam ? 'text-rose-500' : 'text-gray-400'}`}>
                                          {patternEngine.risk_score || 0}/100 PTS
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-baseline mt-1">
                                        <span className="text-xs font-bold text-gray-700 uppercase">Status:</span>
                                        <span className={`text-xs font-mono font-extrabold uppercase ${patternEngine.is_scam ? 'text-rose-600' : 'text-emerald-600'}`}>
                                          {patternEngine.is_scam ? 'SCAM DETECTED' : 'CLEARED'}
                                        </span>
                                      </div>
                                      
                                      {patternEngine.matched_rules && patternEngine.matched_rules.length > 0 ? (
                                        <div className="mt-2 text-[0.65rem] font-mono text-rose-600 bg-rose-50/50 p-2 border border-rose-100 rounded leading-relaxed max-h-[80px] overflow-y-auto">
                                          {patternEngine.matched_rules.map((rule, ri) => (
                                            <div key={ri}>• {rule}</div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="mt-2 text-[0.65rem] italic text-gray-400 p-2 bg-gray-50/30 rounded border border-gray-100">
                                          No suspicious patterns matched
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Original content preview panel */}
                                  <div>
                                    <span className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest block mb-2">EXTRACTED CONTENT PREVIEW</span>
                                    <div className="bg-gray-100 p-4 font-mono text-[0.7rem] text-gray-700 whitespace-pre-wrap break-words border border-gray-200 rounded leading-relaxed shadow-inner">
                                      {h.text}
                                    </div>
                                  </div>

                                  {/* WAF Details if blocked */}
                                  {blockedByWAF && (
                                    <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded text-xs text-rose-700 font-mono">
                                      <strong>🛡️ WAF Intervention Event:</strong> Intercepted malicious request content containing potential vulnerabilities or flagged attack vectors. Rule details: {resData.detail || 'Generic signature match.'}
                                    </div>
                                  )}
                                  
                                  {resData.override_reason && (
                                    <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded text-xs text-amber-800 font-mono">
                                      <strong>⚠️ Threat Pipeline Override:</strong> Verdict escalated and overridden. Reason: {resData.override_reason}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sự Kiện WAF */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-1">L1 WAF INTERCEPTS</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Hard-blocked request payloads</p>
            </div>
            {wafEvents.length > 0 && (
              <button 
                onClick={clearWafEvents}
                className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-rose-600 transition-colors"
              >
                PURGE DATA
              </button>
            )}
          </div>

          <div className="bg-white border border-gray-200/80 shadow-sm">
            {wafEvents.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                <p className="text-xs font-bold uppercase tracking-widest">NO WAF EVENTS DETECTED</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50 text-[0.65rem] uppercase tracking-widest text-gray-500 font-bold">
                      <th className="py-3 px-6 w-48">Timestamp</th>
                      <th className="py-3 px-6 w-32">Rule Class</th>
                      <th className="py-3 px-6 w-48">Match Reason</th>
                      <th className="py-3 px-6">Raw Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {wafEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="py-3 px-6 whitespace-nowrap">
                          <span className="text-[0.7rem] font-mono font-semibold text-gray-400">
                            {new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                          </span>
                        </td>
                        <td className="py-3 px-6 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-gray-900 text-white rounded text-[0.65rem] font-bold tracking-widest uppercase">
                            {e.type}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <span className="text-xs font-semibold text-gray-600">{e.reason}</span>
                        </td>
                        <td className="py-3 px-6">
                          <div className="bg-gray-50 border border-gray-200 p-2 font-mono text-[0.65rem] text-rose-700 break-all">
                            {e.payload}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default HistoryLogs;
