import { describe, it, expect } from 'vitest';
import express from 'express';
import { isAllowedOrigin, corsMiddleware, enforceHttps } from './cors.js';

describe('CORS and HTTPS-only policy for EAJMusic', () => {
  it('allows authorized HTTPS domains for EAJMusic', () => {
    const authorized = [
      'https://artist.eajmusic.com',
      'https://www.artist.eajmusic.com',
      'https://eaj.eajmusic.com',
      'https://www.eaj.eajmusic.com',
      'https://eajmusic.com',
      'https://www.eajmusic.com',
      'https://api.eajmusic.com',
      'https://api-api.eajmusic.com',
    ];
    for (const origin of authorized) {
      expect(isAllowedOrigin(origin), `Expected ${origin} to be allowed`).toBe(true);
    }
  });

  it('allows requests with no origin (curl, mobile apps, server-to-server)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
  });

  it('strictly rejects insecure HTTP on *.eajmusic.com in all environments', () => {
    const insecure = [
      'http://artist.eajmusic.com',
      'http://www.artist.eajmusic.com',
      'http://eaj.eajmusic.com',
      'http://www.eaj.eajmusic.com',
      'http://eajmusic.com',
      'http://www.eajmusic.com',
      'http://api.eajmusic.com',
      'http://api-api.eajmusic.com',
    ];
    for (const origin of insecure) {
      expect(isAllowedOrigin(origin, { env: 'production' })).toBe(false);
      expect(isAllowedOrigin(origin, { env: 'development' })).toBe(false);
      expect(isAllowedOrigin(origin, { env: 'test' })).toBe(false);
    }
  });

  it('strictly rejects wildcard * origin', () => {
    expect(isAllowedOrigin('*', { env: 'production' })).toBe(false);
    expect(isAllowedOrigin('*', { env: 'development' })).toBe(false);
    expect(isAllowedOrigin('*', { env: 'test' })).toBe(false);
  });

  it('rejects unauthorized, attacker and domain spoofing origins', () => {
    const rejected = [
      'https://evil-eajmusic.com',
      'https://eajmusic.com.attacker.com',
      'https://artist.eajmusic.com.attacker.com',
      'http://localhost.evil.com',
      'https://unknown.com',
      'null',
    ];
    for (const origin of rejected) {
      expect(isAllowedOrigin(origin, { env: 'production' })).toBe(false);
    }
  });

  it('allows localhost in development and test environments, but not in production unless configured', () => {
    expect(isAllowedOrigin('http://localhost:3000', { env: 'development' })).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', { env: 'test' })).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3000', { env: 'development' })).toBe(true);

    expect(isAllowedOrigin('http://localhost:3000', { env: 'production' })).toBe(false);
    expect(isAllowedOrigin('http://localhost:3000', { env: 'production', customOrigins: ['http://localhost:3000'] })).toBe(true);
  });

  it('integrates with Express HTTP and reflects allowed origin while rejecting disallowed', async () => {
    const app = express();
    app.use(corsMiddleware());
    app.get('/test', (req, res) => res.json({ ok: true }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
      // Allowed HTTPS origin
      const resAllowed = await fetch(`${base}/test`, {
        headers: { Origin: 'https://artist.eajmusic.com' }
      });
      expect(resAllowed.status).toBe(200);
      expect(resAllowed.headers.get('access-control-allow-origin')).toBe('https://artist.eajmusic.com');
      expect(resAllowed.headers.get('access-control-allow-credentials')).toBe('true');

      // Preflight OPTIONS allowed
      const resOptions = await fetch(`${base}/test`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://eaj.eajmusic.com',
          'Access-Control-Request-Method': 'POST',
        }
      });
      expect(resOptions.status).toBe(204);
      expect(resOptions.headers.get('access-control-allow-origin')).toBe('https://eaj.eajmusic.com');

      // Insecure HTTP on eajmusic.com rejected
      const resHttp = await fetch(`${base}/test`, {
        headers: { Origin: 'http://artist.eajmusic.com' }
      });
      expect(resHttp.status).toBe(403);

      // Wildcard * rejected
      const resWildcard = await fetch(`${base}/test`, {
        headers: { Origin: '*' }
      });
      expect(resWildcard.status).toBe(403);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('enforces HTTPS requests for *.eajmusic.com hosts', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(enforceHttps);
    app.get('/api/ping', (req, res) => res.json({ pong: true }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
      // Insecure request to eajmusic.com gets redirected or rejected
      const resInsecureGet = await fetch(`${base}/api/ping`, {
        headers: {
          'X-Forwarded-Host': 'artist.eajmusic.com',
          'X-Forwarded-Proto': 'http'
        },
        redirect: 'manual'
      });
      expect(resInsecureGet.status).toBe(301);
      expect(resInsecureGet.headers.get('location')).toBe('https://artist.eajmusic.com/api/ping');

      const resInsecurePost = await fetch(`${base}/api/ping`, {
        method: 'POST',
        headers: {
          'X-Forwarded-Host': 'artist.eajmusic.com',
          'X-Forwarded-Proto': 'http'
        }
      });
      expect(resInsecurePost.status).toBe(403);

      // Secure HTTPS request proceeds
      const resSecure = await fetch(`${base}/api/ping`, {
        headers: {
          'X-Forwarded-Host': 'artist.eajmusic.com',
          'X-Forwarded-Proto': 'https'
        }
      });
      expect(resSecure.status).toBe(200);
      expect(await resSecure.json()).toEqual({ pong: true });
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
