# 🚀 GUÍA DE INTEGRACIÓN OFICIAL: AMUSE API ➔ EAJMUSIC PLATFORM
> **Emitido por:** Dirección General / CEO  
> **Para:** Equipo Web EAJMUSIC (`WEBMUSIC`, `FRONT-2`, `BACK`)  
> **Módulo:** `integrations/amuse/`  
> **Fecha:** 2026-10-31  

---

## 🎯 1. Objetivo Estratégico
Alimentar la plataforma web de **EAJMUSIC** (`eajmusic.com`), el portal de artistas (`artist.eajmusic.com`) y el backoffice administrativo (`eaj.eajmusic.com`) consumiendo en tiempo real los lanzamientos, analíticas de streaming y división de regalías desde la infraestructura de Amuse (`https://api.amuse.io`).

---

## 🏗️ 2. Arquitectura del Pipeline de Sincronización

```
 ┌──────────────────────┐
 │     AMUSE API        │  (Upstream: Ingesta DDEX hacia Spotify, Apple, TikTok, YouTube)
 │  https://api.amuse.io│
 └──────────┬───────────┘
            │
            ▼  [AmuseApiClient] (GET /releases, GET /analytics/artist, GET /wallet)
 ┌──────────────────────┐
 │  AmuseSyncService    │  (Sincronización periódica o manual con token Bearer)
 └──────────┬───────────┘
            │
            ▼  [AmuseIngestionBridge] (Normalización de DTOs y metadatos)
 ┌────────────────────────────────────────────────────────┐
 │            EAJMUSIC PLATFORM STORAGE & CACHE           │
 │  • data/catalog_synced.json (Catálogo público)         │
 │  • data/analytics_{id}.json (Métricas de artistas)     │
 │  • PostgreSQL Database (eajmusic-api)                 │
 └──────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
 ┌──────────────────────┐       ┌──────────────────────┐
 │    eajmusic.com      │       │ artist.eajmusic.com  │
 │  • Catálogo Oficial  │       │  • Dashboard Streams │
 │  • Previews de Audio │       │  • Curva Diaria      │
 │  • Links a DSPs      │       │  • Playlist Tracker  │
 │  • Badge de Lanzam.  │       │  • Wallet ATH Móvil  │
 └──────────────────────┘       └──────────────────────┘
```

---

## 📦 3. Componentes Implementados en `WEBMUSIC/integrations/amuse/`

1. **`types.ts`:** Interfaces TypeScript estrictas basadas en la ingeniería inversa de `artist.amuse.io`:
   * `AmuseAuthCredentials`, `AmuseAuthResponse`
   * `AmuseRelease`, `AmuseTrack`, `AmuseArtist`
   * `AmuseAnalyticsSummary`, `AmuseDailyStreamPoint`, `AmusePlaylistPlacement`
   * `AmuseRoyaltyAgreement`
2. **`client.ts` (`AmuseApiClient`):** Cliente HTTP con inyección automática de headers (`acceptVersion: 5/6`, `User-Agent`, `Authorization: Bearer <token>`) y manejo de errores.
3. **`bridge.ts` (`AmuseIngestionBridge`):** Adaptador de datos que convierte la respuesta cruda de Amuse en los modelos de presentación de EAJMusic:
   * `transformToPublicCatalog()`: Genera tarjetas con portadas, ISRC, fecha formateada en español de PR y enlaces de búsqueda directa a DSPs.
   * `transformToArtistDashboard()`: Convierte streams en cifras legibles (K/M), formatea curvas diarias y detecta playlists editoriales.
4. **`syncService.ts` (`AmuseSyncService`):** Orquestador de sincronización que ejecuta la ingesta completa y almacena en caché local/disco.
5. **`mockData.ts`:** Catálogo y analíticas de muestra con el esquema idéntico de Amuse para desarrollo local inmediato sin credenciales activas.

---

## 🛠️ 4. Instrucciones de Implementación por Rol

### A. Para el Líder Web (`WEBMUSIC`)
* Coordina la inclusión del módulo `integrations/amuse/` en el build del frontend.
* Asegura que las credenciales de Amuse (`AMUSE_EMAIL`, `AMUSE_PASSWORD` o `AMUSE_API_TOKEN`) se manejen de forma segura en variables de entorno del servidor Hostinger (`.env`).

### B. Para Frontend (`FRONT-2` en `eajmusic-frontend`)
* En `artist.eajmusic.com`: Consumir el DTO `EAJArtistDashboardStats` para alimentar el componente de analíticas con Recharts.
* En `eajmusic.com`: Consumir `EAJPublicReleaseCard` en la sección `#catalogo` para renderizar dinámicamente las carátulas y enlaces de escucha.

### C. Para Backend (`BACK` en `eajmusic-api`)
* Crear el cron de sincronización en Node.js que ejecute:
  ```typescript
  import { AmuseSyncService } from './integrations/amuse';
  const sync = new AmuseSyncService(process.env.AMUSE_API_TOKEN);
  await sync.executeFullSync();
  ```
* Exponer los endpoints locales:
  * `GET /v1/catalog` ➔ Retorna `catalog_synced.json`.
  * `GET /v1/artists/:id/analytics` ➔ Retorna `analytics_{id}.json`.
  * `POST /v1/admin/sync-amuse` ➔ Dispara `sync.executeFullSync()` bajo rol SUPER_ADMIN.

---

## 🚀 5. Beneficios para EAJMUSIC
* **Cero Carga Manual:** Los lanzamientos aprobados en Amuse aparecen automáticamente en el sitio web de EAJMusic.
* **Métricas Reales en Vivo:** Los artistas independientes ven sus reproducciones y colocaciones en playlists directamente en su panel de EAJMusic.
* **Monetización Local:** Combinar las regalías recolectadas con la liquidación directa mediante **ATH Móvil Business** en Puerto Rico.
