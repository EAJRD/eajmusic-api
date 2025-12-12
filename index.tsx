import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { UserRole, ViewState, Release } from "./types";
import { CURRENT_USER, Icons, getStatusColor } from "./utils";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { Analytics } from "./components/Analytics";
import { Wallet } from "./components/Wallet";
import { ReleaseWizard } from "./components/ReleaseWizard";
import { AdminDashboard } from "./components/AdminDashboard";
import { Login } from "./components/Login";

const App = () => {
    const [view, setView] = useState<ViewState>('login');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [releases, setReleases] = useState<Release[]>([]); // Empty initial state

    const handleLogin = (role: UserRole) => {
        if (role === 'admin') setView('admin_dashboard');
        else setView('artist_app');
    };

    const handleNewRelease = (data: Release) => {
        const newRelease = { ...data, id: Date.now().toString() };
        setReleases([newRelease, ...releases]);
        setActiveTab('catalog');
    };

    if (view === 'login') {
        return <Login onLogin={handleLogin} />;
    }

    if (view === 'admin_dashboard') {
        return <AdminDashboard releases={releases} onLogout={() => setView('login')} />;
    }

    // Artist App Layout
    return (
        <div className="flex h-screen bg-dark-950 font-sans text-slate-200">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onLogout={() => setView('login')} 
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />

            <div className="flex-1 flex flex-col h-full overflow-hidden lg:pl-64">
                {/* Mobile Header */}
                <div className="lg:hidden h-16 border-b border-dark-800 flex items-center px-4 justify-between bg-dark-950 z-40">
                    <span className="font-bold text-white">EAJMusic</span>
                    <button onClick={() => setMobileOpen(true)} className="text-slate-400"><Icons.Menu /></button>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    <div className="max-w-7xl mx-auto">
                        {activeTab === 'dashboard' && <Dashboard user={CURRENT_USER} />}
                        {activeTab === 'analytics' && <Analytics />}
                        {activeTab === 'wallet' && <Wallet user={CURRENT_USER} />}
                        {activeTab === 'new-release' && <ReleaseWizard onSubmit={handleNewRelease} />}
                        {activeTab === 'catalog' && (
                             <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-white">My Catalog</h2>
                                {releases.length === 0 ? <p className="text-slate-500">No releases yet.</p> : releases.map(r => (
                                    <div key={r.id} className="glass-panel p-4 rounded-xl flex justify-between items-center">
                                        <div className="font-bold text-white">{r.title}</div>
                                        <div className={`text-xs px-2 py-1 rounded border ${getStatusColor(r.status)}`}>{r.status}</div>
                                    </div>
                                ))}
                             </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Styles for Forms
const style = document.createElement('style');
style.innerHTML = `
  .input-field {
    width: 100%;
    background-color: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 0.75rem;
    color: white;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-field:focus {
    border-color: #0ea5e9;
  }
  .btn-primary {
    background-color: #0ea5e9;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  .btn-primary:hover {
    background-color: #0284c7;
  }
`;
document.head.appendChild(style);