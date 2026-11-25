# 🏛️ ARQUITECTURA TÉCNICA & MAPEO DE ENDPOINTS — EAJ MUSIC
> **Documento Rector emitido por el Líder del Equipo Web (`WEBMUSIC`)**  
> **Aprobado para:** Gerencia EAJMUSIC & CEO  
> **Equipos Ejecutores:** FRONT-2, BACK, IOS-2, ANDROID  
> **Base de Referencia:** Benchmark de Ingeniería Inversa Amuse.io (`amuse_api_spec.md`)  
> **Fecha:** 2026-10-31  

---

## 🌐 1. Topología de Dominios & Servicios

La infraestructura de EAJ Music se divide en 3 portales frontend y un clúster central de microservicios:

```
                              ┌──────────────────────────────────┐
                              │       DNS Cloudflare Edge        │
                              └─────────────────┬────────────────┘
                                                │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
  [eajmusic.com]             [artist.eajmusic.com]             [eaj.eajmusic.com]
 Landing Comercial &          Portal del Artista DIY            Backoffice del Sello
 Catálogo Oficial             (Dashboard, Releases,            (A&R, DDEX Ingestion,
                              Analytics, Wallet ATH Móvil)      Curaduría & Splits Admin)
         │                              │                              │
         └──────────────────────────────┼──────────────────────────────┘
                                        ▼
                             [api.eajmusic.com/v1]
                        Clúster de API REST & WebSockets
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
   [PostgreSQL DB]             [Cloudflare R2 / S3]         [Pasarelas de Fondos]
   Esquema Relacional          Audio WAV/FLAC Master        • ATH Móvil Business (PR)
   (Releases, Splits, Streams) Artwork 3000x3000px          • Trolley Payouts (Global)
```

---

## 🧭 2. Mapeo Integral de Endpoints: Amuse API ➔ EAJMUSIC API

### A. Dominio de Autenticación & Usuarios (`/auth`, `/users`)
*Consumido por: `artist.eajmusic.com`, `eaj.eajmusic.com`, Apps Móviles (iOS/Android)*

| Amuse Endpoint | Endpoint Adaptado EAJMusic | Descripción & Regla de Negocio |
|---|---|---|
| `POST /auth/login/` | `POST /v1/auth/login` | Login con email/password. Retorna Access JWT (15 min) + Refresh Token seguro en cookie `HttpOnly`. |
| `POST /auth/logout/` | `POST /v1/auth/logout` | Revocación de sesión en Redis. |
| `POST /auth/reset` | `POST /v1/auth/password-reset-request` | Envío de token OTP para cambio de contraseña. |
| `POST /users/google/` | `POST /v1/auth/oauth/google` | Autenticación federada con Google. |
| `POST /users/apple/` | `POST /v1/auth/oauth/apple` | Autenticación federada con Apple Sign-In (crítico para iOS-2). |
| `GET /users/me/` | `GET /v1/users/me` | Retorna perfil, plan activo (`free`, `pro_artist`, `label_plus`), número ATH Móvil verificado y rol. |
| `GET /users/main-artist-profile/` | `GET /v1/users/me/primary-artist` | Obtiene el perfil de artista predeterminado del usuario. |

---

### B. Dominio de Artistas & Equipos (`/artists`)
*Consumido por: `artist.eajmusic.com` (Gestión multi-artista según plan)*

| Amuse Endpoint | Endpoint Adaptado EAJMusic | Descripción & Regla de Negocio |
|---|---|---|
| `GET /artists/` | `GET /v1/artists` | Lista de artistas gestionados (Plan Free: 1 max; Pro: ilimitado; Label Plus: multi-perfil con managers). |
| `GET /artists/{id}/` | `GET /v1/artists/{id}` | Perfil público: Spotify URI, Apple Artist ID, biografía, foto y códigos ISRC asignados. |
| `POST /artists/{id}/activate/` | `POST /v1/artists` | Creación/activación de nuevo alias artístico. |
| `GET /artists/{id}/team/` | `GET /v1/artists/{id}/collaborators` | Gestión de accesos para productores, co-autores y managers. |

---

### C. Dominio de Lanzamientos & Entregas DDEX (`/releases`)
*Consumido por: `artist.eajmusic.com` (Creación) y `eaj.eajmusic.com` (Aprobación & Entrega)*

