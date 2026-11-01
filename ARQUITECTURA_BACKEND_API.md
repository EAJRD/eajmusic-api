# ⚙️ BACK — ESPECIFICACIÓN DE BACKEND & BASE DE DATOS: EAJMUSIC API
> **De:** Líder del Equipo Web (`WEBMUSIC`)  
> **Para:** BACK (Desarrollador Backend)  
> **Proyecto:** API de Distribución, Releases, Analíticas & Payouts EAJMUSIC  
> **Base de Referencia:** Benchmark Amuse.io Artist API (`amuse_api_spec.md`)  
> **Fecha:** 2026-10-31  

---

## 🎯 1. Misión de Backend
Debes construir y exponer los servicios REST/JSON de `https://api.eajmusic.com/v1` para dar soporte a los tres portales:
1. `eajmusic.com` (Comercial, planes y recepción de demos)
2. `artist.eajmusic.com` (Portal del artista DIY)
3. `eaj.eajmusic.com` (Backoffice administrativo del sello)

---

## 🗄️ 2. Modelo Relacional de Datos (PostgreSQL)

Debes estructurar el esquema en torno a las siguientes entidades clave:

```sql
-- Usuarios del sistema
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'artist', -- 'artist', 'manager', 'label_admin', 'curator'
    plan VARCHAR(50) DEFAULT 'free',   -- 'free', 'pro_artist', 'label_plus'
    ath_movil_number VARCHAR(20),      -- Formato E.164 (+1787xxxxxxx)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Perfiles Artísticos
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    spotify_uri VARCHAR(255),
    apple_music_id VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lanzamientos (Releases)
CREATE TABLE releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'single', 'ep', 'album'
    upc VARCHAR(20) UNIQUE,
    artwork_url TEXT,
    label_name VARCHAR(255) DEFAULT 'EAJ Music',
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'in_review', 'approved', 'delivered', 'taken_down'
    release_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Canciones (Tracks)
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    version VARCHAR(100), -- 'Original', 'Remix', etc.
    isrc VARCHAR(20) UNIQUE,
    audio_wav_url TEXT NOT NULL,
    duration_seconds INT NOT NULL,
    explicit_content BOOLEAN DEFAULT FALSE,
    track_order INT NOT NULL
);

-- Acuerdos de Royalty Splits
CREATE TABLE split_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    collaborator_email VARCHAR(255) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL, -- Ej: 50.00
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Solicitudes de Pago (Payouts)
CREATE TABLE payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount_usd DECIMAL(10,2) NOT NULL,
    gateway VARCHAR(50) NOT NULL, -- 'ath_movil', 'trolley', 'ach'
    destination_account VARCHAR(100) NOT NULL, -- Número de teléfono ATH o Trolley Recipient ID
    status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔌 3. Endpoints Críticos a Implementar en `api.eajmusic.com/v1`

1. **Autenticación JWT:**
   - `POST /v1/auth/login`, `POST /v1/auth/register`, `POST /v1/auth/oauth/google`, `POST /v1/auth/oauth/apple`.
2. **Releases & Storage:**
   - `POST /v1/releases` (Crea draft).
   - `PUT /v1/releases/{id}/artwork` (Upload presignado a Cloudflare R2 con validación estricta 3000x3000px).
   - `PUT /v1/releases/{id}/tracks` (Upload multipart de archivo WAV/FLAC y generación de ISRC con código de sello asignado).
   - `POST /v1/releases/{id}/submit` (Cambia estado a `in_review` para el backoffice en `eaj.eajmusic.com`).
3. **Analíticas de Streaming:**
   - `GET /v1/analytics/artists/{id}/kpis`, `GET /v1/analytics/artists/{id}/timeline`, `GET /v1/analytics/artists/{id}/geo`.
   - Ingesta de reportes diarios de DSPs en background (Spotify for Developers, Apple Music API).
4. **Billetera & Liquidación de Fondos:**
   - `GET /v1/wallet/balance`: Suma de streams devengados menos retiros.
   - `POST /v1/payouts/ath-movil/request`: Dispersión de fondos a través de webhook seguro de **ATH Móvil Business**.
   - `POST /v1/payouts/trolley/widget`: Generación de token de sesión para el iframe seguro de Trolley.

Documenta tus esquemas en OpenAPI / Swagger y coordina con `FRONT-2` los payloads exactos.
