import cors from 'cors';

/**
 * 🛡️ EAJMUSIC CORS & HTTPS ENFORCEMENT MODULE
 * Ubicación: src/middleware/cors.js
 * Cumplimiento: OWASP CORS Hardening & HTTPS-only directive
 * - Permite exclusivamente orígenes HTTPS para *.eajmusic.com
 * - Rechaza explícitamente peticiones HTTP inseguras y comodín (*)
 * - Permite peticiones sin Origin (curl, apps móviles, server-to-server)
 * - Permite localhost solo en desarrollo/testing o si está explícitamente configurado
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

  // Si hay orígenes personalizados configurados
  if (customOrigins && customOrigins.length > 0) {
    if (customOrigins.includes(trimmed)) {
      // Re-verificar que si es eajmusic.com, sea HTTPS
      if (/eajmusic\.com/i.test(trimmed) && !trimmed.startsWith('https://')) {
        return false;
      }
      return true;
    }
  }

  // Localhost / 127.0.0.1 solo en desarrollo o test
  if (env !== 'production') {
    if (LOCALHOST_PATTERNS.some(p => p.test(trimmed))) {
      return true;
    }
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
 * Middleware para forzar HTTPS en dominios de producción (*.eajmusic.com)
 */
export function enforceHttps(req, res, next) {
  const host = (req.headers['x-forwarded-host'] || req.hostname || req.headers.host || '').split(':')[0];
  if (host.endsWith('eajmusic.com')) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      if (req.method === 'GET' || req.method === 'HEAD') {
        return res.redirect(301, `https://${host}${req.originalUrl}`);
      }
      return res.status(403).json({ error: 'HTTPS required' });
    }
  }
  next();
}
