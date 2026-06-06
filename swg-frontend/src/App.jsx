/**
 * App.jsx — SWG Shield Admin Dashboard v4.1
 * ==========================================
 * Định tuyến đơn giản dựa trên state:
 *   - Chưa auth → authView = 'login' | 'register'
 *   - Đã auth   → page = 'dashboard' | 'history' | 'verify'
 *
 * Không cần React Router — authStore.isAuthenticated điều khiển tất cả.
 */

import React, { useEffect, useState } from 'react';
import Sidebar           from './components/layout/Sidebar';
import Dashboard         from './pages/Dashboard';
import HistoryLogs       from './pages/HistoryLogs';
import VerificationQueue from './pages/VerificationQueue';
import Login             from './pages/Login';
import Register          from './pages/Register';
import useScanStore      from './store/scanStore';
import useAuthStore      from './store/authStore';

const App = () => {
  const [page, setPage]         = useState('dashboard');
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  const checkServers    = useScanStore(s => s.checkServers);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const logout          = useAuthStore(s => s.logout);

  // Polling server health — chỉ khi đã đăng nhập
  useEffect(() => {
    if (!isAuthenticated) return;
    checkServers();
    const id = setInterval(checkServers, 30_000);
    return () => clearInterval(id);
  }, [checkServers, isAuthenticated]);

  // ── Chưa auth: hiện Login hoặc Register ─────────────────────────
  if (!isAuthenticated) {
    return authView === 'register'
      ? <Register onNavigateToLogin={() => setAuthView('login')} />
      : <Login   onNavigateToRegister={() => setAuthView('register')} />;
  }

  // ── Đã auth: render Dashboard layout ────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'history':   return <HistoryLogs />;
      case 'verify':    return <VerificationQueue />;
      default:          return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F5F7]">
      <Sidebar
        activePage={page}
        onNavigate={setPage}
        onLogout={logout}
      />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <main className="flex-1" id="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
