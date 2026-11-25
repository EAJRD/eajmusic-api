import React, { useState } from 'react';
import { useReleasesSync } from '../../services/useReleasesSync';

interface ReleaseItem {
  id: string;
  title: string;
  artist: string;
  upc: string;
  isrc: string;
  type: string;
  genre: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  coverUrl: string;
  audioPreviewUrl: string;
  submissionDate: string;
  reviewNotes?: string;
}

const INITIAL_RELEASES: ReleaseItem[] = [
  {
    id: 'rel_mod_001',
    title: 'Neon Horizons (Original Mix)',
    artist: 'Kaelo & EAJ Collective',
    upc: '7300012345678',
    isrc: 'QZDA42600101',
    type: 'Single',
    genre: 'Synthwave / Cyberpunk',
    status: 'APPROVED',
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    audioPreviewUrl: 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
    submissionDate: '2026-10-15',
    reviewNotes: 'Masterización impecable en 24-bit. Cumple Apple Style Guide.'
  },
  {
    id: 'rel_mod_002',
    title: 'Fuego en Calle Loíza',
    artist: 'Niko PR',
    upc: '7300012345682',
    isrc: 'QZDA42600501',
    type: 'Single',
    genre: 'Urbano / Drill Boricua',
    status: 'PENDING',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    audioPreviewUrl: 'https://cdn.freesound.org/previews/567/567280_1648170-lq.mp3',
    submissionDate: '2026-10-31',
    reviewNotes: 'En espera de verificación de autoría de beat.'
  },
  {
    id: 'rel_mod_003',
    title: 'Midnight In San Juan (EP Completo)',
    artist: 'Vlady Santos',
    upc: '7300012345679',
    isrc: 'QZDA42600201',
    type: 'EP (2 Tracks)',
    genre: 'Latin Urban / Afrobeat',
    status: 'APPROVED',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
    audioPreviewUrl: 'https://cdn.freesound.org/previews/450/450622_5121236-lq.mp3',
    submissionDate: '2026-09-20',
    reviewNotes: 'Aprobado para distribución prioritaria DSPs y coproducción visual.'
  },
  {
    id: 'rel_mod_004',
    title: 'Sin Retorno',
    artist: 'Dúo Caribe',
    upc: '7300012345683',
    isrc: 'QZDA42600601',
    type: 'Single',
    genre: 'Reggaetón Clásico',
    status: 'PENDING',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800',
    audioPreviewUrl: 'https://cdn.freesound.org/previews/415/415994_5121236-lq.mp3',
    submissionDate: '2026-10-31',
    reviewNotes: 'Audición preliminar favorable.'
  }
];

