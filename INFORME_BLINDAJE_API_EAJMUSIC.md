# 🛡️ INFORME DE SEGURIDAD Y BLINDAJE: EAJMUSIC API REST
**Para:** Coordinador & Flota Hermes  
**De:** Dispatched Worker (`shrimp` / `security-blindar-api-eajmusic`)  
**Fecha:** 2026-11-24  
**Prioridad:** P0 (Blindaje de Infraestructura y Producción)  
**Estado:** ✅ IMPLEMENTADO Y CERTIFICADO (27/27 Tests Aprobados)  

---

## 1. Estado Antes (Riesgos y Vulnerabilidades Encontradas)

Durante la auditoría inicial de `src/server.js` y la revisión cruzada con los incidentes de red reportados por QA (`elephantfish/qa_certification_report.md`), se identificaron 5 vulnerabilidades críticas:

1. **CORS Inseguro y Rotura de Preflight con Credenciales (P0):**
   - El servidor utilizaba `res.setHeader('Access-Control-Allow-Origin', '*')`.
   - De acuerdo a las especificaciones W3C/Fetch y OWASP, el navegador rechaza tajantemente el comodín `*` cuando se envían peticiones con credenciales (`credentials: 'include'`) o cabeceras de autorización (`Authorization: Bearer ...`).
   - Esto provocaba que `https://artist.eajmusic.com` y `https://eaj.eajmusic.com` sufrieran errores de consola `net::ERR_FAILED: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present`.
   - No existía validación de orígenes ni cabecera `Vary: Origin`.

2. **Ausencia Total de Rate Limiting (P0):**
   - No había ningún mecanismo de limitación de tasa por IP.
   - El API era vulnerable a ataques de denegación de servicio (DoS), scraping no controlado y ataques de fuerza bruta en `/v1/auth/login`, `/auth/sync-insforge-user` y `/v1/auth/2fa/verify`.

3. **Endpoint Crítico `/api/releases` Roto con 404 (P0):**
   - El enrutador solo escuchaba `/v1/releases` y `/api/v1/releases`.
   - Cualquier petición directa de los clientes web a `/api/releases` o `/releases` recibía un código `404 Not Found`.

4. **Falta de Validación de Conectividad PostgreSQL en `/health` (P1):**
   - El endpoint `/health` solo reportaba el estado de InsForge.
   - No validaba el pool de conexiones a la base de datos relacional PostgreSQL, ni reportaba latencias, timeouts ni disponibilidad.

5. **Riesgo de Caída del Proceso por Errores de Base de Datos (P1):**
   - No existía manejo de eventos `error` en clientes inactivos del pool, lo cual ante una desconexión o reinicio de PostgreSQL generaba una excepción no capturada (`unhandled error event`) terminando el proceso Node.js.

---

## 2. Cambios Realizados (Archivos y Líneas)

Todos los cambios se implementaron siguiendo la metodología **ub-mode** (primero reproducir con tests fallidos, luego aplicar cambios mínimos y desacoplados).

### A. Módulo de Seguridad CORS (`src/security/cors.js` - Nuevo, 78 líneas)
- **Lista blanca estricta:** Implementación de expresiones regulares que permiten exclusivamente:
  - `https://artist.eajmusic.com`, `http://artist.eajmusic.com` y sus variantes `www`.
  - `https://eaj.eajmusic.com`, `http://eaj.eajmusic.com` y sus variantes `www`.
  - `https://api-api.eajmusic.com` y `https://api.eajmusic.com`.
  - Orígenes locales de desarrollo (`localhost`, `127.0.0.1`).
- **Eliminación del Wildcard:** Bloqueo absoluto de `*`. Si el origen es válido, se refleja dinámicamente el origen exacto (`Access-Control-Allow-Origin: <origin>`).
- **Preflight `OPTIONS`:** Responde `204 No Content` con `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS` y cache `Access-Control-Max-Age: 86400`. Si el origen es desconocido/malicioso, se rechaza con `403 Forbidden`.

### B. Módulo de Rate Limiting (`src/security/rateLimiter.js` - Nuevo, 98 líneas)
- **Límite base:** 100 peticiones por minuto por IP (configurable mediante `RATE_LIMIT_MAX` y `RATE_LIMIT_WINDOW_MS`).
- **Detección de IP confiable:** Inspecciona `cf-connecting-ip`, `x-forwarded-for` (primer cliente), `x-real-ip` y `socket.remoteAddress`.
- **Cabeceras estándar inyectadas:** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (IETF) y `X-RateLimit-*`.
- **Respuesta 429:** Al exceder el umbral, responde `429 Too Many Requests` con cabecera `Retry-After: <segundos>` y JSON descriptivo.
- **Gestión de memoria:** Tarea periódica de limpieza de IPs inactivas para evitar fugas de memoria.

### C. Módulo de PostgreSQL Pool & Conectividad (`src/db/postgres.js` - Nuevo, 137 líneas)
- **Pool Robusto:** Configurado con límites de seguridad:
  - `max`: 10 conexiones simultáneas.
  - `min`: 2 conexiones base.
  - `idleTimeoutMillis`: 30,000 ms (30s).
  - `connectionTimeoutMillis`: 5,000 ms (5s).
  - `statementTimeoutMillis`: 10,000 ms (10s).
