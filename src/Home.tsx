import React, { useState, useEffect, useRef } from 'react';
import catalogData from '../data/catalog_synced.json';

interface Track {
  id: string;
  title: string;
  isrc: string;
  track_number: number;
  duration_seconds: number;
  preview_url: string;
  freq?: number;
  status: string;
}

interface Release {
  id: string;
  title: string;
  artist?: string;
  type: string;
  upc: string;
  status: string;
  release_date: string;
  cover_art_url: string;
  genre: string;
  category?: string;
  label_name: string;
  plan?: string;
  stores?: {
    spotify?: { url: string };
    apple_music?: { url: string };
  };
  tracks: Track[];
}

export const Home: React.FC = () => {
  const [releases, setReleases] = useState<Release[]>(catalogData as Release[]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Flattened track list for the audio player
  const [flatTracks, setFlatTracks] = useState<any[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const isSynthModeRef = useRef<boolean>(false);

  useEffect(() => {
    const list: any[] = [];
    releases.forEach((rel) => {
      rel.tracks.forEach((trk) => {
        list.push({
          id: trk.id,
          title: trk.title,
          artist: rel.artist || 'EAJ Music Artist',
          releaseTitle: rel.title,
          coverArt: rel.cover_art_url,
          duration: trk.duration_seconds,
          previewUrl: trk.preview_url,
          freq: trk.freq || 220,
          category: rel.category || (rel.type === 'ep' ? 'ep' : 'urbano'),
          spotifyUrl: rel.stores?.spotify?.url || '#',
          appleUrl: rel.stores?.apple_music?.url || '#'
        });
      });
    });
    setFlatTracks(list);
  }, [releases]);

  // Web Audio Synth Fallback
  const startSynth = (freq: number) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      stopSynth();
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq || 220, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtxRef.current.currentTime);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      oscRef.current = osc;
      isSynthModeRef.current = true;
    } catch (e) {
      console.warn('Web Audio no disponible directamente sin interacción previa');
    }
  };

  const stopSynth = () => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch (e) {}
      oscRef.current = null;
    }
    isSynthModeRef.current = false;
  };

  const handlePlayTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);

    const track = flatTracks[index];
    if (track && track.previewUrl && track.previewUrl.startsWith('http')) {
      if (!audioRef.current) {
        audioRef.current = new Audio(track.previewUrl);
      } else {
        audioRef.current.src = track.previewUrl;
      }

      audioRef.current
        .play()
        .then(() => {
          isSynthModeRef.current = false;
        })
        .catch((err) => {
          console.warn('Fallback a Web Audio Synth por CORS/Restricción de Audio:', err);
          startSynth(track.freq);
        });
    } else {
      startSynth(track?.freq || 220);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) audioRef.current.pause();
      stopSynth();
    } else {
      handlePlayTrack(currentTrackIndex);
    }
  };

  const handleNext = () => {
    const nextIdx = (currentTrackIndex + 1) % flatTracks.length;
    handlePlayTrack(nextIdx);
  };

  const handlePrev = () => {
    const prevIdx = (currentTrackIndex - 1 + flatTracks.length) % flatTracks.length;
    handlePlayTrack(prevIdx);
  };

  // Timer interval for playback
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (!isSynthModeRef.current && audioRef.current && !audioRef.current.paused) {
          setCurrentTime(Math.floor(audioRef.current.currentTime));
        } else {
          setCurrentTime((prev) => {
            const currentTrack = flatTracks[currentTrackIndex];
            if (currentTrack && prev >= currentTrack.duration) {
              handleNext();
              return 0;
            }
            return prev + 1;
          });
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackIndex, flatTracks]);

  const filteredReleases = releases.filter((rel) => {
    if (selectedFilter === 'all') return true;
    const cat = rel.category || (rel.type === 'ep' ? 'ep' : 'urbano');
    return cat === selectedFilter;
  });

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentTrack = flatTracks[currentTrackIndex] || {
    title: 'Neon Horizons',
    artist: 'Kaelo & EAJ Collective',
    duration: 214,
    coverArt: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'
  };

  return (
    <div style={{ backgroundColor: '#0b0b0d', color: '#f4f4f6', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', textDecoration: 'none', color: '#fff' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#18181e', border: '1px solid #e5b358', color: '#e5b358', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'Cinzel, serif', boxShadow: '0 0 15px rgba(229, 179, 88, 0.28)' }}>
            EAJ
          </div>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', fontWeight: 700, letterSpacing: 2 }}>EAJ MUSIC</span>
        </a>

        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="#ath-movil" style={{ color: '#9595a2', textDecoration: 'none', fontSize: '0.88rem' }}>ATH Móvil 🇵🇷</a>
          <a href="#planes" style={{ color: '#9595a2', textDecoration: 'none', fontSize: '0.88rem' }}>Planes</a>
          <a href="#catalogo" style={{ color: '#9595a2', textDecoration: 'none', fontSize: '0.88rem' }}>Catálogo</a>
          <a href="#circuito" style={{ color: '#9595a2', textDecoration: 'none', fontSize: '0.88rem' }}>Circuito 360°</a>
        </nav>

        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
          <a href="https://artist.eajmusic.com" style={{ background: '#181820', color: '#fff', border: '1px solid rgba(229, 179, 88, 0.4)', padding: '0.55rem 1.25rem', borderRadius: 8, fontWeight: 600, fontSize: '0.86rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}></span>
            Artist Portal
          </a>
          <a href="/admin" style={{ background: 'linear-gradient(135deg, #e5b358, #b88a36)', color: '#0b0b0d', padding: '0.6rem 1.35rem', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
            Admin Sello
          </a>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1140, margin: '3.5rem auto 5rem', padding: '0 1.5rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 2, color: '#e5b358', background: 'rgba(229, 179, 88, 0.1)', border: '1px solid rgba(229, 179, 88, 0.25)', padding: '0.4rem 1.15rem', borderRadius: 30, marginBottom: '1.5rem' }}>
          <span>Tu catálogo, en tu bolsillo</span>
          <span style={{ background: '#ff5000', color: '#fff', fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 10 }}>ATH MÓVIL DIRECTO</span>
        </div>
        <h1 style={{ fontSize: '3.4rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.5rem' }}>
          Lanza tu música al mundo.<br />
          <span style={{ background: 'linear-gradient(135deg, #ffffff 30%, #e5b358 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Cobra tus regalías directo por ATH Móvil.
          </span>
        </h1>
        <p style={{ fontSize: '1.15rem', color: '#9595a2', maxWidth: 720, margin: '0 auto 2.5rem' }}>
          La plataforma discográfica y de distribución para artistas independientes en Puerto Rico. 100% de tus regalías, sin comisiones ocultas y con retiro instantáneo en tu cuenta local.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#e2e2e8' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓</span> 100% Regalías Fonográficas
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#e2e2e8' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓</span> Retiro Express por ATH Móvil
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#e2e2e8' }}>
            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✓</span> Catálogo Oficial Sincronizado
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem' }}>
          <a href="https://artist.eajmusic.com" style={{ background: 'linear-gradient(135deg, #e5b358, #b88a36)', color: '#0b0b0d', padding: '0.75rem 1.6rem', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
            Entrar a artist.eajmusic.com
          </a>
          <a href="#catalogo" style={{ background: 'transparent', color: '#f4f4f6', border: '1px solid #24242c', padding: '0.75rem 1.6rem', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            Escuchar Catálogo Sincronizado
          </a>
        </div>
      </section>

      {/* SECCIÓN CATÁLOGO SINCRONIZADO CON PREVIEW PLAYER */}
      <section id="catalogo" style={{ maxWidth: 1140, margin: '0 auto 6rem', padding: '0 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, color: '#e5b358', display: 'inline-block', marginBottom: '0.5rem' }}>
            Catálogo Oficial Conectado (data/catalog_synced.json)
          </span>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>Lanzamientos & Sencillos en Vivo</h2>
          <p style={{ color: '#9595a2', maxWidth: 580, margin: '0 auto' }}>
            Escucha los lanzamientos del sello sincronizados directamente con las tiendas de streaming.
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
          {['all', 'urbano', 'indie', 'ep'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              style={{
                background: selectedFilter === filter ? 'rgba(229, 179, 88, 0.15)' : '#141418',
                border: selectedFilter === filter ? '1px solid #e5b358' : '1px solid #24242c',
                color: selectedFilter === filter ? '#e5b358' : '#9595a2',
                padding: '0.45rem 1.25rem',
                borderRadius: 20,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {filter === 'all' ? 'Todos los Lanzamientos' : filter.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Grid de Lanzamientos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2rem' }}>
          {filteredReleases.map((rel, relIdx) => {
            const track = rel.tracks[0];
            const trackIdx = flatTracks.findIndex((t) => t.id === track?.id);
            const isThisTrackPlaying = isPlaying && currentTrackIndex === trackIdx;

            return (
              <article key={rel.id} style={{ background: '#141418', border: '1px solid #24242c', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative', overflow: 'hidden' }}>
                  <img src={rel.cover_art_url} alt={rel.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => handlePlayTrack(trackIdx !== -1 ? trackIdx : 0)}
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      right: 12,
                      width: 46,
                      height: 46,
                      borderRadius: '50%',
                      background: '#e5b358',
                      color: '#0b0b0d',
                      border: 'none',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 15px rgba(229, 179, 88, 0.45)'
                    }}
                  >
                    {isThisTrackPlaying ? '⏸' : '▶'}
                  </button>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e5b358', textTransform: 'uppercase' }}>{rel.genre}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9595a2' }}>{rel.release_date?.split('-')[0]}</span>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.2rem' }}>{rel.title}</h3>
                  <p style={{ fontSize: '0.88rem', color: '#9595a2', marginBottom: '1rem' }}>{rel.artist || 'EAJ Collective'}</p>
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #24242c', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#e5b358', fontWeight: 600 }}>{rel.plan || 'Pro Artist'}</span>
                    <div style={{ display: 'flex', gap: '0.65rem' }}>
                      <a href={rel.stores?.spotify?.url || '#'} target="_blank" rel="noreferrer" style={{ color: '#9595a2', fontSize: '0.82rem', textDecoration: 'none' }}>Spotify</a>
                      <a href={rel.stores?.apple_music?.url || '#'} target="_blank" rel="noreferrer" style={{ color: '#9595a2', fontSize: '0.82rem', textDecoration: 'none' }}>Apple</a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* REPRODUCTOR PERSISTENTE STICKY */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(14, 14, 18, 0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(229, 179, 88, 0.4)', padding: '0.85rem 1.5rem', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 220 }}>
          <img src={currentTrack.coverArt} alt={currentTrack.title} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>{currentTrack.title}</div>
            <div style={{ fontSize: '0.78rem', color: '#9595a2' }}>{currentTrack.artist}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1, maxWidth: 600, gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <button onClick={handlePrev} style={{ background: 'transparent', border: 'none', color: '#9595a2', cursor: 'pointer', fontSize: '1.1rem' }}>⏮</button>
            <button onClick={togglePlay} style={{ width: 38, height: 38, borderRadius: '50%', background: '#e5b358', color: '#0b0b0d', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: '#9595a2', cursor: 'pointer', fontSize: '1.1rem' }}>⏭</button>
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#9595a2', minWidth: 32 }}>{formatSeconds(currentTime)}</span>
            <div style={{ flexGrow: 1, height: 4, background: '#2a2a34', borderRadius: 2, position: 'relative' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (currentTime / (currentTrack.duration || 1)) * 100)}%`, background: '#e5b358', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#9595a2', minWidth: 32 }}>{formatSeconds(currentTrack.duration || 180)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.85rem' }}>
          <a href={currentTrack.spotifyUrl} target="_blank" rel="noreferrer" style={{ color: '#9595a2', fontSize: '0.85rem', textDecoration: 'none' }}>Spotify</a>
          <a href={currentTrack.appleUrl} target="_blank" rel="noreferrer" style={{ color: '#9595a2', fontSize: '0.85rem', textDecoration: 'none' }}>Apple</a>
        </div>
      </div>
    </div>
  );
};

export default Home;
