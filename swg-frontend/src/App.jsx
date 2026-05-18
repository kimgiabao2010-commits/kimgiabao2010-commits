import React, { useEffect, useState } from 'react';
import Sidebar from './components/layout/Sidebar';

import Dashboard   from './pages/Dashboard';
import HistoryLogs from './pages/HistoryLogs';
import VerificationQueue from './pages/VerificationQueue';
import useScanStore from './store/scanStore';

const App = () => {
  const [page, setPage] = useState('dashboard');
  const checkServers = useScanStore(s => s.checkServers);

  useEffect(() => {
    checkServers();
    const interval = setInterval(checkServers, 30000);
    return () => clearInterval(interval);
  }, [checkServers]);

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
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <main className="flex-1" id="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
