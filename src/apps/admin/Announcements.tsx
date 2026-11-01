import React, { useState } from 'react';

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  targetAudience: 'ALL' | 'ARTIST' | 'LABEL';
  priority: 'NORMAL' | 'URGENT';
  date: string;
  active: boolean;
}

const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann_001',
    title: 'Dispersión de Regalías Octubre 2026 vía ATH Móvil',
    message: 'Todos los pagos correspondientes al cierre de mes han sido emitidos a las cuentas vinculadas sin comisión.',
    targetAudience: 'ALL',
    priority: 'URGENT',
    date: '2026-10-31',
    active: true
  },
  {
    id: 'ann_002',
    title: 'Nueva Ingesta Prioritaria a TikTok Music y YouTube Shorts',
    message: 'Los lanzamientos Pro Artist ahora cuentan con entrega de Content ID acelerada en 48 horas.',
    targetAudience: 'ARTIST',
    priority: 'NORMAL',
    date: '2026-10-25',
    active: true
  }
];

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(INITIAL_ANNOUNCEMENTS);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newTarget, setNewTarget] = useState<'ALL' | 'ARTIST' | 'LABEL'>('ALL');
  const [newPriority, setNewPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMessage) return;

    const newItem: AnnouncementItem = {
      id: 'ann_' + Date.now(),
      title: newTitle,
      message: newMessage,
      targetAudience: newTarget,
      priority: newPriority,
      date: new Date().toISOString().split('T')[0],
      active: true
    };

    setAnnouncements([newItem, ...announcements]);
    setNewTitle('');
    setNewMessage('');
    setFeedback('✅ Comunicado publicado en los paneles de artistas y sellos en tiempo real.');
    setTimeout(() => setFeedback(null), 3000);
  };

  const toggleActive = (id: string) => {
    setAnnouncements(prev =>
      prev.map(a => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Emisión de Comunicados & Avisos del Sello</h2>
        <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Publica notificaciones directas en el portal del artista (artist.eajmusic.com) sobre pagos, entregas y novedades.</p>
      </div>

      <form onSubmit={handleCreate} style={{ background: '#181822', borderRadius: 12, padding: '1.25rem', border: '1px solid #242432', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>Crear Nuevo Comunicado</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
              Título del Aviso
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Ej. Liquidación de Regalías Fonográficas"
              style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
                Audiencia Objetivo
              </label>
              <select
                value={newTarget}
                onChange={e => setNewTarget(e.target.value as any)}
                style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8 }}
              >
                <option value="ALL">Todos los Usuarios</option>
                <option value="ARTIST">Solo Artistas</option>
                <option value="LABEL">Solo Sellos Discográficos</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
                Prioridad
              </label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as any)}
                style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8 }}
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgente (Banner Naranja)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#9292a0', marginBottom: '0.3rem' }}>
            Mensaje Completo
          </label>
          <textarea
            required
            rows={3}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Escribe el cuerpo de la notificación que verán los creadores en su panel..."
            style={{ width: '100%', background: '#0d0d12', border: '1px solid #242432', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8, resize: 'vertical' }}
          />
        </div>

        {feedback && (
          <div style={{ color: '#22c55e', fontSize: '0.82rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            {feedback}
          </div>
        )}

        <button
          type="submit"
          style={{
            background: 'linear-gradient(135deg, #e5b358, #b88a36)',
            color: '#08080a',
            border: 'none',
            padding: '0.65rem 1.4rem',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Publicar Comunicado
        </button>
      </form>

      {/* Lista de Comunicados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {announcements.map(item => (
          <div
            key={item.id}
            style={{
              background: '#181822',
              borderRadius: 10,
              padding: '1.15rem',
              border: item.priority === 'URGENT' ? '1px solid #ff5000' : '1px solid #242432',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.3rem' }}>
                <span style={{ fontWeight: 800, color: '#fff' }}>{item.title}</span>
                {item.priority === 'URGENT' && (
                  <span style={{ fontSize: '0.68rem', background: 'rgba(255, 80, 0, 0.2)', color: '#ff5000', padding: '0.15rem 0.5rem', borderRadius: 8, fontWeight: 700 }}>
                    URGENTE
                  </span>
                )}
                <span style={{ fontSize: '0.7rem', color: '#9292a0' }}>{item.date} · Audiencia: {item.targetAudience}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#cfcfe0', margin: 0 }}>{item.message}</p>
            </div>

            <button
              onClick={() => toggleActive(item.id)}
              style={{
                background: item.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: item.active ? '#22c55e' : '#ef4444',
                border: '1px solid #333',
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {item.active ? 'Publicado' : 'Oculto'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Announcements;
