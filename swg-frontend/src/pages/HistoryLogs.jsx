import React from 'react';
import useScanStore from '../store/scanStore';

const ThreatBadge = ({ status }) => {
  if (status === 'safe') {
    return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">AN TOÀN</span>;
  }
  if (status === 'blocked_waf') {
    return <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">WAF CHẶN</span>;
  }
  return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50 rounded text-[0.65rem] font-bold tracking-widest uppercase">AI CHẶN</span>;
};

const HistoryLogs = () => {
  const { history, wafEvents, clearHistory, clearWafEvents } = useScanStore();

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

          <div className="bg-white border border-gray-200/80 shadow-sm">
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
                      <th className="py-3 px-6">Payload Snapshot</th>
                      <th className="py-3 px-6 text-center w-32">Confidence</th>
                      <th className="py-3 px-6 text-right w-48">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((h) => {
                      const blockedByWAF = h.result?.blocked || h.result?.waf_blocked;
                      const blockedByFT  = h.result?.fasttext_blocked;
                      const dbRan        = h.result?.distilbert_blocked !== undefined;
                      const blockedByDB  = h.result?.distilbert_blocked;

                      let status = 'safe';
                      if (blockedByWAF) status = 'blocked_waf';
                      else if (dbRan) status = blockedByDB ? 'blocked_distilbert' : 'safe';
                      else if (blockedByFT) status = 'blocked_fasttext';

                      const confidence = h.result?.confidence ?? h.result?.probability ?? null;

                      return (
                        <tr key={h.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="py-3 px-6 whitespace-nowrap">
                            <ThreatBadge status={status} />
                          </td>
                          <td className="py-3 px-6 max-w-xl">
                            <span className="text-xs font-medium text-gray-700 truncate block w-full" title={h.text}>
                              {h.text}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-center">
                            {confidence !== null ? (
                              <span className="text-[0.65rem] font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                {(confidence * 100).toFixed(1)}%
                              </span>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-6 text-right whitespace-nowrap">
                            <span className="text-[0.7rem] font-mono font-semibold text-gray-400">
                              {new Date(h.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                            </span>
                          </td>
                        </tr>
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
