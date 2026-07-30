import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ===========================================
// COOKIE-BASED AUTH HELPERS
// ===========================================
// The frontend today stores JWTs in localStorage, which does not work once
// eajmusic.com / artist.eajmusic.com / eaj.eajmusic.com are real separate
// origins (localStorage does not cross subdomains). These helpers issue
// httpOnly cookies scoped to `.eajmusic.com` in production so the browser
// sends them automatically on requests from any subdomain. In local dev
// (NODE_ENV !== 'production'), `Secure` is dropped (browsers won't send
// Secure cookies over plain http://localhost) and the cookie is host-only
// (no `Domain` attribute) instead of `.eajmusic.com`.

export const ACCESS_COOKIE = 'eajmusic_token';
export const REFRESH_COOKIE = 'eajmusic_refresh';
export const CSRF_COOKIE = 'eajmusic_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = isProduction ? (process.env.COOKIE_DOMAIN || '.eajmusic.com') : undefined;

const DEFAULT_ACCESS_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CSRF_MAX_AGE_MS = DEFAULT_REFRESH_MAX_AGE_MS;

// Derive cookie maxAge from the token's own `exp` claim so the cookie never
// outlives (or expires long before) the JWT it carries, regardless of what
// JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN happen to be set to.
function msUntilExpiry(token, fallbackMs) {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
      return Math.max(0, decoded.exp * 1000 - Date.now());
    }
  } catch {
    // fall through to fallback
  }
  return fallbackMs;
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    domain: COOKIE_DOMAIN,
    path: '/',
  };
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sets the access, refresh, and CSRF cookies on `res`.
 * Returns the generated CSRF token (not that callers usually need it - the
 * frontend reads it back out of the non-httpOnly cookie itself).
 */
export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    maxAge: msUntilExpiry(accessToken, DEFAULT_ACCESS_MAX_AGE_MS),
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: msUntilExpiry(refreshToken, DEFAULT_REFRESH_MAX_AGE_MS),
  });

  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE, csrfToken, {
    // Must be readable by frontend JS (double-submit-cookie pattern) -
    // that's the whole mechanism, not an oversight.
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    domain: COOKIE_DOMAIN,
    path: '/',
    maxAge: CSRF_MAX_AGE_MS,
  });

  return csrfToken;
}

export function clearAuthCookies(res) {
  const opts = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
}
