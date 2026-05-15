import React, { useEffect, useState } from 'react';
import useScanStore from '../../store/scanStore';
import './Sidebar.css';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '⊞', label: 'Tổng Quan' },
  { id: 'scanner',   icon: '🔍', label: 'Kiểm Tra Nội Dung' },
  { id: 'history',   icon: '📋', label: 'Lịch Sử Sự Kiện' },
  { id: 'verify',    icon: '🔬', label: 'Kiểm Định AI', highlight: true },
];

const LAYERS = [
  { tag: 'L1', label: 'WAF Engine',  color: '#f43f5e', bg: 'rgba(244,63,94,0.15)' },
  { tag: 'L2', label: 'FastText AI', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  { tag: 'L3', label: 'DistilBERT', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
];

const Sidebar = ({ activePage, onNavigate }) => {
  const { wafOnline, aiOnline, distilbertOnline, wafEvents } = useScanStore();
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const dot = (online) =>
    online === null ? 'dot--checking' : online ? 'dot--online' : 'dot--offline';
  const valColor = (online) =>
    online === null ? 'var(--amber)' : online ? 'var(--green)' : 'var(--red)';
  const val = (online) =>
    online === null ? 'Checking…' : online ? 'Online' : 'Offline';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z"
              fill="rgba(56,189,248,0.12)" stroke="#38bdf8" strokeWidth="1.5"/>
            <path d="M9 12l2 2 4-4" stroke="#38bdf8" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="sidebar__logo-text">
          <span className="logo-name">SWG<span className="logo-ai">Guard</span></span>
          <span className="logo-sub">AI Security Gateway v2.0</span>
        </div>
      </div>

      {/* Clock */}
      <div className="sidebar__time">
        <span className="sidebar__time-label">SYS TIME</span>
        <span>{time}</span>
      </div>

      {/* Nav */}
      <nav className="sidebar__nav">
        <span className="sidebar__section-label">Menu</span>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`sidebar__nav-item ${activePage === item.id ? 'sidebar__nav-item--active' : ''} ${item.highlight ? 'sidebar__nav-item--highlight' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.id === 'history' && wafEvents.length > 0 && (
              <span className="nav-badge">{wafEvents.length}</span>
            )}
          </button>
        ))}

        <div className="sidebar__divider" />
        <span className="sidebar__section-label">Lớp bảo vệ</span>

        {LAYERS.map(l => (
          <div key={l.label} className="sidebar__layer-item">
            <span className="layer-tag" style={{ background: l.bg, color: l.color }}>
              {l.tag}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{l.label}</span>
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="sidebar__status">
        <span className="sidebar__section-label" style={{ padding: '0 0 2px' }}>Trạng thái dịch vụ</span>
        <div className="status-row">
          <span className={`status-dot ${dot(wafOnline)}`} />
          <span className="status-name">WAF (port 8000)</span>
          <span className="status-val" style={{ color: valColor(wafOnline) }}>{val(wafOnline)}</span>
        </div>
        <div className="status-row">
          <span className={`status-dot ${dot(aiOnline)}`} />
          <span className="status-name">FastText (port 5001)</span>
          <span className="status-val" style={{ color: valColor(aiOnline) }}>{val(aiOnline)}</span>
        </div>
        <div className="status-row">
          <span className={`status-dot ${dot(distilbertOnline)}`} />
          <span className="status-name">DistilBERT (port 5002)</span>
          <span className="status-val" style={{ color: valColor(distilbertOnline) }}>{val(distilbertOnline)}</span>
        </div>
        <div className="status-row">
          <span className="status-dot dot--online" style={{ background: 'var(--purple)' }} />
          <span className="status-name">Report API (port 5003)</span>
          <span className="status-val" style={{ color: 'var(--purple)', fontSize: '0.68rem' }}>Human-in-Loop</span>
        </div>
      </div>

      <div className="sidebar__footer">
        <span>SWGGuard</span>
        <span>v2.0.0</span>
      </div>
    </aside>
  );
};

export default Sidebar;
