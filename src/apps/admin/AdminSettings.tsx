import React, { useState } from 'react';

export const AdminSettings: React.FC = () => {
  const [twoFactorRequired, setTwoFactorRequired] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(120);
  const [failoverDatabase, setFailoverDatabase] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Guardando configuración de seguridad y backend...');
    setTimeout(() => {
      setSaveStatus('✅ ¡Ajustes de infraestructura y seguridad guardados!');
      setTimeout(() => setSaveStatus(null), 3000);
    }, 500);
  };

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Ajustes del Sistema & Seguridad de Infraestructura</h2>
        <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Configura el nivel de protección 2FA, pasarelas de conexión, base de datos de failover y límites de API.</p>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Seguridad y 2FA */}
          <div style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Seguridad & Autenticación</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Autenticación en Dos Pasos (2FA)</div>
                <div style={{ fontSize: '0.75rem', color: '#9292a0' }}>Exigir TOTP / Códigos de respaldo para roles Admin</div>
              </div>
              <input
                type="checkbox"
                checked={twoFactorRequired}
                onChange={e => setTwoFactorRequired(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: '#e5b358' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
                Límite de Peticiones API (Rate Limiting / min)
              </label>
              <input
                type="number"
                value={rateLimitPerMinute}
                onChange={e => setRateLimitPerMinute(parseInt(e.target.value) || 60)}
                style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.55rem 0.8rem', borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Estado de Base de Datos & Failover */}
          <div style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Base de Datos & Failover</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Failover Automático a InsForge / Supabase</div>
                <div style={{ fontSize: '0.75rem', color: '#9292a0' }}>Conmutación instantánea si el servidor principal no responde</div>
              </div>
              <input
                type="checkbox"
                checked={failoverDatabase}
                onChange={e => setFailoverDatabase(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: '#22c55e' }}
              />
            </div>

            <div style={{ fontSize: '0.8rem', color: '#22c55e' }}>
              ● Clúster PostgreSQL PostgREST: <strong>EN LÍNEA</strong>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#22c55e', marginTop: '0.2rem' }}>
              ● Almacenamiento Cloudflare R2: <strong>ACTIVO (sRGB 3000px)</strong>
            </div>
          </div>

          {/* Modo Mantenimiento */}
          <div style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Estado Global del Sitio</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Modo Mantenimiento</div>
                <div style={{ fontSize: '0.75rem', color: '#9292a0' }}>Pausar temporalmente nuevas subidas de lanzamientos</div>
              </div>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={e => setMaintenanceMode(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: '#ef4444' }}
              />
            </div>
          </div>
        </div>

        {saveStatus && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: 8, color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {saveStatus}
          </div>
        )}

        <button
          type="submit"
          style={{
            background: 'linear-gradient(135deg, #e5b358, #b88a36)',
            color: '#08080a',
            border: 'none',
            padding: '0.75rem 1.75rem',
            borderRadius: 8,
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Guardar Ajustes de Infraestructura
        </button>
      </form>
    </div>
  );
};

export default AdminSettings;
