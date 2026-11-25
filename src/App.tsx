import React, { useState, useEffect } from 'react';
import Home from './Home';
import { AdminDashboard } from './apps/admin/AdminDashboard';

export const App: React.FC = () => {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(false);

  useEffect(() => {
    const path = window.location.pathname;
    const hostname = window.location.hostname;
    if (path.startsWith('/admin') || hostname.startsWith('eaj.') || window.location.hash === '#admin') {
      setIsAdminRoute(true);
    }

    const handleHash = () => {
      if (window.location.hash === '#admin') {
        setIsAdminRoute(true);
      } else if (window.location.hash === '#home') {
        setIsAdminRoute(false);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (isAdminRoute) {
    return <AdminDashboard />;
  }

  return <Home />;
};

export default App;
