import React from "react";
import { Icons } from "../utils";

export const Sidebar = ({ activeTab, setActiveTab, onLogout, mobileOpen, setMobileOpen }: any) => {
  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: Icons.Home },
    { id: 'analytics', label: 'Analytics', icon: Icons.Chart },
    { id: 'wallet', label: 'Wallet', icon: Icons.Wallet },
    { id: 'new-release', label: 'New Release', icon: Icons.Upload },
    { id: 'catalog', label: 'Catalog', icon: Icons.Disc },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/80 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-950 border-r border-dark-800 flex flex-col transition-transform duration-300 transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            EAJ<span className="text-brand-500">Music</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-brand-600/10 text-brand-400' : 'text-slate-400 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <tab.icon /> {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-800">
           <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300">
             <Icons.Logout /> Logout
           </button>
        </div>
      </div>
    </>
  );
};