- **Auto-recuperación:** Listener `pool.on('error')` para manejar desconexiones sin tumbar el servidor.
- **Diagnóstico y Health Check (`checkPostgresHealth`):** Ejecuta `SELECT 1 AS healthy, NOW() AS server_time`. Reporta latencia en milisegundos, conexiones activas, inactivas y en espera.
- **Failover Resiliente (`getReleasesFromDB`):** Intenta consultar la tabla `releases`. Si la base de datos relacional no está lista o no tiene la tabla, commuta automáticamente y sin errores al catálogo sincronizado (`catalog_synced.json`).

### D. Integración en el Servidor (`src/server.js`)
- **Líneas 10–15:** Importación de funciones de `cors.js`, `rateLimiter.js` y `postgres.js`.
- **Líneas 259–272:** Adaptación de `setCorsHeaders` y `sendJson` para reflejar el origen verificado y añadir cabeceras seguras.
- **Líneas 274–287:** Interceptores de inicio en `http.createServer`:
  - Manejo de preflight `OPTIONS` con `handleCorsPreflight(req, res)`.
  - Aplicación de CORS para toda petición con `applyCorsHeaders(req, res)`.
  - Control de flujo de tasa con `checkRateLimit(req, res)`.
- **Líneas 290–317:** Enriquecimiento de `/health` (y `/api/health`, `/v1/health`) retornando el diagnóstico completo de PostgreSQL, Rate Limiting y CORS.
- **Líneas 573–605:** Ampliación del enrutamiento de lanzamientos para dar servicio transparente a `/api/releases` y `/releases`, invocando `getReleasesFromDB(catalog)`.

### E. Dependencias y Control de Versiones
- `package.json`: Adición de la dependencia oficial `pg` (^8.23.1).
- `.gitignore`: Exclusión de `node_modules/`, `.DS_Store` y logs.

---

## 3. Validación (Cómo se Probó)

Se ejecutó un ciclo estricto de pruebas automatizadas:

1. **Suite de Seguridad TDD (`test/security.test.js` - 13 pruebas):**
   - `SEC-01`: Permite explícitamente `https://artist.eajmusic.com` (200 + CORS headers).
   - `SEC-02`: Permite explícitamente `https://eaj.eajmusic.com`.
   - `SEC-03`: Valida variantes `www` y protocolo `http`.
   - `SEC-04`: Bloquea orígenes maliciosos y confirma eliminación total del comodín `*`.
   - `SEC-05`: Preflight `OPTIONS` a `/api/releases` responde 204 con cabeceras completas.
   - `SEC-06`: Preflight `OPTIONS` desde orígenes sospechosos responde 403 Forbidden.
   - `SEC-07`: Inyección de cabeceras `RateLimit-*` en peticiones exitosas.
   - `SEC-08`: Endpoint `/api/releases` responde 200 y retorna el catálogo.
   - `SEC-09`: Endpoint `/health` expone el estado de PostgreSQL, CORS y Rate Limiting.
   - `SEC-10`: Envío de 101 peticiones consecutivas por una misma IP dispara respuesta `429 Too Many Requests` con cabecera `Retry-After`.
   - `SEC-11`: Endpoint `/api/releases` acepta `POST` para registrar lanzamientos.
   - `SEC-12`: Validación estricta de parámetros de pool PostgreSQL (max, min, timeouts).
   - `SEC-13`: `checkPostgresHealth` gestiona fallos de conexión sin excepciones no capturadas.

2. **Suite Completa del Proyecto (`npm test`):**
   - **27/27 pruebas pasando** (14 pruebas preexistentes de catálogo, auth, 2FA, ATH Móvil + 13 pruebas de seguridad nuevas).
   - Tiempo de ejecución total: ~2.5 segundos.

3. **Verificación de Sintaxis y Compilación (`npm run build`):**
   - Verificación de sintaxis limpia con `node --check src/server.js`: **PASS**.

---

## 4. Plan de Rollback (Cómo Revertir Cada Cambio)

Los cambios fueron ordenados en commits atómicos reversibles e independientes:

- Commit `c67aef6`: Creación de módulos de seguridad y PostgreSQL (`src/security/`, `src/db/`).
- Commit `0d998ea`: Integración de middleware y endpoints en `src/server.js`.
- Commit `cf2485b`: Suite de pruebas automatizadas `test/security.test.js`.

### Procedimiento de Rollback Rápido:
1. **Revertir la integración en el servidor preservando los módulos:**
   ```bash
   git revert 0d998ea -m 1 --no-edit
   ```
2. **Revertir la totalidad de los cambios a la rama base (`sync-insforge-api-auth` / `d8c7664`):**
   ```bash
   git reset --hard d8c7664
   ```
3. **Rollback selectivo de CORS:**
   Si se requiere habilitar temporalmente un dominio adicional, simplemente edite `src/security/cors.js` agregando el patrón en `ALLOWED_ORIGIN_PATTERNS` sin tocar la lógica central del servidor.
