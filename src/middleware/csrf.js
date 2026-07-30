import { CSRF_COOKIE, CSRF_HEADER } from '../utils/cookies.js';

// ===========================================
// CSRF PROTECTION (double-submit cookie)
// ===========================================
// Cookie-based auth is vulnerable to CSRF in a way bearer-header auth is
// not (the browser attaches cookies to cross-site requests automatically).
// On login/register/refresh we set a non-httpOnly `eajmusic_csrf` cookie;
// the frontend must read it and echo it back in the `X-CSRF-Token` header
// on every mutating request. An attacker's page can trigger the cookie to
// be sent, but can't read it to put it in the header (same-origin policy).

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// No CSRF cookie exists yet before the user has ever logged in.
const EXEMPT_EXACT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  // Called by ATH Móvil's own servers (see src/routes/payment.js), not by a
  // browser - there's no session cookie for it to forge in the first place,
  // so double-submit CSRF doesn't apply. Authenticity for this endpoint is
  // handled separately (see the shared-secret check in the handler itself).
  '/api/payment/ath-movil/webhook',
]);

export function csrfProtection(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (EXEMPT_EXACT_PATHS.has(req.path)) return next();

  // /api/public/* is for anonymous callers (newsletter signup, contact form,
  // testimonial submission) who never go through login and so never receive
  // a CSRF cookie. CSRF protects cookie-authenticated sessions; these routes
  // don't rely on any ambient auth cookie, so there is nothing to protect.
  if (req.path.startsWith('/api/public/')) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token',
    });
  }

  next();
}
