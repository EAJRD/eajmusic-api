/**
 * 🧪 PRUEBAS UNITARIAS DE INTEGRACIÓN: EAJMUSIC API
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import server from '../src/server.js';

const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

before((done) => {
  server.listen(TEST_PORT, done);
});

after((done) => {
  server.close(done);
});

test('1. Health check responde 200 y status ok', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.service, 'EAJMUSIC API Production Engine');
});

test('2. Catálogo sincronizado retorna lista de lanzamientos', async () => {
  const res = await fetch(`${BASE_URL}/v1/catalog`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert(Array.isArray(data.items));
  assert(data.items.length >= 2);
  assert.strictEqual(data.items[0].title, 'Neon Horizons');
});

test('3. Checkout de plan Pro Artist ($19.99/año)', async () => {
  const res = await fetch(`${BASE_URL}/v1/subscriptions/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: 'pro_artist' })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.plan, 'pro_artist');
  assert.strictEqual(data.amount_charged, 19.99);
});

test('4. Retiro por ATH Móvil en Puerto Rico (Validación E.164 + 0% comisión)', async () => {
  // Retiro exitoso con número válido de PR (787)
  const res = await fetch(`${BASE_URL}/v1/payouts/ath-movil/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_usd: 150.00,
      phone: '787-555-1234'
    })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.fee_usd, 0.00);
  assert.strictEqual(data.destination_phone, '+17875551234');
  assert.strictEqual(data.status, 'completed');
});

test('5. Retiro por ATH Móvil rechaza números fuera de Puerto Rico', async () => {
  const res = await fetch(`${BASE_URL}/v1/payouts/ath-movil/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_usd: 50.00,
      phone: '+1 305 555 9999' // Miami / Florida, no es PR
    })
  });
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert(data.error.includes('Puerto Rico'));
});

test('6. 2FA Generate genera secreto TOTP, URL otpauth y códigos de respaldo', async () => {
  const res = await fetch(`${BASE_URL}/v1/auth/2fa/generate`, {
    method: 'POST'
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert(typeof data.secret === 'string' && data.secret.length >= 16);
  assert(data.otpauth_url.startsWith('otpauth://totp/EAJMusic'));
  assert(Array.isArray(data.backup_codes) && data.backup_codes.length === 5);
});

test('7. 2FA Enable activa el segundo factor con código de 6 dígitos', async () => {
  const res = await fetch(`${BASE_URL}/v1/auth/2fa/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '123456' })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.two_factor_enabled, true);
});

test('8. 2FA Verify valida código de un solo uso o código de respaldo', async () => {
  // Test con OTP de 6 dígitos
  const res = await fetch(`${BASE_URL}/v1/auth/2fa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '654321' })
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.verified, true);
});
