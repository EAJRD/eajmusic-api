import React, { useState } from 'react';

export const PlansAndCommissions: React.FC = () => {
  const [proPrice, setProPrice] = useState<number>(19.99);
  const [labelPrice, setLabelPrice] = useState<number>(49.99);
  const [athFee, setAthFee] = useState<number>(0.0);
  const [intlFee, setIntlFee] = useState<number>(2.5);
  const [royaltyCut, setRoyaltyCut] = useState<number>(0.0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Guardando configuración de tarifas...');
    setTimeout(() => {
      setSaveStatus('✅ ¡Tarifas y comisiones actualizadas exitosamente en el clúster de pagos!');
      setTimeout(() => setSaveStatus(null), 4000);
    }, 600);
  };

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Configuración de Tarifas, Planes & Comisiones</h2>
        <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Ajusta las tarifas anuales de suscripción y las tasas de dispersión para Puerto Rico e internacional.</p>
      </div>

      <form onSubmit={handleSave}>
        {/* Precios de Planes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: '#181822', border: '1px solid #242432', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>Plan Free</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)', color: '#ccc', padding: '0.15rem 0.5rem', borderRadius: 10 }}>Básico</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>$0.00 <span style={{ fontSize: '0.85rem', color: '#9595a2' }}>/año</span></div>
            <p style={{ fontSize: '0.78rem', color: '#9292a0' }}>Plan permanente sin costo para atracción de catálogo inicial.</p>
          </div>

          <div style={{ background: '#181822', border: '1px solid rgba(229, 179, 88, 0.4)', borderRadius: 12, padding: '1.25rem', boxShadow: '0 0 15px rgba(229, 179, 88, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: '#e5b358' }}>Plan Pro Artist</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(229, 179, 88, 0.2)', color: '#e5b358', padding: '0.15rem 0.5rem', borderRadius: 10 }}>Más Popular</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e5b358' }}>$</span>
              <input
                type="number"
                step="0.01"
                value={proPrice}
                onChange={e => setProPrice(parseFloat(e.target.value) || 0)}
                style={{
                  background: '#0d0d12',
                  border: '1px solid #e5b358',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  width: 110,
                  padding: '0.2rem 0.5rem',
                  borderRadius: 6
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#9595a2' }}>USD / año</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#9292a0' }}>Lanzamientos ilimitados con cobro express por ATH Móvil.</p>
          </div>

          <div style={{ background: '#181822', border: '1px solid #242432', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>Plan Label Plus</span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: 10 }}>Sellos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>$</span>
              <input
                type="number"
                step="0.01"
                value={labelPrice}
                onChange={e => setLabelPrice(parseFloat(e.target.value) || 0)}
                style={{
                  background: '#0d0d12',
                  border: '1px solid #38bdf8',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  width: 110,
                  padding: '0.2rem 0.5rem',
                  borderRadius: 6
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#9595a2' }}>USD / año</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#9292a0' }}>Multi-artista con división automática de regalías (splits).</p>
          </div>
        </div>

        {/* Políticas de Comisión */}
        <div style={{ background: '#181822', borderRadius: 12, padding: '1.5rem', border: '1px solid #242432', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem' }}>Comisiones & Pasarelas de Pago</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#ff5000', marginBottom: '0.35rem' }}>
                Comisión por Retiro ATH Móvil (Puerto Rico) 🇵🇷
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.1"
                  value={athFee}
                  onChange={e => setAthFee(parseFloat(e.target.value) || 0)}
                  style={{
                    background: '#0d0d12',
                    border: '1px solid #ff5000',
                    color: '#fff',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 8,
                    fontSize: '1rem',
                    fontWeight: 700,
                    width: 90
                  }}
                />
                <span style={{ color: '#fff', fontWeight: 700 }}>%</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.35rem' }}>
                ✓ Fijado en 0.0% como compromiso fundacional para artistas locales.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.35rem' }}>
                Comisión Pasarela Internacional (Trolley ACH / PayPal)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.1"
                  value={intlFee}
                  onChange={e => setIntlFee(parseFloat(e.target.value) || 0)}
                  style={{
                    background: '#0d0d12',
                    border: '1px solid #38bdf8',
                    color: '#fff',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 8,
                    fontSize: '1rem',
                    fontWeight: 700,
                    width: 90
                  }}
                />
                <span style={{ color: '#fff', fontWeight: 700 }}>%</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#9292a0', marginTop: '0.35rem' }}>
                Cubre tarifas de intermediación bancaria fuera de Puerto Rico.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e5b358', marginBottom: '0.35rem' }}>
                Retención de Regalías Fonográficas (Master Cut)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.1"
                  value={royaltyCut}
                  onChange={e => setRoyaltyCut(parseFloat(e.target.value) || 0)}
                  style={{
                    background: '#0d0d12',
                    border: '1px solid #e5b358',
                    color: '#fff',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 8,
                    fontSize: '1rem',
                    fontWeight: 700,
                    width: 90
                  }}
                />
                <span style={{ color: '#fff', fontWeight: 700 }}>%</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#e5b358', marginTop: '0.35rem' }}>
                0.0% = 100% regalías completas para el creador.
              </p>
            </div>
          </div>
        </div>

        {saveStatus && (
          <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: 8, color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
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
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(229, 179, 88, 0.3)'
          }}
        >
          Guardar Cambios de Tarifas
        </button>
      </form>
    </div>
  );
};

export default PlansAndCommissions;
