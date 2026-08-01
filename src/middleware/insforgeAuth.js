import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// InsForge is the credential front door (signup/login/OAuth/password reset);
// this API stays the source of truth for roles and business data. This
// verifies an InsForge-issued access token against InsForge's own published
// JWKS (RS256) - no shared secret needed, and key rotation is handled by
// jwks-rsa's cache. Only used at the moment a client calls
// POST /auth/sync-insforge-user to exchange a fresh InsForge token for this
// API's own session cookies; ongoing requests keep using those cookies.
const INSFORGE_URL = process.env.INSFORGE_URL;

const client = INSFORGE_URL
  ? jwksClient({
      jwksUri: `${INSFORGE_URL}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 60 * 60 * 1000,
      rateLimit: true,
    })
  : null;

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// InsForge access tokens carry no `iss`/`aud` claims (confirmed by decoding
// a real one: just sub/email/role/iat/exp) - there's nothing to check there.
// The JWKS URL itself is already project-scoped (only this InsForge project's
// key can produce a signature that verifies against it), which is what
// would normally be `aud`'s job. `role` is the one claim worth asserting:
// it should always be "authenticated" for a real end-user session token:
// rejecting anything else stops a differently-scoped InsForge token (if one
// ever existed) from being accepted here as a login credential.
const EXPECTED_ROLE = 'authenticated';

export function verifyInsforgeToken(token) {
  if (!client) return Promise.reject(new Error('INSFORGE_URL not configured'));
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
      if (err) return reject(err);
      if (decoded.role !== EXPECTED_ROLE) {
        return reject(new Error(`Unexpected InsForge token role: ${decoded.role}`));
      }
      resolve(decoded);
    });
  });
}
