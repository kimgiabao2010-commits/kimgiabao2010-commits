import React from 'react';
import useScanStore from '../store/scanStore';
import LogDataGrid from '../components/security/LogDataGrid';
import ThreatBadge from '../components/security/ThreatBadge';
import { formatDateTime } from '../utils/helpers';
import './HistoryLogs.css';

const HistoryLogs = () => {
  const { history, wafEvents, clearHistory, clearWafEvents } = useScanStore();

  // Map history to log format for the grid
  const gridLogs = wafEvents; // WAF blocked events

  return (
    <div className="history-logs" id="history-logs-page">
      {/* Session scan history */}
      <div className="hl-section">
        <div className="hl-section__header">
          <div>
            <div className="hl-section__title">📋 Lịch Sử Phiên Này</div>
            <div className="hl-section__sub">Tất cả các lần quét kể từ khi mở app</div>
          </div>
          <button className="btn-ghost-sm" onClick={clearHistory} id="clear-history-btn">
            🗑 Xóa tất cả
          </button>
        </div>

        <div className="hl-card">
          {history.length === 0 ? (
            <div className="hl-empty">
              <span>📂</span>
              <p>Chưa có lịch sử. Hãy thử quét nội dung trong tab Scanner!</p>
            </div>
          ) : (
            <div className="hl-list">
              {history.map((h) => {
                const blockedByWAF = h.result?.blocked || h.result?.waf_blocked;
                const blockedByFT  = h.result?.fasttext_blocked;
                const dbRan        = h.result?.distilbert_blocked !== undefined;
                const blockedByDB  = h.result?.distilbert_blocked;

                let status = 'safe';
                if (blockedByWAF) {
                  status = 'blocked_waf';
                } else if (dbRan) {
                  status = blockedByDB ? 'blocked_distilbert' : 'safe';
                } else if (blockedByFT) {
                  status = 'blocked_fasttext';
                }

                const confidence = h.result?.confidence ?? h.result?.probability ?? null;

                return (
                  <div key={h.id} className="hl-row" id={`hist-${h.id}`}>
                    <div className="hl-row__left">
                      <ThreatBadge status={status} size="sm" />
                      <div className="hl-row__text">{h.text.slice(0, 90)}{h.text.length > 90 ? '…' : ''}</div>
                    </div>
                    <div className="hl-row__right">
                      {confidence !== null && (
                        <span className="hl-conf">
                          {Math.round(confidence * 100)}%
                        </span>
                      )}
                      <span className="hl-time">{formatDateTime(h.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* WAF Block Events grid */}
      <div className="hl-section">
        <div className="hl-section__header">
          <div>
            <div className="hl-section__title">🔥 Sự Kiện WAF Bị Chặn</div>
            <div className="hl-section__sub">Chi tiết các request bị WAF đánh chặn</div>
          </div>
        </div>

        <div className="hl-card hl-card--no-pad">
          <LogDataGrid logs={gridLogs} onClear={clearWafEvents} />
        </div>
      </div>
    </div>
  );
};

export default HistoryLogs;
