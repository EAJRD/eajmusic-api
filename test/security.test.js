import test from 'node:test';
import assert from 'node:assert';
import server from '../src/server.js';

let BASE_URL = 'http://localhost:3001';
let testServer;

test.before(async () => {
  await new Promise((resolve) => {
    testServer = server.listen(0, () => {
      const address = testServer.address();
      BASE_URL = `http://localhost:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }
});

test('SEC-01: CORS permite explícitamente artist.eajmusic.com', async () => {
  const res = await fetch(`${BASE_URL}/health`, {
    headers: { Origin: 'https://artist.eajmusic.com' }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://artist.eajmusic.com');
  assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  assert.strictEqual(res.headers.get('vary'), 'Origin');
});

test('SEC-02: CORS permite explícitamente eaj.eajmusic.com', async () => {
  const res = await fetch(`${BASE_URL}/health`, {
    headers: { Origin: 'https://eaj.eajmusic.com' }
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://eaj.eajmusic.com');
  assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
});

test('SEC-03: CORS permite variantes con www y http de dominios autorizados', async () => {
  const origins = [
    'https://www.artist.eajmusic.com',
    'http://artist.eajmusic.com',
    'https://www.eaj.eajmusic.com',
    'http://eaj.eajmusic.com'
  ];
  for (const origin of origins) {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { Origin: origin }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), origin);
  }
});

test('SEC-04: CORS bloquea orígenes no autorizados y elimina el wildcard (*)', async () => {
  const res = await fetch(`${BASE_URL}/health`, {
    headers: { Origin: 'https://unauthorized-malicious-site.com' }
  });
  assert.strictEqual(res.status, 200);
  assert.notStrictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.notStrictEqual(res.headers.get('access-control-allow-origin'), 'https://unauthorized-malicious-site.com');
  assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
});

test('SEC-05: Preflight OPTIONS para artist.eajmusic.com responde 204 con headers completos', async () => {
  const res = await fetch(`${BASE_URL}/api/releases`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://artist.eajmusic.com',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization, Content-Type'
    }
  });
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://artist.eajmusic.com');
  assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  assert(res.headers.get('access-control-allow-methods').includes('GET'));
  assert(res.headers.get('access-control-allow-headers').includes('Authorization'));
});

test('SEC-06: Preflight OPTIONS rechaza orígenes maliciosos con 403', async () => {
  const res = await fetch(`${BASE_URL}/api/releases`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker.com',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
});

test('SEC-07: Rate Limiting inyecta headers RateLimit en peticiones normales', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(res.status, 200);
  assert(res.headers.has('ratelimit-limit') || res.headers.has('x-ratelimit-limit'));
  assert(res.headers.has('ratelimit-remaining') || res.headers.has('x-ratelimit-remaining'));
});

test('SEC-08: Endpoint crítico /api/releases responde 200 y retorna catálogo', async () => {
  const res = await fetch(`${BASE_URL}/api/releases`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert(Array.isArray(data.releases));
  assert(data.releases.length > 0);
});

test('SEC-09: Endpoint /health incluye estado y validación de PostgreSQL y Rate Limiting', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert(data.postgres !== undefined, 'Debe incluir bloque postgres');
  assert(data.postgres.pool !== undefined, 'Debe reportar configuración del pool');
  assert(data.postgres.pool.max > 0, 'Pool max debe ser mayor a 0');
  assert(data.postgres.pool.connection_timeout_ms > 0, 'Connection timeout debe estar definido');
  assert(data.rate_limit !== undefined, 'Debe reportar configuración de rate limiting');
  assert.strictEqual(data.rate_limit.enabled, true);
  assert(data.rate_limit.max >= 100);
});

test('SEC-10: Rate Limiting bloquea con HTTP 429 al exceder límite por IP', async () => {
  const customIp = '198.51.100.42';
  const limit = 100;

  // Enviamos peticiones hasta alcanzar el límite
  let lastRes;
  // Para no demorar la prueba, probamos con peticiones secuenciales rápidas o con X-Forwarded-For
  for (let i = 0; i < 101; i++) {
    lastRes = await fetch(`${BASE_URL}/health`, {
      headers: { 'X-Forwarded-For': customIp }
    });
  }

  assert.strictEqual(lastRes.status, 429);
  assert.strictEqual(lastRes.headers.get('ratelimit-remaining'), '0');
  assert(lastRes.headers.has('retry-after'));
  const body = await lastRes.json();
  assert.strictEqual(body.error, 'Too Many Requests');
  assert(body.message.includes('límite'));
});

test('SEC-11: Endpoint crítico /api/releases acepta POST para registrar nuevo lanzamiento', async () => {
  const newReleasePayload = {
    title: 'San Juan Cybernetic Sound',
    type: 'single',
    genre: 'Electronic / Latin',
    artist_id: 'art_eaj_001'
  };

  const res = await fetch(`${BASE_URL}/api/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://artist.eajmusic.com'
    },
    body: JSON.stringify(newReleasePayload)
  });

  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.release.title, 'San Juan Cybernetic Sound');
  assert(data.release.id.startsWith('rel_eaj_'));
});

test('SEC-12: PostgreSQL Pool Configuration valida timeouts, límites y reconexión', async () => {
  const { POSTGRES_CONFIG, pool } = await import('../src/db/postgres.js');

  assert.strictEqual(typeof POSTGRES_CONFIG.max, 'number');
  assert(POSTGRES_CONFIG.max >= 5, 'Pool max debe permitir al menos 5 conexiones');
  assert(POSTGRES_CONFIG.connectionTimeoutMillis <= 10000, 'Connection timeout no debe exceder 10s');
  assert(POSTGRES_CONFIG.idleTimeoutMillis >= 10000, 'Idle timeout debe ser de al menos 10s');
  assert(pool.listenerCount('error') >= 1, 'Pool debe tener listener de error para reconexión');
});

test('SEC-13: checkPostgresHealth maneja errores de conexión sin lanzar excepciones no capturadas', async () => {
  const { checkPostgresHealth } = await import('../src/db/postgres.js');
  const health = await checkPostgresHealth();

  assert(['connected', 'disconnected'].includes(health.status));
  assert(health.pool !== undefined);
  assert(typeof health.latency_ms === 'number');
});

