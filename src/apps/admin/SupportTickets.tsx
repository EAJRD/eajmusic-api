import React, { useState } from 'react';

interface TicketItem {
  id: string;
  artistName: string;
  artistEmail: string;
  category: 'PAYOUTS' | 'DDEX_DISTRIBUTION' | 'MASTERING' | 'ACCOUNT';
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  date: string;
  lastReply: string;
}

const INITIAL_TICKETS: TicketItem[] = [
  {
    id: 'tkt_001',
    artistName: 'Kaelo',
    artistEmail: 'kaelo@eajmusic.com',
    category: 'PAYOUTS',
    subject: 'Confirmación de teléfono ATH Móvil para depósito de regalías',
    status: 'RESOLVED',
    date: '2026-10-30',
    lastReply: 'Teléfono verificado con éxito. Dispersión programada.'
  },
  {
    id: 'tkt_002',
    artistName: 'Niko PR',
    artistEmail: 'niko@demo.pr',
    category: 'DDEX_DISTRIBUTION',
    subject: 'Solicitud de fecha de estreno sincronizada en Spotify y Apple Music',
    status: 'IN_PROGRESS',
    date: '2026-10-31',
    lastReply: 'El equipo de distribución está validando la ventana de 14 días.'
  },
  {
    id: 'tkt_003',
    artistName: 'Vlady Santos',
    artistEmail: 'vlady@eajmusic.com',
    category: 'MASTERING',
    subject: 'Solicitud de versión Dolby Atmos para Midnight In San Juan',
    status: 'OPEN',
    date: '2026-10-31',
    lastReply: 'Esperando respuesta del ingeniero de mezcla de Empire.'
  }
];

export const SupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<TicketItem[]>(INITIAL_TICKETS);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');

  const updateStatus = (id: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    setTickets(prev =>
      prev.map(t => (t.id === id ? { ...t, status: newStatus } : t))
    );
  };

  const filtered = tickets.filter(t => (filter === 'ALL' ? true : t.status === filter));

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Mesa de Soporte & Atención a Creadores</h2>
          <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Gestiona dudas y solicitudes técnicas sobre retiros ATH Móvil, códigos ISRC y distribución internacional.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                background: filter === tab ? 'rgba(229, 179, 88, 0.15)' : '#1a1a24',
                color: filter === tab ? '#e5b358' : '#9292a0',
                border: filter === tab ? '1px solid #e5b358' : '1px solid #242432',
                padding: '0.45rem 0.9rem',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tab === 'ALL' ? 'Todos' : tab === 'OPEN' ? 'Abiertos' : tab === 'IN_PROGRESS' ? 'En Proceso' : 'Resueltos'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(tkt => (
          <div
            key={tkt.id}
            style={{
              background: '#181822',
              borderRadius: 12,
              padding: '1.25rem',
              border: '1px solid #242432',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 6,
                    background: tkt.category === 'PAYOUTS' ? 'rgba(255, 80, 0, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: tkt.category === 'PAYOUTS' ? '#ff5000' : '#38bdf8'
                  }}
                >
                  {tkt.category === 'PAYOUTS' ? 'ATH MÓVIL' : tkt.category}
                </span>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{tkt.subject}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#9292a0' }}>
                Artista: <strong style={{ color: '#fff' }}>{tkt.artistName}</strong> ({tkt.artistEmail}) · Creado el {tkt.date}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#cfcfe0', marginTop: '0.35rem', fontStyle: 'italic' }}>
                Última nota: "{tkt.lastReply}"
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={tkt.status}
                onChange={e => updateStatus(tkt.id, e.target.value as any)}
                style={{
                  background: '#0d0d12',
                  border: '1px solid #333',
                  color: tkt.status === 'RESOLVED' ? '#22c55e' : tkt.status === 'IN_PROGRESS' ? '#e5b358' : '#ef4444',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                <option value="OPEN">🔴 Abierto</option>
                <option value="IN_PROGRESS">🟡 En Proceso</option>
                <option value="RESOLVED">🟢 Resuelto</option>
              </select>

              <button
                onClick={() => {
                  const reply = prompt('Escribir respuesta para enviar al artista por email:');
                  if (reply) {
                    alert('Respuesta enviada y ticket actualizado.');
                    updateStatus(tkt.id, 'RESOLVED');
                  }
                }}
                style={{
                  background: 'rgba(229, 179, 88, 0.12)',
                  color: '#e5b358',
                  border: '1px solid #e5b358',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Responder
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupportTickets;
