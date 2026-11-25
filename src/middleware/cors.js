import cors from 'cors';

/**
 * 🛡️ EAJMUSIC CORS & HTTPS ENFORCEMENT MODULE
 * Ubicación: src/middleware/cors.js
 * Cumplimiento: OWASP CORS Hardening & HTTPS-only directive
 * - Permite exclusivamente orígenes HTTPS para *.eajmusic.com
 * - Rechaza explícitamente peticiones HTTP inseguras y comodín (*)
 * - Permite peticiones sin Origin (curl, apps móviles, server-to-server)
 * - Restringe customOrigins en producción exclusivamente a HTTPS bajo eajmusic.com
 * - Bloquea host spoofing y open redirect en enforceHttps
 */

const ALLOWED_PRODUCTION_PATTERNS = [
  /^https:\/\/(www\.)?eajmusic\.com$/,
  /^https:\/\/(www\.)?artist\.eajmusic\.com$/,
  /^https:\/\/(www\.)?eaj\.eajmusic\.com$/,
  /^https:\/\/(www\.)?api(-api)?\.eajmusic\.com$/,
];

const LOCALHOST_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/,
];

const VALID_HOSTNAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

/**
 * Valida si un Origin recibido cumple con la política estricta
 */
export function isAllowedOrigin(origin, options = {}) {
  // Allow requests with no origin (mobile apps, curl, server-to-server)
  if (!origin) return true;
  if (typeof origin !== 'string') return false;

  const trimmed = origin.trim();

  // Bloqueo absoluto de wildcard '*' y cadenas maliciosas
  if (trimmed === '*' || trimmed.toLowerCase() === 'null') return false;

  // REGLA CRÍTICA: Toda petición en dominios de producción (*.eajmusic.com)
  // DEBE ser exclusivamente HTTPS, NUNCA HTTP, en cualquier entorno.
  if (/^http:\/\/[^/]*eajmusic\.com(:[0-9]+)?$/i.test(trimmed)) {
    return false;
  }

  // Verificar si coincide con los patrones de producción autorizados (HTTPS)
  if (ALLOWED_PRODUCTION_PATTERNS.some(p => p.test(trimmed))) {
    return true;
  }

  const env = options.env || process.env.NODE_ENV || 'development';
  const customOrigins = options.customOrigins !== undefined
    ? options.customOrigins
    : (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : null);

  if (env === 'production') {
    // En producción:
    // 1. Rechaza SIEMPRE HTTP (http://...)
    // 2. Rechaza localhost / 127.0.0.1
    // 3. customOrigins solo permite orígenes https:// autorizados bajo eajmusic.com
    if (customOrigins && customOrigins.length > 0 && customOrigins.includes(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'https:') {
          const hostname = parsed.hostname.toLowerCase();
          if (hostname === 'eajmusic.com' || hostname.endsWith('.eajmusic.com')) {
            return true;
          }
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  // En development y test:
  if (customOrigins && customOrigins.length > 0) {
    if (customOrigins.includes(trimmed)) {
      if (/eajmusic\.com/i.test(trimmed) && !trimmed.startsWith('https://')) {
        return false;
      }
      return true;
    }
  }

  if (LOCALHOST_PATTERNS.some(p => p.test(trimmed))) {
    return true;
  }

  return false;
}

/**
 * Middleware de CORS para Express con opciones seguras
 */
export function corsMiddleware() {
  return cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      const err = new Error('Not allowed by CORS');
      err.statusCode = 403;
      callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'X-CSRF-Token', 'Idempotency-Key'],
    maxAge: 86400,
  });
}

/**
 * Normaliza y valida un host recibido para evitar Host spoofing
 */
function normalizeAndValidateHost(rawHost) {
  if (!rawHost || typeof rawHost !== 'string') return null;

  // Toma el primer valor si x-forwarded-host tiene comas
  const firstValue = rawHost.split(',')[0].trim();
  if (!firstValue) return null;

  // Separa hostname y puerto
  let hostname = firstValue;
  if (hostname.includes(':')) {
    const parts = hostname.split(':');
    hostname = parts[0];
    const port = parts[1];
    if (port && !/^[0-9]+$/.test(port)) {
      return null;
    }
  }

  hostname = hostname.trim().toLowerCase();

  // Valida que el hostname sea un nombre DNS válido
  if (!VALID_HOSTNAME_PATTERN.test(hostname)) {
    return null;
  }

  return hostname;
}

/**
 * Normaliza y sanitiza el pathname/query para evitar Open Redirect en Location
 */
function sanitizeRedirectPath(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string') return '/';

  // Si tiene caracteres de escape o backslashes, los normaliza
  let sanitized = originalUrl.replace(/\\/g, '/');

  // Si no empieza con '/', lo fuerza a relativo
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized;
  }

  // Si empieza con múltiples slashes (//evil.com), reduce a un solo slash
  sanitized = sanitized.replace(/^\/+/, '/');

  return sanitized;
}

/**
 * Middleware para forzar HTTPS en dominios de producción (*.eajmusic.com)
 */
export function enforceHttps(req, res, next) {
  const rawHost = req.headers['x-forwarded-host'] || req.hostname || req.headers.host || '';
  const host = normalizeAndValidateHost(rawHost);

  // Acepta ÚNICAMENTE host exacto 'eajmusic.com' o subdominio con punto '*.eajmusic.com'
  if (host && (host === 'eajmusic.com' || host.endsWith('.eajmusic.com'))) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      if (req.method === 'GET' || req.method === 'HEAD') {
        const safePath = sanitizeRedirectPath(req.originalUrl);
        return res.redirect(301, `https://${host}${safePath}`);
      }
      return res.status(403).json({ error: 'HTTPS required' });
    }
  }

  next();
}