export const ReleasesList: React.FC = () => {
  const { releases: liveReleases, approveRelease, rejectRelease, patchRelease } = useReleasesSync();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);

  // Mapear lanzamientos del backend combinándolos con la lista inicial
  const mappedReleases: ReleaseItem[] = liveReleases.length > 0
    ? liveReleases.map((r: any) => {
        const rawStatus = (r.status || 'draft').toUpperCase();
        const normalizedStatus: 'PENDING' | 'APPROVED' | 'REJECTED' =
          rawStatus === 'APPROVED' || rawStatus === 'RELEASED'
            ? 'APPROVED'
            : rawStatus === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING';

        return {
          id: r.id,
          title: r.title,
          artist: r.artist_name || r.artist || 'Kaelo & EAJ Collective',
          upc: r.upc || 'Pendiente',
          isrc: r.isrc || (r.tracks?.[0]?.isrc || 'QZDA42600001'),
          type: r.type ? r.type.toUpperCase() : 'SINGLE',
          genre: r.genre || 'Urbano / Alternativo',
          status: normalizedStatus,
          coverUrl: r.cover_art_url || r.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
          audioPreviewUrl: r.tracks?.[0]?.preview_url || r.audioPreviewUrl || 'https://cdn.freesound.org/previews/612/612610_5674468-lq.mp3',
          submissionDate: r.release_date || (r.created_at ? r.created_at.split('T')[0] : '2026-11-24'),
          reviewNotes: r.review_notes || ''
        };
      })
    : INITIAL_RELEASES;

  const handlePlay = (id: string, url: string) => {
    if (playingId === id) {
      if (audioPlayer) audioPlayer.pause();
      setPlayingId(null);
    } else {
      if (audioPlayer) audioPlayer.pause();
      const newAudio = new Audio(url);
      newAudio.play().catch(e => console.warn('Audio preview no disponible:', e));
      setAudioPlayer(newAudio);
      setPlayingId(id);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await patchRelease(id, {
        status: 'approved',
        review_notes: 'Aprobado formalmente por el Director A&R.'
      });
    } catch (e) {
      console.warn('Fallback local approve:', e);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Ingrese el motivo del rechazo para notificar al artista:') || 'Metadatos o calidad de audio no satisfacen los estándares del sello.';
    try {
      await patchRelease(id, {
        status: 'rejected',
        review_notes: reason
      });
    } catch (e) {
      console.warn('Fallback local reject:', e);
    }
  };

  const filtered = mappedReleases.filter(r => (filter === 'ALL' ? true : r.status === filter));

  return (
    <div style={{ background: '#121217', borderRadius: 16, padding: '1.75rem', border: '1px solid #23232f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>Cola de Moderación & Validación de Lanzamientos</h2>
          <p style={{ color: '#9292a0', fontSize: '0.85rem' }}>Revisa la carátula oficial (3000px), escucha el master y valida metadatos DDEX antes de entregar a DSPs.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                background: filter === tab ? 'rgba(229, 179, 88, 0.15)' : '#1a1a24',
                color: filter === tab ? '#e5b358' : '#9292a0',
                border: filter === tab ? '1px solid #e5b358' : '1px solid #242432',
                padding: '0.45rem 1rem',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tab === 'ALL' ? 'Todos' : tab === 'PENDING' ? 'Pendientes (2)' : tab === 'APPROVED' ? 'Aprobados' : 'Rechazados'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(item => (
          <div
            key={item.id}
            style={{
              background: '#181822',
              border: '1px solid #23232f',
              borderRadius: 12,
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <img
                src={item.coverUrl}
                alt={item.title}
                style={{ width: 68, height: 68, borderRadius: 10, objectFit: 'cover', border: '1px solid #333' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{item.title}</h3>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 12,
                      background: item.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.15)' : item.status === 'PENDING' ? 'rgba(229, 179, 88, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.status === 'APPROVED' ? '#22c55e' : item.status === 'PENDING' ? '#e5b358' : '#ef4444',
                      border: `1px solid ${item.status === 'APPROVED' ? '#22c55e' : item.status === 'PENDING' ? '#e5b358' : '#ef4444'}`
                    }}
                  >
                    {item.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#9292a0', marginTop: '0.2rem' }}>
                  Artista: <strong style={{ color: '#fff' }}>{item.artist}</strong> · {item.type} ({item.genre})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#68687a', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                  UPC: {item.upc} | ISRC: {item.isrc} | Enviado: {item.submissionDate}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <button
                onClick={() => handlePlay(item.id, item.audioPreviewUrl)}
                style={{
                  background: playingId === item.id ? '#e5b358' : '#222230',
                  color: playingId === item.id ? '#0b0b0d' : '#e5b358',
                  border: '1px solid #e5b358',
                  padding: '0.5rem 1rem',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                {playingId === item.id ? '⏸ Pausar' : '▶ Escuchar Master'}
              </button>

              {item.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleApprove(item.id)}
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      border: '1px solid #22c55e',
                      padding: '0.5rem 0.9rem',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      padding: '0.5rem 0.9rem',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Rechazar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReleasesList;
