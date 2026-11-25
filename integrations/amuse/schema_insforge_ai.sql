-- ==============================================================================
-- EAJMUSIC — AI DATABASE SCHEMA (InsForge & Supabase Engine)
-- Diseñado para almacenamiento de Catálogo, Analíticas e Inteligencia Artificial
-- ==============================================================================

-- 1. Habilitar extensión de Vectores para IA (Recomendaciones y Semántica Musical)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Artistas
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amuse_artist_id VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    spotify_uri VARCHAR(255),
    apple_music_id VARCHAR(255),
    avatar_url TEXT,
    bio TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ai_profile_embedding vector(1536), -- Vector para análisis de estilo musical por IA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Lanzamientos (Releases)
CREATE TABLE IF NOT EXISTS releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amuse_release_id VARCHAR(100) UNIQUE,
    artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'SINGLE', -- SINGLE, EP, ALBUM
    upc VARCHAR(50),
    status VARCHAR(50) DEFAULT 'LIVE',  -- LIVE, PENDING, TAKEDOWN
    release_date DATE NOT NULL,
    cover_art_url TEXT,
    spotify_url TEXT,
    apple_music_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Pistas (Tracks)
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amuse_track_id VARCHAR(100) UNIQUE,
    release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    isrc VARCHAR(50),
    track_number INT DEFAULT 1,
    duration_seconds INT DEFAULT 0,
    preview_url TEXT,
    audio_url TEXT,
    status VARCHAR(50) DEFAULT 'READY',
    ai_audio_embedding vector(1536), -- Embedding de timbre y tempo generado por IA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de Analíticas y Reproducciones (Streaming Stats)
CREATE TABLE IF NOT EXISTS streaming_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    dsp_id VARCHAR(50) NOT NULL,        -- 'spotify', 'apple_music', 'tiktok', etc.
    date DATE NOT NULL,
    country_code VARCHAR(10) DEFAULT 'GLOBAL',
    streams BIGINT DEFAULT 0,
    saves BIGINT DEFAULT 0,
    playlist_adds BIGINT DEFAULT 0,
    revenue_gross NUMERIC(12, 4) DEFAULT 0.0000,
    revenue_net NUMERIC(12, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(track_id, dsp_id, date, country_code)
);

-- 6. Índices de Búsqueda Rápida para el Portal Web y la App
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_date ON releases(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_release ON tracks(release_id);
CREATE INDEX IF NOT EXISTS idx_stats_track_date ON streaming_stats(track_id, date DESC);

-- 7. Políticas de Seguridad RLS (Row Level Security) para acceso público y de artistas
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_stats ENABLE ROW LEVEL SECURITY;

-- Acceso de lectura público para la Web de EAJMUSIC
CREATE POLICY "Lectura pública de lanzamientos activos" 
ON releases FOR SELECT 
USING (status = 'LIVE');

CREATE POLICY "Lectura pública de tracks" 
ON tracks FOR SELECT 
USING (true);

CREATE POLICY "Lectura pública de perfiles de artistas" 
ON artists FOR SELECT 
USING (true);
