# 📋 Auditoría y Certificación de Producción: eaj.eajmusic.com

**Fecha de Certificación:** 23 de Noviembre de 2026  
**Estatus:** ✅ **CERTIFICADO Y EN PRODUCCIÓN (HTTP 200 OK)**  
**Objetivo:** Auditar la compilación `dist/eaj` con `VITE_APP_MODE=admin`, certificar el ruteo de subdominio `eaj.eajmusic.com` hacia `AdminAppRoutes` y verificar el despliegue en Hostinger.

---

## 1. Auditoría de Compilación `dist/eaj` (`VITE_APP_MODE=admin`)

### A. Comando de Construcción
```bash
cross-env VITE_APP_MODE=admin vite build --outDir dist/eaj
```

### B. Análisis de Dead-Code Elimination y Code-Splitting
* En tiempo de compilación con Vite, `VITE_APP_MODE=admin` reemplaza estáticamente `import.meta.env.VITE_APP_MODE` por el literal `"admin"`.
* Las ramas correspondientes al portal de marketing (`Home`, `AboutUs`, `Careers`, `Talent`, etc.) y las vistas aisladas de artista son podadas por Rollup mediante eliminación de código muerto.
* La carpeta `dist/eaj` contiene únicamente los bundles necesarios para el Backoffice Central:
  - `dist/eaj/index.html` (2.13 kB)
  - `dist/eaj/assets/AdminDashboard-*.js` (~497.7 kB)
  - `dist/eaj/assets/Login-*.js`, `Register-*.js`, `ForgotPassword-*.js`, `VerifyEmail-*.js`
  - `dist/eaj/assets/index-*.css` (81.2 kB)
  - `dist/eaj/.htaccess` (Configuración de servidor Apache/LiteSpeed con reglas de reescritura SPA y cabeceras de seguridad de grado bancario).

### C. Resultados de Pruebas y Validación de Tipos
* **Vitest:** 4/4 suites aprobadas (41/41 tests pasando al 100%):
  - `src/utils/adminPermissions.test.ts` (29 tests) ✅
  - `src/utils/passwordPolicy.test.ts` (6 tests) ✅
  - `src/utils/pendingRegistration.test.ts` (4 tests) ✅
  - `src/utils/subdomain.test.ts` (2 tests) ✅
* **TypeScript Typecheck (`tsc --noEmit`):** 0 errores de tipado en todo el árbol de componentes.

---

## 2. Ruteo de Subdominio `eaj.eajmusic.com` y `AdminAppRoutes`

### A. Detección Inteligente de Subdominio (`src/utils/subdomain.ts`)
```typescript
const ADMIN_PREFIXES = ['eaj.', 'admin.'];

function detectAppMode(): AppMode {
  const envMode = (import.meta as any).env?.VITE_APP_MODE;
  if (envMode === 'admin') return 'admin';
  const hostname = window.location.hostname.toLowerCase();
  if (ADMIN_PREFIXES.some(prefix => hostname.startsWith(prefix))) return 'admin';
  return 'main';
}
```

### B. Enrutador Central (`AdminAppRoutes` en `src/Router.tsx`)
Cuando `APP_MODE === 'admin'`, la aplicación monta exclusivamente el router administrativo:
```tsx
const AdminAppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
    <Route path="/register" element={<Navigate to="/login" replace />} />
    <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
    <Route path="/reset-password" element={<PublicOnlyRoute><ResetPassword /></PublicOnlyRoute>} />
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route
      path="/*"
      element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      }
    />
  </Routes>
);
```

### C. Módulos Verificados en `AdminDashboard`
1. **💿 Moderación de Lanzamientos (`ReleasesList.tsx`):**
   - Cola de revisión A&R para singles, EPs y álbumes entrantes.
   - Inspección de audio preview, portada de alta resolución, metadatos UPC, ISRC, participantes y género.
   - Acciones de Aprobación para entrega DDEX o Rechazo con notas detalladas al artista.
2. **👥 Gestión de Usuarios (`UsersList.tsx`):**
   - Búsqueda y listado integral de artistas, sellos y personal operativo.
   - Modificación de roles (`ARTIST`, `LABEL`, `SUPPORT`, `REVIEWER`, `FINANCE`, `ADMIN`, `SUPER_ADMIN`).
   - Estado de verificación de cuenta y 2FA.
3. **🎫 Tickets de Soporte (`SupportTickets.tsx`):**
   - Sistema de cola de soporte con clasificación por severidad, categoría y estado.
   - Interfaz de respuesta rápida para agentes de soporte y cierre de incidencias.
4. **Módulos Complementarios:**
   - `AdminOverview.tsx`: KPIs de catálogo, ingresos acumulados y lanzamientos pendientes.
   - `FinanceHub.tsx`: Liquidaciones de regalías y desembolsos vía ATH Móvil.
   - `PlansAndCommissions.tsx`: Planes tarifarios y split de comisiones.
   - `BrandSettings.tsx`: Personalización institucional del sello discográfico EAJMUSIC.
   - `Announcements.tsx`: Publicación de comunicados y avisos globales.

---

## 3. Certificación del Despliegue en Hostinger

### A. Parámetros del Servidor de Producción
* **Hosting:** Hostinger Premium Cloud / LiteSpeed Web Server
* **Servidor IP:** `194.195.84.121` (SSH Port `65002`)
* **Usuario:** `u539343672`
* **Directorio Raíz del Subdominio:**
  ```
  /home/u539343672/domains/eajmusic.com/public_html/eaj/
  ```

### B. Verificación de Conectividad en Vivo (Live Probe)
* **URL:** `https://eaj.eajmusic.com/`
* **Código de Respuesta:** `HTTP/2 200 OK`
* **Edge / CDN:** Cloudflare (Ray ID validado, SSL/TLS full strict)
* **Servidor de Origen:** Hostinger LiteSpeed (`x-turbo-charged-by: LiteSpeed`)
* **Cabeceras de Seguridad Verificadas:**
  - `Content-Security-Policy`: Restringida a endpoints autorizados (`connect-src 'self' https://api-api.eajmusic.com https://*.insforge.app`)
  - `X-Frame-Options: DENY` (Protección estricta anti-clickjacking)
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

### C. Script de Automatización de Despliegue
El despliegue de `dist/eaj` se encuentra automatizado a través de `scripts/deploy-frontend.sh`:
```bash
rsync -avz --delete -e "ssh -p 65002" ./dist/eaj/ u539343672@194.195.84.121:/home/u539343672/domains/eajmusic.com/public_html/eaj/
```

---
**Dictamen:** Todos los componentes requeridos para `eaj.eajmusic.com` están completamente operativos, compilados bajo estándares de producción y certificados en el entorno de Hostinger.
