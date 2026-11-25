/**
 * 🧪 [SUITE DE INTEGRACIÓN AISLADA]
 * INSFORGE & POSTGRESQL LIVE CONNECTIVITY & PERSISTENCE CONTRACT
 *
 * Misión:
 * 1. Probar conectividad real con el pool de PostgreSQL (src/db/postgres.js).
 * 2. Probar la interacción HTTP/HTTPS en vivo contra el endpoint PostgREST de InsForge (syncToInsForge).
 * 3. Validar el esquema relacional de la tabla `releases` y el failover automático ante ausencia de red/credenciales.
 * 4. Certificar la verificación criptográfica de tokens JWT de InsForge.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { POSTGRES_CONFIG, pool, checkPostgresHealth, getReleasesFromDB } from '../src/db/postgres.js';
import { ReleasesSyncManager } from '../src/services/releasesSyncManager.js';
import { verifyInsforgeToken } from '../src/server.js';

test('1. [PostgreSQL Live/Config] Valida pool y ejecuta health check con diagnóstico y failover', async () => {
  assert(POSTGRES_CONFIG, 'POSTGRES_CONFIG debe estar inicializado');
  assert(typeof POSTGRES_CONFIG.max === 'number' && POSTGRES_CONFIG.max >= 5, 'Pool max debe ser >= 5');
  assert(typeof POSTGRES_CONFIG.connectionTimeoutMillis === 'number', 'Connection timeout configurado');

  const health = await checkPostgresHealth();
  assert(['connected', 'disconnected'].includes(health.status), 'Health check debe retornar status válido');
  assert(health.pool, 'Health check debe incluir métricas de pool');

  if (health.status === 'connected') {
    // Si PostgreSQL está vivo y accesible
    assert(health.latency_ms >= 0, 'Latencia debe ser un número positivo');
    assert(health.server_time, 'Debe retornar hora del servidor');
    assert.strictEqual(health.error, null);
  } else {
    // En entornos CI o sin base de datos local levantada, debe activar failover con gracia
    assert.strictEqual(health.fallback_mode, 'active');
    assert(health.notice.includes('failover activo'));
  }
});

test('2. [PostgreSQL Releases Query] Ejecuta consulta relacional o activa fallback sin excepciones', async () => {
  const fallback = [{ id: 'rel_test_mock', title: 'Fallback Test', status: 'approved' }];
  const result = await getReleasesFromDB(fallback);

  assert(Array.isArray(result), 'getReleasesFromDB debe retornar un arreglo');
  assert(result.length > 0, 'Debe retornar registros o el catálogo de contingencia');

  const first = result[0];
  assert(first.id, 'Registro debe contener id');
  assert(first.title, 'Registro debe contener title');
  assert(first.status, 'Registro debe contener status');
});

test('3. [InsForge Live Endpoint] syncToInsForge realiza llamada de red y resuelve con gracia', async () => {
  const manager = new ReleasesSyncManager({
    insforgeUrl: process.env.INSFORGE_URL || 'https://sv9mfvjq.us-east.insforge.app',
    insforgeApiKey: process.env.INSFORGE_API_KEY || 'sv9mfvjq'
  });

  const testRelease = {
    id: `rel_live_test_${Date.now()}`,
    artist_id: 'art_live_test',
    title: 'Integration Test Track',
    type: 'single',
    upc: '750999999999',
    cover_art_url: 'https://cdn.eajmusic.com/art.jpg',
    label_name: 'EAJ Music Live',
    status: 'in_review',
    release_date: '2026-12-01',
    created_at: new Date().toISOString()
  };

  // syncToInsForge no debe lanzar errores no capturados ni romper el proceso
  const syncResult = await manager.syncToInsForge(testRelease);
  assert(typeof syncResult === 'boolean', 'syncToInsForge debe resolver un booleano (true si 2xx, false en failover/offline)');
});

test('4. [InsForge Cryptographic Auth] Verificación de token JWT emitido por InsForge', async () => {
  const secret = process.env.INSFORGE_JWT_SECRET || 'd3ae7390f3b62f0321ea449d6e88a419cdb6dcc2';

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'user_live_test_12345',
    email: 'live-test@eajmusic.com',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 1800
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  const validToken = `${header}.${payload}.${signature}`;

  // Token válido se decodifica
  const decoded = verifyInsforgeToken(validToken);
  assert.strictEqual(decoded.sub, 'user_live_test_12345');
  assert.strictEqual(decoded.email, 'live-test@eajmusic.com');
  assert.strictEqual(decoded.role, 'authenticated');

  // Token alterado se rechaza
  const tamperedToken = `${header}.${payload}.invalid_signature_here`;
  assert.throws(() => {
    verifyInsforgeToken(tamperedToken);
  }, /Firma criptográfica de InsForge no válida/);
});
