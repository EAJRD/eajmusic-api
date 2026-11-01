import React, { useState, useEffect } from 'react';

export const BrandSettings: React.FC = () => {
  const [brandName, setBrandName] = useState<string>('EAJ Music');
  const [tagline, setTagline] = useState<string>('Tu catálogo, en tu bolsillo');
  const [primaryColor, setPrimaryColor] = useState<string>('#08080a');
  const [accentColor, setAccentColor] = useState<string>('#e5b358');
  const [athColor, setAthColor] = useState<string>('#ff5000');
  const [faviconEmoji, setFaviconEmoji] = useState<string>('💿');
  const [fontFamily, setFontFamily] = useState<string>('Cinzel & Plus Jakarta Sans');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Dynamic favicon update in the browser tab
  const updateFavicon = (emoji: string) => {
    setFaviconEmoji(emoji);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 32, 36);
      const url = canvas.toDataURL('image/png');
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = url;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateFavicon(faviconEmoji);
    setSaveFeedback('Guardando configuración de marca...');
    setTimeout(() => {
      setSaveFeedback('✅ ¡Identidad visual y favicon dinámico aplicados al ecosistema!');
      setTimeout(() => setSaveFeedback(null), 3500);
    }, 500);
  };

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Configuración Visual de Marca & Favicon Dinámico</h2>
        <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Gestiona los tokens de diseño, paleta oficial y el favicon dinámico del portal eajmusic.com y eaj.eajmusic.com.</p>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Nombre y Tagline */}
          <div style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Identidad Verbal</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
                Nombre Oficial del Sello
              </label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
                Propuesta de Valor / Eslogan
              </label>
              <input
                type="text"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Favicon Dinámico */}
          <div style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Favicon Dinámico del Navegador</h3>
            <p style={{ fontSize: '0.78rem', color: '#9292a0', marginBottom: '0.75rem' }}>Selecciona el isotipo para inyectarlo en la pestaña del navegador en vivo:</p>

            <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem' }}>
              {['💿', '🎵', '⚡', '🇵🇷', '👑', '🔥'].map(emoji => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => updateFavicon(emoji)}
                  style={{
                    fontSize: '1.5rem',
                    background: faviconEmoji === emoji ? 'rgba(229, 179, 88, 0.2)' : '#0d0d12',
                    border: faviconEmoji === emoji ? '1px solid #e5b358' : '1px solid #242432',
                    borderRadius: 8,
                    padding: '0.4rem 0.6rem',
                    cursor: 'pointer'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Favicon Activo:</span> <span style={{ fontSize: '1.2rem' }}>{faviconEmoji}</span>
            </div>
          </div>

          {/* Paleta Oficial */}
          <div style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Paleta Cromática</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#9292a0' }}>Base Negro Mate:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#fff' }}>{primaryColor}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#9292a0' }}>Acento Dorado Ámbar:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#e5b358' }}>{accentColor}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#9292a0' }}>Acento ATH Móvil:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="color" value={athColor} onChange={e => setAthColor(e.target.value)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#ff5000' }}>{athColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div style={{ background: primaryColor, border: `1px solid ${accentColor}`, borderRadius: 12, padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 2, color: accentColor, marginBottom: '0.3rem' }}>
            Vista Previa de Marca en Vivo
          </div>
          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#fff', margin: 0 }}>{brandName}</h2>
          <p style={{ color: '#9595a2', fontSize: '0.9rem', marginTop: '0.2rem' }}>{tagline}</p>
          <div style={{ display: 'inline-block', marginTop: '0.75rem', background: athColor, color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 6 }}>
            RETIRO ATH MÓVIL DISPONIBLE
          </div>
        </div>

        {saveFeedback && (
          <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: 8, color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {saveFeedback}
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
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(229, 179, 88, 0.3)'
          }}
        >
          Guardar Configuración Visual
        </button>
      </form>
    </div>
  );
};

export default BrandSettings;
