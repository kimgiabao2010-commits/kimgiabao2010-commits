import React, { useState } from 'react';
import { formatDateTime, truncate, getAttackClass } from '../../utils/helpers';
import { LOGS_PER_PAGE } from '../../utils/constants';
import './LogDataGrid.css';

const FILTER_OPTIONS = [
  { value: 'all',          label: 'Tất cả' },
  { value: 'OWASP_SQLi',  label: 'SQLi' },
  { value: 'OWASP_XSS',   label: 'XSS' },
  { value: 'OWASP_CMDi',  label: 'CMDi' },
  { value: 'SUSPICIOUS_URL', label: 'URL' },
];

const LogDataGrid = ({ logs = [], onClear }) => {
  const [filter, setFilter] = useState('all');
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');

  const filtered = logs.filter(l => {
    const matchFilter = filter === 'all' || l.type === filter;
    const matchSearch = !search || l.payload?.toLowerCase().includes(search.toLowerCase()) ||
                        l.type?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / LOGS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE);

  const handleFilter = (val) => { setFilter(val); setPage(1); };

  return (
    <div className="log-grid" id="log-data-grid">
      {/* Toolbar */}
      <div className="log-grid__toolbar">
        <div className="log-grid__filters">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              id={`filter-${opt.value}`}
              className={`filter-pill ${filter === opt.value ? 'filter-pill--active' : ''}`}
              onClick={() => handleFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="log-grid__right">
          <input
            className="log-grid__search"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            id="log-search"
          />
          {onClear && (
            <button className="btn-ghost-sm" onClick={onClear} id="log-clear-btn">
              🗑 Xóa
            </button>
          )}
        </div>
      </div>

      {/* Header row */}
      <div className="log-grid__header">
        <div className="lgcol lgcol--time">Thời Gian</div>
        <div className="lgcol lgcol--layer">Layer</div>
        <div className="lgcol lgcol--type">Loại Tấn Công</div>
        <div className="lgcol lgcol--reason">Lý Do Chặn</div>
        <div className="lgcol lgcol--payload">Nội Dung</div>
        <div className="lgcol lgcol--status">Kết Quả</div>
      </div>

      {/* Rows */}
      <div className="log-grid__body">
        {paged.length === 0 ? (
          <div className="log-grid__empty">
            <span>🛡️</span>
            <p>Không tìm thấy bản ghi nào</p>
          </div>
        ) : paged.map((log, i) => (
          <div key={log.id || i} className="log-grid__row">
            <div className="lgcol lgcol--time">{formatDateTime(log.timestamp)}</div>
            <div className="lgcol lgcol--layer">
              <span className="layer-chip">{log.layer || 'WAF'}</span>
            </div>
            <div className="lgcol lgcol--type">
              <span className={`attack-badge attack-badge--${getAttackClass(log.type)}`}>
                {log.type || 'UNKNOWN'}
              </span>
            </div>
            <div className="lgcol lgcol--reason">{truncate(log.reason, 50)}</div>
            <div className="lgcol lgcol--payload">
              <code className="payload-code">{truncate(log.payload, 45)}</code>
            </div>
            <div className="lgcol lgcol--status">
              <span className={`status-chip status-chip--${log.status === 'BLOCKED' ? 'blocked' : 'pass'}`}>
                {log.status || 'BLOCKED'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="log-grid__pagination">
          <span className="pagination__info">
            {filtered.length} bản ghi • Trang {currentPage}/{totalPages}
          </span>
          <div className="pagination__btns">
            <button
              id="log-prev-btn"
              className="pagination__btn"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  className={`pagination__btn ${p === currentPage ? 'pagination__btn--active' : ''}`}
                  onClick={() => setPage(p)}
                  id={`log-page-${p}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              id="log-next-btn"
              className="pagination__btn"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogDataGrid;
