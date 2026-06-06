import React, { useEffect, useState } from 'react';
import useScanStore from '../../store/scanStore';
import useAuthStore from '../../store/authStore';
import { LayoutGrid, List, GitPullRequest, Activity, Network, Shield, Cpu, Terminal, LogOut, User } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'TỔNG QUAN', icon: LayoutGrid },
  { id: 'history',   label: 'LỊCH SỬ SỰ KIỆN', icon: List },
  { id: 'verify',    label: 'KIỂM ĐỊNH AI (HITL)', icon: GitPullRequest, highlight: true },
];

const LAYERS = [
  { tag: 'L1', label: 'WAF Engine',  color: 'text-rose-600', bg: 'bg-rose-50' },
  { tag: 'L2', label: 'FastText AI', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { tag: 'L3', label: 'DistilBERT',  color: 'text-amber-600', bg: 'bg-amber-50' },
];

export default function Sidebar({ activePage, onNavigate, onLogout }) {
  const { wafOnline, aiOnline, distilbertOnline, wafEvents } = useScanStore();
  const username = useAuthStore(s => s.username);
  const [time, setTime] = useState('');
  const [reportOnline, setReportOnline] = useState(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Real health check for Report API (port 5003)
  useEffect(() => {
    const checkReport = async () => {
      try {
        const res = await fetch('http://localhost:5003/health', { signal: AbortSignal.timeout(3000) });
        setReportOnline(res.ok);
      } catch { setReportOnline(false); }
    };
    checkReport();
    const id = setInterval(checkReport, 30000);
    return () => clearInterval(id);
  }, []);

  const StatusIcon = ({ online, customClass = '' }) => {
    if (online === null) return <Activity size={14} strokeWidth={1.25} className="text-amber-400 animate-pulse" />;
    if (online) return <Activity size={14} strokeWidth={1.25} className={customClass || 'text-emerald-500'} />;
    return <Activity size={14} strokeWidth={1.25} className="text-rose-500" />;
  };

  const statusText = (online) => online === null ? 'SYNCING' : online ? 'ONLINE' : 'OFFLINE';
  const statusColor = (online) => online === null ? 'text-amber-500' : online ? 'text-emerald-500' : 'text-rose-500';

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white/90 backdrop-blur-3xl border-r border-gray-200 z-50 flex flex-col">
      
      {/* Brand */}
      <div className="px-8 py-10 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Terminal size={24} strokeWidth={1.25} className="text-indigo-600" />
          <div className="flex flex-col">
            <span className="text-gray-900 font-bold text-lg tracking-tight">
              SWG<span className="text-indigo-600">GUARD</span>
            </span>
            <span className="text-gray-400 font-medium text-[0.6rem] tracking-[0.2em] uppercase">
              // Sec-Ops Console
            </span>
          </div>
        </div>
      </div>

      {/* Clock */}
      <div className="flex flex-col px-8 py-6 bg-gray-50/50 border-b border-gray-200 gap-1">
        <span className="text-[0.6rem] font-bold text-gray-400 tracking-widest uppercase">System Time</span>
        <span className="font-mono text-sm font-semibold text-gray-900">{time}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-8 overflow-y-auto">
        <div className="flex flex-col gap-1 px-4">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-[0.7rem] font-bold tracking-widest transition-all duration-200 ${
                  isActive 
                    ? item.highlight 
                      ? 'bg-amber-50 text-amber-700 border border-amber-200/50' 
                      : 'bg-gray-900 text-white border border-gray-800'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={14} strokeWidth={1.5} className={isActive && !item.highlight ? 'text-gray-300' : ''} />
                  <span className="text-left">{item.label}</span>
                </div>
                {item.id === 'history' && wafEvents.length > 0 && (
                  <span className={`text-[0.65rem] font-mono font-bold px-1.5 ${isActive ? 'text-gray-300' : 'text-rose-600'}`}>
                    [{wafEvents.length}]
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="h-px bg-gray-200 my-8 mx-8" />
        
        <span className="block px-8 text-[0.6rem] font-bold text-gray-400 tracking-widest uppercase mb-4 flex items-center gap-2">
          <Network size={12} strokeWidth={1.5} /> Architecture
        </span>
        <div className="flex flex-col gap-3 px-8">
          {LAYERS.map(l => (
            <div key={l.label} className="flex items-center gap-3">
              <span className={`font-mono text-[0.55rem] font-bold px-1.5 py-0.5 border ${l.bg} ${l.color} border-current/20`}>
                {l.tag}
              </span>
              <span className="text-[0.7rem] font-medium text-gray-600">{l.label}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* Admin info + Logout */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <User size={13} strokeWidth={2} className="text-indigo-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[0.65rem] font-bold text-gray-800 tracking-wide">
                {username || 'Admin'}
              </span>
              <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest">Authenticated</span>
            </div>
          </div>
          <button
            id="sidebar-logout-btn"
            onClick={onLogout}
            title="Đăng xuất"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.6rem] font-bold text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 uppercase tracking-widest border border-transparent hover:border-rose-200"
          >
            <LogOut size={12} strokeWidth={2} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Services Status */}
      <div className="px-8 py-6 border-t border-gray-200 bg-gray-50/50">
        <span className="block text-[0.6rem] font-bold text-gray-400 tracking-widest uppercase mb-5 flex items-center gap-2">
          <Cpu size={12} strokeWidth={1.5} /> Infrastructure
        </span>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon online={wafOnline} />
              <span className="text-[0.65rem] font-semibold text-gray-600 uppercase tracking-wide">WAF Engine</span>
            </div>
            <span className={`font-mono text-[0.55rem] font-bold uppercase tracking-widest ${statusColor(wafOnline)}`}>{statusText(wafOnline)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon online={aiOnline} />
              <span className="text-[0.65rem] font-semibold text-gray-600 uppercase tracking-wide">FastText</span>
            </div>
            <span className={`font-mono text-[0.55rem] font-bold uppercase tracking-widest ${statusColor(aiOnline)}`}>{statusText(aiOnline)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon online={distilbertOnline} />
              <span className="text-[0.65rem] font-semibold text-gray-600 uppercase tracking-wide">DistilBERT</span>
            </div>
            <span className={`font-mono text-[0.55rem] font-bold uppercase tracking-widest ${statusColor(distilbertOnline)}`}>{statusText(distilbertOnline)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon online={reportOnline} />
              <span className="text-[0.65rem] font-semibold text-gray-600 uppercase tracking-wide">Report API</span>
            </div>
            <span className={`font-mono text-[0.55rem] font-bold uppercase tracking-widest ${statusColor(reportOnline)}`}>{statusText(reportOnline)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
