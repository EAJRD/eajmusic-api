/**
 * 🧪 [SUITE DE CONTRATO Y REGRESIÓN LOCAL]
 * SINCRONIZACIÓN REACTIVA DE RELEASES Y EVENTOS SSE
 *
 * Clasificación Técnica:
 * - Tipo: Contrato de interfaz y regresión local.
 * - Validación: Endpoints /v1/releases/stream, emisión SSE reactiva, CORS estricto HTTPS y esquema relacional.
 * - Persistencia: Catálogo local desacoplado (data/catalog_synced.json) con failover resiliente.
 * (Para validación de conectividad e integración viva contra PostgreSQL / InsForge, ver test/insforge-postgres-live.test.js).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import server, { ReleasesSyncManager, releasesSyncManager } from '../src/server.js';

const TEST_PORT = 3097;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const CATALOG_FILE = path.resolve(process.cwd(), 'data/catalog_synced.json');
let originalCatalogContent = '';

before((done) => {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      originalCatalogContent = fs.readFileSync(CATALOG_FILE, 'utf-8');
    }
  } catch (e) {}

  if (server.listening) {
    done();
  } else {
    server.listen(TEST_PORT, done);
  }
});

after((done) => {
  try {
    if (originalCatalogContent && originalCatalogContent.trim().startsWith('[')) {
      const tmp = `${CATALOG_FILE}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmp, originalCatalogContent, 'utf-8');
      fs.renameSync(tmp, CATALOG_FILE);
    }
    if (releasesSyncManager) {
      releasesSyncManager.reset();
    }
  } catch (e) {}

  if (server.listening) {
    server.close(done);
  } else {
    done();
  }
});

test('1. SSE Stream (/v1/releases/stream) responde 200 con cabeceras text/event-stream y CORS estricto', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  const res = await fetch(`${BASE_URL}/v1/releases/stream`, {
    headers: {
      'Accept': 'text/event-stream',
      'Origin': 'https://artist.eajmusic.com'
    },
    signal: controller.signal
  });

  clearTimeout(timeout);
  controller.abort();

  assert.strictEqual(res.status, 200);
  assert(res.headers.get('content-type')?.includes('text/event-stream'));
  assert.strictEqual(res.headers.get('cache-control'), 'no-cache, no-transform');
  assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://artist.eajmusic.com');
  assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  assert.notStrictEqual(res.headers.get('access-control-allow-origin'), '*');
});

test('2. Peticiones CORS preflight (OPTIONS) hacia /v1/releases y /v1/releases/stream son cross-origin safe con lista blanca HTTPS', async () => {
  const resOptions = await fetch(`${BASE_URL}/v1/releases/stream`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://eaj.eajmusic.com',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization, Content-Type'
    }
  });

  assert.strictEqual(resOptions.status, 204);
  assert.strictEqual(resOptions.headers.get('access-control-allow-origin'), 'https://eaj.eajmusic.com');
  assert.strictEqual(resOptions.headers.get('access-control-allow-credentials'), 'true');
  assert.notStrictEqual(resOptions.headers.get('access-control-allow-origin'), '*');
  assert(resOptions.headers.get('access-control-allow-methods')?.includes('GET'));

  // Rechazo de origen no autorizado (debe retornar 403 y no otorgar CORS)
  const resBad = await fetch(`${BASE_URL}/v1/releases/stream`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://evil-unauthorized.com',
      'Access-Control-Request-Method': 'GET'
    }
  });
  assert.strictEqual(resBad.status, 403);
  assert.strictEqual(resBad.headers.get('access-control-allow-origin'), null);

  // Rechazo de variante http insegura (debe retornar 403 bajo HTTPS estricto)
  const resHttp = await fetch(`${BASE_URL}/v1/releases/stream`, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://artist.eajmusic.com',
      'Access-Control-Request-Method': 'GET'
    }
  });
  assert.strictEqual(resHttp.status, 403);
  assert.strictEqual(resHttp.headers.get('access-control-allow-origin'), null);
});

test('3. Nuevo release creado desde artist.eajmusic.com se transmite reactivamente por el stream de eventos', async () => {
  // Conectar cliente suscriptor (simulando eaj.eajmusic.com)
  const eventsReceived = [];
  const controller = new AbortController();

  const streamPromise = new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(`${BASE_URL}/v1/releases/stream`, {
        headers: { 'Accept': 'text/event-stream', 'Origin': 'https://eaj.eajmusic.com' },
        signal: controller.signal
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // conservar resto incompleto

        for (const block of lines) {
          if (!block.trim()) continue;
          const matchEvent = block.match(/^event:\s*(.+)$/m);
          const matchData = block.match(/^data:\s*(.+)$/m);
          if (matchData) {
            try {
              const data = JSON.parse(matchData[1]);
              const eventName = matchEvent ? matchEvent[1] : 'message';
              eventsReceived.push({ event: eventName, data });
              if (data.type === 'RELEASE_CREATED' && data.release?.title === 'Fuego en el Caribe') {
                resolve();
                return;
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') reject(err);
    }
  });

  // Pequeña pausa para asegurar que el socket SSE está conectado
  await new Promise(r => setTimeout(r, 100));

  // Crear release desde portal artista
  const newReleasePayload = {
    title: 'Fuego en el Caribe',
    type: 'single',
    genre: 'Reggaetón / Urbano',
    release_date: '2026-12-01',
    cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    artist_name: 'Kaelo'
  };

  const createRes = await fetch(`${BASE_URL}/v1/releases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://artist.eajmusic.com'
    },
    body: JSON.stringify(newReleasePayload)
  });

  assert.strictEqual(createRes.status, 201);
  const createdData = await createRes.json();
  assert.strictEqual(createdData.success, true);
  assert.strictEqual(createdData.release.title, 'Fuego en el Caribe');

  // Esperar a recibir el evento reactivo en el admin
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout esperando evento SSE RELEASE_CREATED')), 3000)
  );

  await Promise.race([streamPromise, timeoutPromise]);
  controller.abort();

  const createdEvent = eventsReceived.find(e => e.data?.type === 'RELEASE_CREATED' && e.data?.release?.title === 'Fuego en el Caribe');
  assert(createdEvent, 'Debe haber recibido el evento RELEASE_CREATED');
  assert.strictEqual(createdEvent.data.release.status, 'draft');
});

test('4. Actualización de estado en eaj.eajmusic.com (Aprobación/Rechazo A&R) notifica reactivamente a artist.eajmusic.com', async () => {
  // Crear release de prueba para moderar
  const createRes = await fetch(`${BASE_URL}/v1/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Track Para Aprobar',
      type: 'single',
      genre: 'Trap',
      release_date: '2026-11-30'
    })
  });
  const { release } = await createRes.json();
  const targetId = release.id;

  // Suscriptor en artist.eajmusic.com
  const eventsReceived = [];
  const controller = new AbortController();

  const streamPromise = new Promise(async (resolve, reject) => {
    try {
      const res = await fetch(`${BASE_URL}/v1/releases/stream`, {
        headers: { 'Accept': 'text/event-stream', 'Origin': 'https://artist.eajmusic.com' },
        signal: controller.signal
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const block of lines) {
          if (!block.trim()) continue;
          const matchData = block.match(/^data:\s*(.+)$/m);
          if (matchData) {
            try {
              const data = JSON.parse(matchData[1]);
              eventsReceived.push(data);
              if (data.type === 'RELEASE_STATUS_UPDATED' && data.release?.id === targetId && data.release?.status === 'approved') {
                resolve();
                return;
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') reject(err);
    }
  });

  await new Promise(r => setTimeout(r, 100));

  // Admin en eaj.eajmusic.com aprueba el release
  const updateRes = await fetch(`${BASE_URL}/v1/releases/${targetId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://eaj.eajmusic.com'
    },
    body: JSON.stringify({
      status: 'approved',
      review_notes: 'Aprobado formalmente para entrega prioritaria DDEX a Spotify y Apple Music.'
    })
  });

  assert.strictEqual(updateRes.status, 200);
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.success, true);
  assert.strictEqual(updateData.release.status, 'approved');

  // Esperar a recibir el evento reactivo
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout esperando evento SSE RELEASE_STATUS_UPDATED')), 3000)
  );

  await Promise.race([streamPromise, timeoutPromise]);
  controller.abort();

  const statusEvent = eventsReceived.find(e => e.type === 'RELEASE_STATUS_UPDATED' && e.release?.id === targetId);
  assert(statusEvent, 'Debe haber recibido el evento RELEASE_STATUS_UPDATED');
  assert.strictEqual(statusEvent.release.status, 'approved');
});

test('5. Esquema de datos de releases cumple con el modelo relacional PostgreSQL / InsForge', async () => {
  const res = await fetch(`${BASE_URL}/v1/releases`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert(Array.isArray(data.releases));
  assert(data.releases.length > 0);

  // Validar atributos de esquema relacional PostgreSQL
  const first = data.releases[0];
  const requiredFields = ['id', 'title', 'type', 'upc', 'status', 'release_date'];
  for (const field of requiredFields) {
    assert(field in first, `El campo ${field} es obligatorio según el esquema PostgreSQL de releases`);
  }
});
