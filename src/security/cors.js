/**
 * 🛡️ EAJMUSIC CORS SECURITY MODULE
 * Ubicación: src/security/cors.js
 * Cumplimiento: OWASP Cross-Origin Resource Sharing Hardening
 * Dominios autorizados: artist.eajmusic.com, eaj.eajmusic.com y variantes
 * Bloqueo absoluto de comodín (*) en entornos con credenciales o peticiones autenticadas
 */

export const ALLOWED_ORIGIN_PATTERNS = [
  // artist.eajmusic.com y variantes (solo HTTPS estricto)
  /^https:\/\/(www\.)?artist\.eajmusic\.com(:[0-9]+)?$/,
  // eaj.eajmusic.com y variantes (solo HTTPS estricto)
  /^https:\/\/(www\.)?eaj\.eajmusic\.com(:[0-9]+)?$/,
  // api-api.eajmusic.com y api.eajmusic.com (solo HTTPS estricto)
  /^https:\/\/(www\.)?api(-api)?\.eajmusic\.com(:[0-9]+)?$/,
  // Localhost y loopback para desarrollo y testing
  /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/
];

export const ALLOWED_ORIGINS_LIST = [
  'https://artist.eajmusic.com',
  'https://www.artist.eajmusic.com',
  'https://eaj.eajmusic.com',
  'https://www.eaj.eajmusic.com',
  'https://api-api.eajmusic.com',
  'https://api.eajmusic.com'
];

/**
 * Valida si un Origin recibido cumple con la lista blanca estricta
 */
export function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return false;
  const trimmed = origin.trim().toLowerCase();
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Aplica headers CORS seguros a la respuesta HTTP
 * - Si el origen está permitido, refleja dicho origen (NUNCA usa '*') y agrega credentials
 * - Si el origen no está permitido o no existe, no agrega headers de autorización CORS
 */
export function applyCorsHeaders(req, res) {
  const origin = req.headers['origin'];

  res.setHeader('Vary', 'Origin');

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, apikey, prefer, x-client-info');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache de preflight por 24 horas
    return true;
  }

  // Si no hay Origin (petición misma máquina/curl/servidor directo) o no está permitido, no se otorga CORS
  return false;
}

/**
 * Maneja peticiones preflight OPTIONS
 * Responde 204 No Content si el origen está permitido
 * Responde 403 Forbidden si el origen no está permitido
 */
export function handleCorsPreflight(req, res) {
  const origin = req.headers['origin'];

  if (origin && !isAllowedOrigin(origin)) {
    res.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
      'Vary': 'Origin'
    });
    res.end(JSON.stringify({
      error: 'Forbidden',
      message: `CORS Policy: Origin '${origin}' no está autorizado para acceder a api-api.eajmusic.com.`
    }, null, 2));
    return true;
  }

  applyCorsHeaders(req, res);
  res.writeHead(204);
  res.end();
  return true;
}
