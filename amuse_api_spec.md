# 🎧 AMUSE.IO ARTIST API SPECIFICATION & BENCHMARK
> **Documento Técnico para el Equipo de Desarrollo de EAJMUSIC (`WEBMUSIC`)**
> **Fuente:** Ingeniería Inversa del Portal de Artistas `artist.amuse.io`
> **Base URL:** `https://api.amuse.io` | **Promo API:** `https://promo-api.amuse.io/api`
> **Fecha de Extracción:** 2026-10-31 | **Autor:** Dirección Técnica EAJ / CEO

---

## 🧭 1. Resumen Ejecutivo
Para el desarrollo de la plataforma independiente **EAJMUSIC** (`eajmusic.com`, `artist.eajmusic.com` y `eaj.eajmusic.com`), el ecosistema de Amuse representa el estándar de la industria en distribución musical DIY, analíticas en tiempo real y división automatizada de regalías (*royalties split*).

---

## 🔐 2. Autenticación & Cuentas

### Endpoints
* `POST /auth/login/` — Inicio de sesión con credenciales directas.
* `POST /auth/logout/` — Invalidación de sesión / tokens JWT.
* `POST /auth/reset` — Solicitud de restablecimiento de contraseña.
* `POST /users/check-email` — Comprobación de disponibilidad de correo previo al registro.
* `POST /users/send_verification_email/` — Reenvío de confirmación de email.
* `POST /users/password_reset/` — Confirmación de nueva clave.
* `POST /users/google/` — Autenticación federada con Google OAuth.
* `POST /users/apple/` — Autenticación federada con Apple Sign-In.
* `GET /users/me/` — Datos del usuario autenticado, roles y contexto de cuenta.
* `GET /users/{userId}/` — Perfil extendido del usuario.
* `GET /users/main-artist-profile/` — Perfil artístico principal asignado al usuario.
* `DELETE /users/delete/` — Baja de cuenta cumpliendo con RGPD.

---

## 🎤 3. Artistas & Perfiles

### Endpoints
* `GET /artists/` — Lista de artistas vinculados a la cuenta.
* `GET /artists/{artistId}/` — Ficha técnica del artista (nombre, Spotify URI, Apple ID, avatar).
* `POST /artists/{artistId}/activate/` — Activación de nuevo artista en catálogo.
* `GET /artists/{artistId}/team/` — Miembros con acceso al perfil artístico (managers, editores).
* `GET /artists/{artistId}/external_albums` — Álbumes ya distribuidos en plataformas para reclamar o mapear.
* `GET /artists/{artistId}/related` — Artistas colaboradores frecuentes.

---

## 💿 4. Distribución de Lanzamientos (Releases)

### Endpoints
* `GET /releases/?artist_id={id}&status={status}` — Listado de lanzamientos con filtros (`draft`, `pending`, `released`, `taken_down`).
* `POST /releases/new` — Inicio de nuevo borrador de lanzamiento (Single, EP o Álbum).
* `GET /releases/{releaseId}/` — Detalle completo del release.
* `POST /releases/{releaseId}/cover-art/` — Carga y validación de portada (3000x3000px, RGB, JPG/PNG).
* `POST /releases/{releaseId}/song-order/` — Orden secuencial de tracks y datos de audio WAV/FLAC.
* `GET /releases/{releaseId}/stores/` — Selección de DSPs (Spotify, Apple Music, TikTok, YouTube Music, etc.).
* `GET /releases/{releaseId}/store-delivery-statuses/` — Estatus de ingesta por tienda (DDEX enviado, procesando, en vivo).
* `POST /releases/{releaseId}/delivery-options/` — Ventanas de estreno, pre-order y horario global.
* `POST /releases/{releaseId}/excluded-countries/` — Restricciones territoriales de distribución.
* `POST /releases/{releaseId}/licensee/` — Metadatos de copyright (Línea C/P, sello fonográfico / label name).
* `POST /releases/{releaseId}/validate/` — Validación estricta de metadatos según normas DDEX/Apple Style Guide.
* `POST /releases/{releaseId}/submit/` — Envío definitivo a curaduría y entrega a DSPs.
* `POST /releases/{releaseId}/reset-to-draft/` — Reversión a borrador antes de entrega.
* `POST /releases/{releaseId}/takedown/` — Solicitud de baja de tiendas.
* `POST /releases/import/` — Importación de catálogo existente vía códigos UPC e ISRC.

