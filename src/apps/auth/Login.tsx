import React, { useState } from 'react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (email === 'admin@eajmusic.com' || email === 'ceo@empireanimationsjoyful.com') {
        window.location.href = '/admin';
      } else {
        window.location.href = 'https://artist.eajmusic.com';
      }
    }, 700);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#08080a', color: '#f4f4f7', padding: '1.5rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 440, width: '100%', background: '#121217', border: '1px solid #23232f', borderRadius: 16, padding: '2.25rem', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: '#181822', border: '1px solid #e5b358', color: '#e5b358', fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Cinzel, serif', textDecoration: 'none', marginBottom: '1rem', boxShadow: '0 0 15px rgba(229, 179, 88, 0.3)' }}>
            EAJ
          </a>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: -0.5, color: '#fff', marginBottom: '0.35rem' }}>
            Inicia Sesión en tu Cuenta
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#9595a2' }}>
            ¿No tienes cuenta aún?{' '}
            <a href="/register" style={{ color: '#e5b358', fontWeight: 600, textDecoration: 'none' }}>
              Crea tu cuenta de artista o sello
            </a>
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#e5e5ed' }}>
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#e5e5ed' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#0d0d12', border: '1px solid #242432', borderRadius: 8, color: '#fff', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9595a2', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ accentColor: '#e5b358' }}
              />
              Recordarme en este dispositivo
            </label>
            <a href="#" onClick={e => { e.preventDefault(); alert('Se ha enviado un enlace de recuperación a tu correo.'); }} style={{ color: '#e5b358', textDecoration: 'none' }}>
              ¿Olvidaste tu contraseña?
            </a>
          </div>

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
            {loading ? 'Accediendo...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #23232f', fontSize: '0.78rem', color: '#6c6c78', textAlign: 'center' }}>
          <div><strong>Cuentas de Demostración:</strong></div>
          <div style={{ marginTop: '0.25rem' }}>Artista: <code>artista@eajmusic.com</code> / <code>Password123!</code></div>
          <div>Admin: <code>admin@eajmusic.com</code> / <code>Admin123!</code></div>
        </div>
      </div>
    </div>
  );
};

export default Login;
