import React, { useEffect, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header  from './components/layout/Header';
import Dashboard   from './pages/Dashboard';
import ScannerView from './pages/ScannerView';
import HistoryLogs from './pages/HistoryLogs';
import VerificationQueue from './pages/VerificationQueue';
import useScanStore from './store/scanStore';
import './App.css';

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
      case 'scanner':   return <ScannerView />;
      case 'history':   return <HistoryLogs />;
      case 'verify':    return <VerificationQueue />;
      default:          return <Dashboard />;
    }
  };

  return (
    <div className="app-wrapper">
      <Sidebar activePage={page} onNavigate={setPage} />
      <div className="main-area">
        <Header activePage={page} onRefreshServers={checkServers} />
        <main className="page-content" id="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
