import React, { useState } from 'react';

export const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'ARTIST' as 'ARTIST' | 'LABEL',
    athMovil: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('¡Cuenta creada exitosamente! Redirigiendo a tu panel de artista...');
      window.location.href = 'https://artist.eajmusic.com';
    }, 700);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#08080a', color: '#f4f4f7', padding: '1.5rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#121217', border: '1px solid #23232f', borderRadius: 16, padding: '2.25rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: '#181822', border: '1px solid #e5b358', color: '#e5b358', fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Cinzel, serif', textDecoration: 'none', marginBottom: '1rem', boxShadow: '0 0 15px rgba(229, 179, 88, 0.3)' }}>
            EAJ
          </a>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: -0.5, color: '#fff', marginBottom: '0.35rem' }}>
            Crea tu Cuenta Oficial
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#9595a2' }}>
            ¿Ya tienes una cuenta registrada?{' '}
            <a href="/login" style={{ color: '#e5b358', fontWeight: 600, textDecoration: 'none' }}>
              Iniciar sesión aquí
            </a>
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {/* SELECTOR DE ROL CON ICONOS SVG (NO MATERIAL SYMBOLS ROTOS) */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.75rem' }}>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, accountType: 'ARTIST' }))}
            style={{
              flex: 1,
              padding: '1rem',
              borderRadius: 12,
              border: formData.accountType === 'ARTIST' ? '2px solid #e5b358' : '1px solid #242432',
              background: formData.accountType === 'ARTIST' ? 'rgba(229, 179, 88, 0.12)' : '#181822',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: '#e5b358' }}>
              {/* SVG Microphone Icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
              </svg>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>Artista</div>
            <div style={{ fontSize: '0.72rem', color: '#9595a2', marginTop: '0.2rem' }}>Creador individual o banda</div>
          </button>

          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, accountType: 'LABEL' }))}
            style={{
              flex: 1,
              padding: '1rem',
              borderRadius: 12,
              border: formData.accountType === 'LABEL' ? '2px solid #38bdf8' : '1px solid #242432',
              background: formData.accountType === 'LABEL' ? 'rgba(56, 189, 248, 0.12)' : '#181822',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: '#38bdf8' }}>
              {/* SVG Building/Business Icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect>
                <path d="M9 22v-4h6v4"></path>
                <path d="M8 6h.01"></path>
                <path d="M16 6h.01"></path>
                <path d="M8 10h.01"></path>
                <path d="M16 10h.01"></path>
                <path d="M8 14h.01"></path>
                <path d="M16 14h.01"></path>
              </svg>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>Sello / Manager</div>
            <div style={{ fontSize: '0.72rem', color: '#9595a2', marginTop: '0.2rem' }}>Gestiona múltiples artistas</div>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#e5e5ed' }}>
              {formData.accountType === 'ARTIST' ? 'Nombre Artístico' : 'Nombre del Sello Discográfico'}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={formData.accountType === 'ARTIST' ? 'Ej. Kaelo' : 'Ej. San Juan Records'}
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#e5e5ed' }}>
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="tu@correo.com"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#ff5000' }}>
              Teléfono para Cobro de Regalías por ATH Móvil (Opcional - Puerto Rico) 🇵🇷
            </label>
            <input
              type="tel"
              value={formData.athMovil}
              onChange={e => setFormData(prev => ({ ...prev, athMovil: e.target.value }))}
              placeholder="+1 (787) 000-0000"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem', fontFamily: 'monospace' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#e5e5ed' }}>
              Contraseña Segura
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#e5e5ed' }}>
              Confirmar Contraseña
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Repite tu contraseña"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <p style={{ fontSize: '0.75rem', color: '#9595a2', lineHeight: 1.5 }}>
            Al registrarte, confirmas que aceptas los <a href="#" style={{ color: '#e5b358' }}>Términos de Servicio</a> y la <a href="#" style={{ color: '#e5b358' }}>Política de Privacidad</a> de EAJ Music. Conservas el 100% de tus regalías.
          </p>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #e5b358, #b88a36)',
              color: '#08080a',
              border: 'none',
              padding: '0.85rem',
              borderRadius: 8,
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(229, 179, 88, 0.3)',
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta Gratis'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
