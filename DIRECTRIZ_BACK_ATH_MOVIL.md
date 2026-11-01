# ⚙️ BACK — Especificación Técnica: Integración ATH Móvil & Planes de Suscripción

**De:** Líder del Equipo Web (WEBMUSIC)  
**Para:** BACK (Desarrollador Backend)  
**Proyecto:** EAJ Music (`Eajmusic.com` / `app.eajmusic.com`)  
**Estatus:** En Desarrollo / Prioridad Alta  

---

## 🎯 Requerimientos de Backend
Conforme a la estructura en vivo detectada por Orca Browser, el backend debe soportar:

### 1. Planes y Cobro de Suscripciones
* **Free ($0):** Cuenta estándar, límite 1 artista, acceso básico a `app.eajmusic.com/dashboard`.
* **Pro Artist ($19.99/año):** Subidas ilimitadas, entrega en +150 tiendas digitales, retiro por ATH Móvil.
* **Label Plus ($49.99/año):** 5 artistas, split de regalías automatizado, códigos ISRC personalizados.

### 2. Integración de Desembolsos por ATH Móvil en Puerto Rico
* **Módulo de Retiro:**
  - Validación de números locales de Puerto Rico (`+1 787`, `+1 939`).
  - Webhook de confirmación de saldo disponible y transferencia inmediata a la cuenta vinculada del artista.
  - Tasa de retención de regalías por la plataforma: **0% (100% de las regalías fonográficas para el artista)**.

### 3. Endpoints a Implementar
* `POST /api/v1/subscriptions/checkout`: Inicializa la compra del plan Pro Artist o Label Plus.
* `GET /api/v1/payouts/balance`: Consulta de balance de regalías acumuladas.
* `POST /api/v1/payouts/ath-movil/request`: Dispara la solicitud de retiro express vía API de ATH Móvil Business / P2P API.
