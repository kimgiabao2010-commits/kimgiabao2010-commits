import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import useScanStore from '../store/scanStore';
import ThreatBadge from '../components/security/ThreatBadge';
import { formatDateTime } from '../utils/helpers';
import './Dashboard.css';

const SiemTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="siem-tooltip">
      {label && <div className="siem-tooltip__label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="siem-tooltip__row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="siem-tooltip__val">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const Panel = ({ title, badge, children, className = '' }) => (
  <div className={`dash-panel ${className}`}>
    <div className="dash-panel__header">
      <span className="dash-panel__title">{title}</span>
      {badge && <span className="dash-panel__badge">{badge}</span>}
    </div>
    <div className="dash-panel__body">{children}</div>
  </div>
);

const KpiCard = ({ label, value, sub, color, icon }) => (
  <div className="kpi-card" style={{ '--kpi-color': color }}>
    <div className="kpi-card__top">
      <div className="kpi-card__icon">{icon}</div>
    </div>
    <div className="kpi-card__num">{value}</div>
    <div className="kpi-card__label">{label}</div>
    {sub && <div className="kpi-card__sub">{sub}</div>}
  </div>
);

const PIE_COLORS = ['#10b981', '#f43f5e', '#f59e0b'];

const Dashboard = () => {
  const { stats, history, wafEvents } = useScanStore();

  const blockRate = stats.total > 0
    ? Math.round(((stats.blockedWAF + stats.blockedAI) / stats.total) * 100)
    : 0;

  const pieData = [
    { name: 'An toàn',    value: stats.safe },
    { name: 'WAF chặn',   value: stats.blockedWAF },
    { name: 'AI chặn',    value: stats.blockedAI },
  ].filter(d => d.value > 0);

  const areaData = history.slice(0, 10).reverse().map((h, i) => {
    const isBlocked = h.result?.waf_blocked || h.result?.fasttext_blocked || h.result?.distilbert_blocked;
    return {
      t:       `#${i + 1}`,
      safe:    isBlocked ? 0 : 1,
      blocked: isBlocked ? 1 : 0,
    };
  });

  const recentEvents = wafEvents.slice(0, 6);

  const typeMap = {};
  wafEvents.forEach(e => { typeMap[e.type] = (typeMap[e.type] || 0) + 1; });
  const typeData = Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value])=>({name,value}));

  const attackTagClass = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('sql')) return 'sql';
    if (t.includes('xss')) return 'xss';
    if (t.includes('cmd')) return 'cmd';
    if (t.includes('url')) return 'url';
    return 'unk';
  };

  return (
    <div className="dashboard" id="dashboard-page">

      {/* KPIs */}
      <div className="dashboard__kpis">
        <KpiCard label="Tổng quét"    value={stats.total}      icon="🔍" color="var(--blue)"  />
        <KpiCard label="WAF chặn"     value={stats.blockedWAF} icon="🔥" color="var(--red)"   sub="Layer 1" />
        <KpiCard label="AI chặn"      value={stats.blockedAI}  icon="🧠" color="var(--amber)" sub="Layer 2" />
        <KpiCard label="An toàn"      value={stats.safe}       icon="✅" color="var(--green)" />
        <KpiCard label="Tỷ lệ chặn"  value={`${blockRate}%`}  icon="📊" color={blockRate > 50 ? 'var(--red)' : 'var(--blue)'} />
        <KpiCard label="Sự kiện WAF" value={wafEvents.length}  icon="🛡️" color="var(--blue)"  sub="Phiên này" />
      </div>

      {/* Grid */}
      <div className="dashboard__grid">

        {/* Timeline */}
        <Panel title="📈 Lịch sử quét" badge={`${history.length} lần quét`}>
          {areaData.length === 0 ? (
            <div className="dash-empty">Chưa có dữ liệu.<br/>Hãy thực hiện quét đầu tiên ở trang Kiểm Tra Nội Dung.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gSafe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gBlock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" />
                <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<SiemTooltip />} />
                <Area type="monotone" dataKey="safe"    name="An toàn"  stroke="#10b981" fill="url(#gSafe)"  strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
                <Area type="monotone" dataKey="blocked" name="Bị chặn"  stroke="#f43f5e" fill="url(#gBlock)" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Pie */}
        <Panel title="🥧 Phân bố kết quả" badge={`${stats.total} lần`}>
          {pieData.length === 0 ? (
            <div className="dash-empty">Chưa có dữ liệu</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<SiemTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-legend">
                {pieData.map((d, i) => (
                  <div key={d.name} className="pie-legend__row">
                    <span className="pie-legend__dot" style={{ background: PIE_COLORS[i] }} />
                    <span className="pie-legend__name">{d.name}</span>
                    <span className="pie-legend__val">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* Attack types */}
        <Panel title="⚡ Loại tấn công" badge={`${wafEvents.length} sự kiện`}>
          {typeData.length === 0 ? (
            <div className="dash-empty">Chưa có sự kiện WAF</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<SiemTooltip />} />
                <Bar dataKey="value" name="Số lần" fill="var(--red)" radius={[0,4,4,0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* WAF events table */}
        <Panel title="🚨 Sự kiện WAF gần đây" badge="Trực tiếp" className="panel--wide">
          {recentEvents.length === 0 ? (
            <div className="dash-empty">Chưa có sự kiện bị chặn trong phiên này.</div>
          ) : (
            <table className="event-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại tấn công</th>
                  <th>Layer</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((e, i) => (
                  <tr key={e.id || i}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{formatDateTime(e.timestamp)}</td>
                    <td><span className={`atk-tag atk-tag--${attackTagClass(e.type)}`}>{e.type || 'UNKNOWN'}</span></td>
                    <td style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>WAF L1</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(e.payload || '').slice(0, 50)}</td>
                    <td><span className="evt-status evt-status--blocked">Đã chặn</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Architecture */}
        <Panel title="🏗️ Kiến trúc bảo vệ" className="panel--wide">
          <div className="pipe-arch">
            {[
              { tag: 'Layer 1', name: 'WAF Engine',   tech: 'ModSecurity — Rule-based',   color: 'var(--red)',   port: '8000', tags: ['SQLi','XSS','CMDi','LFI','RFI','URL đen'] },
              { tag: 'Layer 2', name: 'FastText AI',  tech: 'N-gram Machine Learning',    color: 'var(--blue)',  port: '5001', tags: ['Phân loại lừa đảo','Xử lý OOV','Word Embeddings'] },
              { tag: 'Layer 3', name: 'DistilBERT',   tech: 'Transformer Fine-tuned',     color: 'var(--amber)', port: '5002',  tags: ['Phân tích ngữ nghĩa','BERT','Deep NLP'] },
            ].map((l, i, arr) => (
              <React.Fragment key={l.tag}>
                <div className="pipe-arch__block" style={{ '--c': l.color }}>
                  <div className="pipe-arch__tag">{l.tag}</div>
                  <div className="pipe-arch__body">
                    <div className="pipe-arch__name">{l.name}</div>
                    <div className="pipe-arch__tech">{l.tech}</div>
                    <div className="pipe-arch__port">PORT: {l.port}</div>
                    <div className="pipe-arch__tags">
                      {l.tags.map(t => <span key={t} className="pipe-arch__chip">{t}</span>)}
                    </div>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="pipe-arch__arrow">
                    <span>→</span>
                    <span className="pipe-arch__arrow-label">PASS</span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </Panel>
      </div>

      {/* Scan history */}
      <Panel title="📋 Lịch sử quét" badge={`${history.length} bản ghi`}>
        {history.length === 0 ? (
          <div className="dash-empty">Chưa có lịch sử. Hãy vào Kiểm Tra Nội Dung để bắt đầu.</div>
        ) : (
          <table className="event-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Kết quả</th>
                <th>Nội dung</th>
                <th>Độ tin cậy</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map(h => {
                const blockedWAF = h.result?.waf_blocked || h.result?.blocked;
                const blockedFT  = h.result?.fasttext_blocked;
                const dbRan      = h.result?.distilbert_blocked !== undefined;
                const blockedDB  = h.result?.distilbert_blocked;

                let status = 'safe';
                if (blockedWAF) {
                  status = 'blocked_waf';
                } else if (dbRan) {
                  status = blockedDB ? 'blocked_distilbert' : 'safe';
                } else if (blockedFT) {
                  status = 'blocked_fasttext';
                }
                const conf = h.result?.confidence;
                return (
                  <tr key={h.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{formatDateTime(h.timestamp)}</td>
                    <td><ThreatBadge status={status} size="sm" /></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text.slice(0, 70)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--blue)', fontWeight: 700 }}>{conf ? `${Math.round(conf * 100)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
};

export default Dashboard;
