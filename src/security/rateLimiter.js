/**
 * ⏱️ EAJMUSIC RATE LIMITER MODULE
 * Ubicación: src/security/rateLimiter.js
 * Límite predeterminado: 100 req/min por IP
 * Headers estándar: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After
 * Código HTTP al exceder: 429 Too Many Requests
 */

const ipStore = new Map();

export const RATE_LIMIT_CONFIG = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),             // 100 req/min
  cleanupIntervalMs: 120000                                          // Limpieza cada 2 minutos
};

// Intervalo de recolección de basura para entradas expiradas en memoria
let cleanupTimer = null;
function startCleanupTimer() {
  if (cleanupTimer || process.env.NODE_ENV === 'test') return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipStore.entries()) {
      if (now > data.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, RATE_LIMIT_CONFIG.cleanupIntervalMs);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Obtiene la dirección IP real del cliente considerando proxies y CDN (Cloudflare/Hostinger)
 */
export function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return String(cfIp).trim();

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const parts = String(forwarded).split(',');
    return parts[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp).trim();

  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Aplica verificación de Rate Limiting
 * Retorna true si la petición puede continuar
 * Retorna false y envía respuesta 429 si ha excedido el límite
 */
export function checkRateLimit(req, res, customOptions = {}) {
  startCleanupTimer();

  const windowMs = customOptions.windowMs || RATE_LIMIT_CONFIG.windowMs;
  const max = customOptions.max || RATE_LIMIT_CONFIG.max;
  const ip = getClientIp(req);
  const now = Date.now();

  let record = ipStore.get(ip);
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowMs
    };
    ipStore.set(ip, record);
  }

  record.count += 1;
  const remaining = Math.max(0, max - record.count);
  const resetSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

  // Inyección de headers RateLimit tanto estándar IETF como tradicionales X-RateLimit
  res.setHeader('RateLimit-Limit', max);
  res.setHeader('RateLimit-Remaining', remaining);
  res.setHeader('RateLimit-Reset', resetSeconds);
  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (record.count > max) {
    res.setHeader('Retry-After', resetSeconds);
    res.writeHead(429, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      message: `Has excedido el límite de solicitudes (${max} req/min). Por favor intenta de nuevo en ${resetSeconds} segundos.`,
      retry_after_seconds: resetSeconds,
      limit: max,
      window_seconds: Math.ceil(windowMs / 1000)
    }, null, 2));
    return false;
  }

  return true;
}

/**
 * Reinicia el almacén de IPs (útil para pruebas)
 */
export function resetRateLimits() {
  ipStore.clear();
}
