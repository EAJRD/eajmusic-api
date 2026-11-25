import React, { useState } from 'react';
import ReleasesList from './ReleasesList';
import UsersList from './UsersList';
import PlansAndCommissions from './PlansAndCommissions';
import BrandSettings from './BrandSettings';
import Announcements from './Announcements';
import SupportTickets from './SupportTickets';
import AdminSettings from './AdminSettings';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'releases' | 'users' | 'plans' | 'announcements' | 'tickets' | 'brand' | 'settings'>('overview');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleManualSync = () => {
    setSyncStatus('Iniciando sincronización con Amuse API & AI Database...');
    setTimeout(() => {
      setSyncStatus('✅ [2026-10-31] Sincronización exitosa: Catálogo y métricas actualizados.');
      setTimeout(() => setSyncStatus(null), 4000);
    }, 800);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#08080a', color: '#f4f4f7', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 270, background: '#121217', borderRight: '1px solid #23232f', padding: '1.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', textDecoration: 'none', color: '#fff' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#181822', border: '1px solid #e5b358', color: '#e5b358', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontWeight: 800, fontSize: '0.95rem', boxShadow: '0 0 12px rgba(229, 179, 88, 0.25)' }}>
            EAJ
          </div>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', fontWeight: 700, letterSpacing: 1.5 }}>EAJ MUSIC</div>
            <div style={{ fontSize: '0.65rem', color: '#e5b358', textTransform: 'uppercase', letterSpacing: 1 }}>Backoffice Sello</div>
          </div>
        </a>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'overview' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'overview' ? '#e5b358' : '#9292a0',
              border: activeTab === 'overview' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🎛️ Vista General
          </button>

          <button
            onClick={() => setActiveTab('releases')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'releases' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'releases' ? '#e5b358' : '#9292a0',
              border: activeTab === 'releases' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            💿 Cola de Moderación (Releases)
          </button>

          <button
            onClick={() => setActiveTab('users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'users' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'users' ? '#e5b358' : '#9292a0',
              border: activeTab === 'users' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            👥 Gestión de Usuarios
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'plans' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'plans' ? '#e5b358' : '#9292a0',
              border: activeTab === 'plans' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            💰 Tarifas & Comisiones
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'announcements' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'announcements' ? '#e5b358' : '#9292a0',
              border: activeTab === 'announcements' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            📢 Avisos & Comunicados
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'tickets' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'tickets' ? '#e5b358' : '#9292a0',
              border: activeTab === 'tickets' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🎫 Mesa de Soporte (Tickets)
          </button>

          <button
            onClick={() => setActiveTab('brand')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'brand' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'brand' ? '#e5b358' : '#9292a0',
              border: activeTab === 'brand' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            🎨 Identidad & Favicon
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              background: activeTab === 'settings' ? 'rgba(229, 179, 88, 0.12)' : 'transparent',
              color: activeTab === 'settings' ? '#e5b358' : '#9292a0',
              border: activeTab === 'settings' ? '1px solid rgba(229, 179, 88, 0.35)' : 'none',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            ⚙️ Ajustes de Infraestructura
          </button>
        </nav>

        <div style={{ borderTop: '1px solid #23232f', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e5b358', color: '#0b0b0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
            CEO
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Ernesto / Dirección</div>
            <div style={{ fontSize: '0.7rem', color: '#22c55e' }}>● Super Admin</div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main style={{ flexGrow: 1, padding: '2.25rem 2.5rem', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.25rem', borderBottom: '1px solid #23232f', paddingBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: -0.5 }}>
              Backoffice Central · eaj.eajmusic.com
            </h1>
            <p style={{ color: '#9292a0', fontSize: '0.88rem' }}>
              Plataforma administrativa oficial para supervisión de lanzamientos, catálogo y finanzas.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="/" style={{ background: 'transparent', color: '#f4f4f7', border: '1px solid #23232f', padding: '0.55rem 1.15rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
              Ver eajmusic.com
            </a>
            <button
              onClick={handleManualSync}
              style={{
                background: 'linear-gradient(135deg, #e5b358, #b88a36)',
                color: '#08080a',
                padding: '0.6rem 1.25rem',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 16px rgba(229, 179, 88, 0.25)'
              }}
            >
              🔄 Sincronizar Amuse
            </button>
          </div>
        </header>

        {syncStatus && (
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '0.85rem 1.25rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
            {syncStatus}
          </div>
        )}

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
              <div style={{ background: '#121217', border: '1px solid #23232f', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#9292a0', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: '0.4rem' }}>
                  Streams Totales
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff' }}>1,845,200</div>
                <div style={{ fontSize: '0.76rem', color: '#22c55e', marginTop: '0.35rem' }}>↑ +14.2% este mes</div>
              </div>

              <div style={{ background: '#121217', border: '1px solid #23232f', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#9292a0', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: '0.4rem' }}>
                  Lanzamientos en DSPs
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff' }}>4</div>
                <div style={{ fontSize: '0.76rem', color: '#22c55e', marginTop: '0.35rem' }}>100% DDEX ERN 4.3 validado</div>
              </div>

              <div style={{ background: '#121217', border: '1px solid #23232f', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#9292a0', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: '0.4rem' }}>
                  Regalías Liquidadas
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff' }}>$7,196.28</div>
                <div style={{ fontSize: '0.76rem', color: '#ff5000', marginTop: '0.35rem' }}>Retiro ATH Móvil disponible</div>
              </div>

              <div style={{ background: '#121217', border: '1px solid #23232f', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#9292a0', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: '0.4rem' }}>
                  Moderación Pendiente
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#e5b358' }}>2</div>
                <div style={{ fontSize: '0.76rem', color: '#e5b358', marginTop: '0.35rem' }}>Lanzamientos en cola</div>
              </div>
            </div>

            {/* Acceso Directo a la Cola */}
            <div style={{ marginBottom: '2rem' }}>
              <ReleasesList />
            </div>
          </div>
        )}

        {/* Tab 2: Releases */}
        {activeTab === 'releases' && <ReleasesList />}

        {/* Tab 3: Users */}
        {activeTab === 'users' && <UsersList />}

        {/* Tab 4: Plans & Commissions */}
        {activeTab === 'plans' && <PlansAndCommissions />}

        {/* Tab 5: Announcements */}
        {activeTab === 'announcements' && <Announcements />}

        {/* Tab 6: Support Tickets */}
        {activeTab === 'tickets' && <SupportTickets />}

        {/* Tab 7: Brand Settings */}
        {activeTab === 'brand' && <BrandSettings />}

        {/* Tab 8: Admin Infrastructure Settings */}
        {activeTab === 'settings' && <AdminSettings />}
      </main>
    </div>
  );
};

export default AdminDashboard;