---

## 📊 5. Analíticas de Reproducción (Streaming Analytics)

### Endpoints a Nivel Artista
* `GET /analytics/artist/{artistId}/summary` — Totales de reproducciones, oyentes únicos y guardados.
* `GET /analytics/artist/{artistId}/daily` — Curva temporal diaria de streams.
* `GET /analytics/artist/{artistId}/countries` — Distribución geográfica por países y ciudades.
* `GET /analytics/artist/{artistId}/playlists?offset=0&limit=50` — Playlists editoriales y de usuario donde está presente.
* `GET /analytics/artist/{artistId}/releases` — Desglose comparativo por lanzamiento.
* `GET /analytics/artist/{artistId}/tracks` — Desglose de streams por pista individual.
* `GET /analytics/artist/{artistId}/share` — Generación de tarjetas de analítica para compartir en redes.

### Endpoints a Nivel Track
* `GET /analytics/artist/{artistId}/track/{trackId}/summary` — Desempeño total de la pista.
* `GET /analytics/artist/{artistId}/track/{trackId}/daily` — Evolución diaria.
* `GET /analytics/artist/{artistId}/track/{trackId}/countries` — Mapa de calor geográfico de la pista.
* `GET /analytics/artist/{artistId}/track/{trackId}/playlists` — Entradas y salidas de playlists para este track.
* `GET /analytics/artist/{artistId}/track/{trackId}/ugc/daily` — Reproducciones en contenido generado por usuarios (TikTok / Instagram Reels / YouTube Shorts).
* `GET /analytics/artist/{artistId}/track/{trackId}/ugc/cid/summary` — Detección por Content ID.

---

## 💰 6. Billetera, Splits & Liquidación de Regalías

### Contratos de División (Royalty Splits)
* `GET /wallet/agreements/` — Lista de acuerdos de splits entre artistas, productores y sello.
* `GET /wallet/agreements/{agreementId}/` — Porcentajes pactados por track/álbum.
* `GET /wallet/agreements/{agreementId}/royalties/` — Fondos generados por el acuerdo.
* `GET /wallet/agreements/{agreementId}/statements/` — Reportes contables mensuales desglosados por DSP.
* `GET /wallet/agreements/{agreementId}/transactions/` — Historial de transacciones.
* `POST /wallet/agreements/{agreementId}/withdrawals/` — Retiro de fondos acumulados.

### Billetera del Usuario
* `GET /wallet/user/` — Saldo disponible, saldo pendiente y divisa base.
* `GET /wallet/user/royalties/` — Histórico de ingresos brutos y netos.
* `GET /wallet/user/transactions/` — Movimientos contables.

### Pasarelas de Pago & Adelantos
* `GET /payouts/overview/` — Resumen de cobros.
* `GET /payouts/summary/` — Totales anuales para efectos fiscales.
* `POST /payouts/payment/` — Ejecución de pago hacia cuenta bancaria o PayPal.
* `GET /payouts/transfer-method/` — Métodos de cobro vinculados.
* `GET /payouts/ffwd/` — Sistema de adelantos algorítmicos (*Fast Forward / FFWD*) basado en analíticas predictivas de streaming.
* Integración con pasarela de pagos internacionales **Trolley**:
  * `/payouts/trolley/url/` (Widget seguro de onboarding bancario).
  * `/payouts/trolley/recipients/` (Gestión de beneficiarios).
  * `/payouts/trolley/payout/request/` (Solicitud de dispersión de fondos).

---

## 🎯 7. Mapeo para EAJMUSIC
El equipo web (`WEBMUSIC`) debe utilizar este contrato para:
1. **Frontend de Artista (`artist.eajmusic.com`):** Implementar la carga de catálogo y visualización de analíticas basadas en este mismo esquema.
2. **Backend EAJMusic (`eajmusic-api`):** Asegurar que las tablas de base de datos soporten las relaciones de `releases`, `splits`, `analytics` y `takedowns` idénticas a esta especificación.
3. **Módulo de Pagos de Puerto Rico:** Adaptar los payouts de Trolley para combinarlos con **ATH Móvil Business** y transferencias ACH en dólares estadounidenses.
