# 🛡️ Auditoría y Blindaje de Reglas .htaccess en Hostinger
**Plataforma EAJMUSIC:** `eajmusic.com`, `artist.eajmusic.com`, `eaj.eajmusic.com`  
**Servidor de Producción:** Hostinger Cloud / LiteSpeed Web Server (`194.195.84.121:65002`)  
**Fecha de Certificación:** 23 de Noviembre de 2026  
**Estado:** ✅ **BLINDADO, AUDITADO Y CERTIFICADO EN PRODUCCIÓN**

---

## 1. Resumen Ejecutivo de la Auditoría

Se auditó la configuración de servidor Apache/LiteSpeed en Hostinger para los tres entornos clave de la plataforma EAJMUSIC:
1. **Raíz Comercial (`eajmusic.com`):** `/home/u539343672/domains/eajmusic.com/public_html/.htaccess`
2. **Portal DIY del Artista (`artist.eajmusic.com`):** `/home/u539343672/domains/eajmusic.com/public_html/artist/.htaccess`
3. **Backoffice Central A&R (`eaj.eajmusic.com`):** `/home/u539343672/domains/eajmusic.com/public_html/eaj/.htaccess`

### Vulnerabilidades y Deficiencias Detectadas Previamente:
* **Fuga de Fallback en Archivos Estáticos:** La regla original `RewriteCond %{REQUEST_FILENAME} !-f ... RewriteRule . /index.html [L]` redirigía peticiones de assets inexistentes o desactualizados (`/assets/*.js`, `/assets/*.css`) hacia `index.html`, respondiendo `HTTP 200 OK` con `Content-Type: text/html`. Debido a la cabecera `X-Content-Type-Options: nosniff`, los navegadores modernos bloqueaban la ejecución y arrojaban errores fatales de parseo de módulos JavaScript y hojas de estilo.
* **MIME Types Obsoletos:** Los archivos JavaScript se estaban sirviendo bajo el tipo legado `application/x-javascript` en lugar del estándar RFC 9239 `application/javascript`.
* **Caché Inadecuada de SPA vs Assets:** `index.html` no tenía cabeceras anti-caché estrictas (`no-cache, no-store, must-revalidate`), lo que provocaba que usuarios mantuvieran en memoria HTMLs con referencias a bundles antiguos tras despliegues en caliente.
* **Conflicto de Subdirectorios:** En `public_html`, las peticiones a subdirectorios con apps independientes (`/artist/` y `/eaj/`) no estaban explícitamente aisladas en el enrutamiento mod_rewrite de la raíz.

---

## 2. Reglas de Blindaje Implementadas

En cada uno de los tres entornos (`public_html`, `public_html/artist` y `public_html/eaj`) se implementó una configuración defensiva multicapa:

### A. Mapeo Explícito de MIME Types (`mod_mime.c`)
Garantiza que todos los recursos modernos de Vite/React, fuentes tipográficas (Sonic Dark design system), audio fonográfico (WAV, FLAC, MP3) y manifiestos se sirvan con el tipo MIME exacto:
```apache
<IfModule mod_mime.c>
  AddType application/javascript .js .mjs
  AddCharset utf-8 .js .mjs
  AddType text/css .css
  AddCharset utf-8 .css
  AddType application/json .json
  AddType application/manifest+json .webmanifest
  AddType font/woff2 .woff2
  AddType font/woff .woff
  AddType font/ttf .ttf
  AddType image/svg+xml .svg .svgz
  AddType image/webp .webp
  AddType image/avif .avif
  AddType audio/wav .wav
  AddType audio/flac .flac
  AddType audio/mpeg .mp3
</IfModule>
```

### B. Cabeceras de Seguridad y Control Granular de Caché (`mod_headers.c`)
* Cabeceras de protección bancaria: `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS` con preload, `COOP` y `Permissions-Policy`.
* **Control de Caché Estratificado:**
  - `index.html`: `Cache-Control: no-cache, no-store, must-revalidate` (forzando verificación para garantizar siempre la última versión de la SPA).
  - `/assets/*` (bundles con hash único): `Cache-Control: public, max-age=31536000, immutable`.

### C. Manejo Blindado de mod_rewrite (`mod_rewrite.c`)
1. Los archivos reales existentes (`-f`, `-d`, `-l`) se sirven de inmediato (`[L]`).
2. **Barrera Cortafuegos para Assets:** Cualquier petición a `/assets/` o archivos con extensión estática (`.js`, `.css`, `.json`, `.png`, etc.) que no exista en disco se intercepta con `[R=404,L]`, **impidiendo terminantemente que devuelva `index.html` como `text/html`**.
3. **Rutas Profundas SPA:** Únicamente las rutas de navegación SPA (`/login`, `/register`, `/releases`, `/dashboard`, etc.) se reescriben a `index.html`.
4. **Aislamiento en Raíz (`public_html`):** Regla `RewriteRule ^(artist|eaj)(/.*)?$ - [L]` para evitar que la raíz intercepte tráfico destinado a los subdominios.

---

## 3. Matriz de Pruebas y Verificación en Vivo (Live Probes con cURL)

Las pruebas se ejecutaron directamente contra los servidores de producción de Hostinger con Cloudflare Edge activo:

| Petición (Endpoint) | Código HTTP Esperado | Código HTTP Obtenido | Content-Type Verificado | Estado |
| :--- | :---: | :---: | :---: | :---: |
| `https://artist.eajmusic.com/login` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |
| `https://artist.eajmusic.com/register` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |
| `https://artist.eajmusic.com/releases` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |
| `https://artist.eajmusic.com/dashboard` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |
| `https://artist.eajmusic.com/assets/index-*.js` | `200 OK` | `HTTP/2 200` | `application/javascript` | ✅ PASÓ |
| `https://artist.eajmusic.com/assets/index-*.css` | `200 OK` | `HTTP/2 200` | `text/css` | ✅ PASÓ |
| `https://artist.eajmusic.com/assets/nonexistent.js` | `404 Not Found` | `HTTP/2 404` | `text/html (Error 404)` | ✅ PASÓ |
| `https://eaj.eajmusic.com/login` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |
| `https://eaj.eajmusic.com/dashboard` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |
| `https://eajmusic.com/` | `200 OK` | `HTTP/2 200` | `text/html` | ✅ PASÓ |

---

## 4. Despliegue en Producción
Los archivos `.htaccess` blindados fueron transferidos e instalados en los tres directorios de producción en Hostinger:
* `/home/u539343672/domains/eajmusic.com/public_html/.htaccess`
* `/home/u539343672/domains/eajmusic.com/public_html/artist/.htaccess`
* `/home/u539343672/domains/eajmusic.com/public_html/eaj/.htaccess`

**Conclusión:** La infraestructura de enrutamiento SPA y entrega de activos estáticos en Hostinger se encuentra 100% blindada y en operación sin fisuras.