| Amuse Endpoint | Endpoint Adaptado EAJMusic | Especificación Técnica EAJMUSIC |
|---|---|---|
| `GET /releases/` | `GET /v1/releases` | Filtro por estado: `draft`, `in_review`, `approved`, `delivered`, `taken_down`. |
| `POST /releases/new` | `POST /v1/releases` | Inicia borrador con tipo: `single`, `ep`, `album`. Genera UUID y reservación de UPC. |
| `POST /releases/{id}/cover-art/` | `PUT /v1/releases/{id}/artwork` | Carga de portada a Cloudflare R2 con validación: 3000x3000px exacto, formato JPG/PNG, espacio de color sRGB, sin textos publicitarios. |
| `POST /releases/{id}/song-order/` | `PUT /v1/releases/{id}/tracks` | Array de canciones: archivo WAV (24-bit/44.1kHz mín), título, versión, autores, género y código ISRC (asignado automáticamente con prefijo EAJ si no tiene uno). |
| `GET /releases/{id}/stores/` | `GET /v1/stores` | Lista de DSPs soportados (+150 incluyendo Spotify, Apple Music, YouTube Music, TikTok, Instagram, Deezer, Tidal, Amazon). |
| `POST /releases/{id}/delivery-options/` | `PUT /v1/releases/{id}/schedule` | Ventana de lanzamiento: Estreno estándar (14 días para pitch editorial en Spotify for Artists) o lanzamiento express (Pro Artist: 48-72h). |
| `POST /releases/{id}/validate/` | `POST /v1/releases/{id}/validate-ddex` | Motor de validación semántica DDEX ERN 4.3 antes de envío. |
| `POST /releases/{id}/submit/` | `POST /v1/releases/{id}/submit` | Envío a la mesa curatorial en `eaj.eajmusic.com` para revisión final. |
| `POST /releases/{id}/takedown/` | `POST /v1/releases/{id}/takedown` | Solicitud de baja de tiendas digitales. |

---

### D. Dominio de Analíticas de Streaming (`/analytics`)
*Consumido por: `artist.eajmusic.com` y Apps Móviles*

| Amuse Endpoint | Endpoint Adaptado EAJMusic | Funcionalidad |
|---|---|---|
| `GET /analytics/artist/{id}/summary` | `GET /v1/analytics/artists/{id}/kpis` | Métricas maestras: total de reproducciones, oyentes mensuales, guardados (*saves*) y playlists activas. |
| `GET /analytics/artist/{id}/daily` | `GET /v1/analytics/artists/{id}/timeline` | Gráfico de series temporales de streams (filtros: 7d, 28d, 90d, 365d, todo el tiempo). |
| `GET /analytics/artist/{id}/countries` | `GET /v1/analytics/artists/{id}/geo` | Desglose por países (resaltando Puerto Rico, USA, Latinoamérica y España) y ciudades clave. |
| `GET /analytics/artist/{id}/playlists` | `GET /v1/analytics/artists/{id}/playlists` | Detección de playlists editoriales (*Today's Top Hits*, *Viva Latino*, *Trap Latino*) y algorítmicas (*Discover Weekly*). |
| `GET /analytics/artist/{id}/track/{tid}/ugc/daily` | `GET /v1/analytics/tracks/{id}/virality` | Detección de reproducciones virales en TikTok, Instagram Reels y YouTube Shorts vía Content ID. |

---

### E. Billetera, Splits de Regalías & Payouts Híbridos (`/wallet`, `/payouts`)
*La joya de la corona de EAJ Music: 100% de regalías con cobro express por ATH Móvil en Puerto Rico y Trolley para el resto del mundo.*

| Amuse Endpoint | Endpoint Adaptado EAJMusic | Regla de Negocio EAJ Music |
|---|---|---|
| `GET /wallet/agreements/` | `GET /v1/splits/agreements` | Contratos de división de ingresos por track entre artistas, compositores, productores y el sello. |
| `POST /wallet/agreements/` | `POST /v1/splits/agreements` | Creación de split: suma obligatoria del 100%, con invitaciones automáticas por email para aceptación legal. |
| `GET /wallet/user/` | `GET /v1/wallet/balance` | Balance actual disponible, saldo en tránsito y balance histórico en USD ($). |
| `GET /wallet/user/statements/` | `GET /v1/wallet/statements` | Reportes contables mensuales descargables en PDF y CSV desglosados por DSP. |
| **Integración ATH Móvil Directa** | `POST /v1/payouts/ath-movil/request` | **Exclusivo EAJMUSIC:** Retiro de regalías directo a número de teléfono en Puerto Rico (`+1 787`/`+1 939`) sin comisión de retiro (0%) y acreditación en menos de 24 horas. |
| `POST /payouts/trolley/url/` | `POST /v1/payouts/trolley/widget` | Onboarding de cuenta bancaria o PayPal internacional para beneficiarios fuera de Puerto Rico. |
| `GET /payouts/ffwd/` | `GET /v1/royalties/advances` | Sistema de adelantos fonográficos automáticos (*Fast Forward*) calculados según la tasa de streaming proyectada. |

---

## 🚀 3. Asignación de Tareas Inmediatas

### 1. FRONT-2 (Desarrollo Frontend)
* Implementar en `artist.eajmusic.com`:
  1. **Wizard de Creación de Lanzamientos:** Flujo paso a paso (Metadatos ➔ Audio WAV ➔ Cover Art ➔ Stores ➔ Splits).
  2. **Dashboard de Analíticas:** Gráficas en SVG/Canvas de streams diarios, mapa de calor geográfico y top de canciones.
  3. **Módulo de Billetera con ATH Móvil:** Selector de método de pago con card destacada de ATH Móvil (input de número, verificación de titular y botón de retiro instantáneo).

### 2. BACK (Desarrollo Backend)
* Implementar en `api.eajmusic.com`:
  1. Base de datos con tablas: `users`, `artists`, `releases`, `tracks`, `splits`, `streaming_daily_kpis`, `payout_requests`.
  2. Microservicio de validación DDEX y conexión S3/R2 para audio sin compresión.
  3. Adaptador de pasarela doble: ATH Móvil Business API (local) + Trolley API (internacional).
