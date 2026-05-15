import React, { useEffect, useState } from 'react';
import useScanStore from '../../store/scanStore';
import './Header.css';

const PAGE_TITLES = {
  dashboard: { title: 'Tổng Quan',          sub: 'Giám sát hệ thống bảo mật' },
  scanner:   { title: 'Kiểm Tra Nội Dung',  sub: 'Pipeline WAF → FastText → DistilBERT' },
  history:   { title: 'Lịch Sử Sự Kiện',   sub: 'Nhật ký quét và cảnh báo WAF' },
};

const Header = ({ activePage, onRefreshServers }) => {
  const { wafOnline, aiOnline, stats } = useScanStore();
  const [ts, setTs] = useState('');

  useEffect(() => {
    const tick = () => setTs(new Date().toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const overall = wafOnline && aiOnline;
  const chipCls = overall ? 'chip--online' : wafOnline === null ? 'chip--checking' : 'chip--offline';
  const chipLabel = overall ? 'Hệ thống ổn định' : wafOnline === null ? 'Đang kiểm tra…' : 'Dịch vụ gián đoạn';
  const { title, sub } = PAGE_TITLES[activePage] || PAGE_TITLES.dashboard;

  const blockRate = stats.total > 0
    ? Math.round(((stats.blockedWAF + stats.blockedAI) / stats.total) * 100)
    : 0;

  return (
    <header className="header" id="main-header">
      <div className="header__left">
        <h1 className="header__title">{title}</h1>
        <div className="header__sep" />
        <span className="header__subtitle">{sub}</span>
      </div>

      <div className="header__right">
        <div className="header__stats">
          <div className="hstat">
            <span className="hstat__num">{stats.total}</span>
            <span className="hstat__label">Tổng quét</span>
          </div>
          <div className="hstat hstat--danger">
            <span className="hstat__num">{stats.blockedWAF}</span>
            <span className="hstat__label">WAF chặn</span>
          </div>
          <div className="hstat hstat--warn">
            <span className="hstat__num">{stats.blockedAI}</span>
            <span className="hstat__label">AI chặn</span>
          </div>
          <div className="hstat hstat--safe">
            <span className="hstat__num">{stats.safe}</span>
            <span className="hstat__label">An toàn</span>
          </div>
          <div className={`hstat ${blockRate > 50 ? 'hstat--danger' : 'hstat--blue'}`}>
            <span className="hstat__num">{blockRate}%</span>
            <span className="hstat__label">Tỷ lệ chặn</span>
          </div>
        </div>

        <button
          id="header-status-btn"
          className={`header__status-chip ${chipCls}`}
          onClick={onRefreshServers}
          title="Click để kiểm tra lại"
        >
          <span className="chip__dot" />
          <span>{chipLabel}</span>
        </button>

        <span className="header__ts">{ts}</span>
      </div>
    </header>
  );
};

export default Header;
