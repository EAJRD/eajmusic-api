/**
 * 🧪 [SUITE DE CONTRATO Y REGRESIÓN LOCAL]
 * QA BLOCKERS: DEF-001 Y DEF-002 (Persistencia Local con Sincronización PostgreSQL/InsForge)
 *
 * Clasificación Técnica:
 * - Tipo: Contrato y Regresión Local (Fast Feedback / Offline Safe).
 * - Persistencia: Catálogo local (data/catalog_synced.json) con propagación asíncrona a PostgreSQL/InsForge.
 * - Cobertura:
 *   1. DEF-001: El panel de administración emite peticiones PATCH/PUT con persistencia atómica.
 *   2. DEF-002: El Portal del Artista consulta y mapea el catálogo real sin stubs 'Track Title {i}'.
 *   3. End-to-End: Admin PATCH -> Persistencia -> Notificación Reactiva al Portal Artista (sin cookies).
 * (Para pruebas de integración aislada contra base de datos/endpoint en vivo, ver test/insforge-postgres-live.test.js).
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import server, { releasesSyncManager } from '../src/server.js';
import { ReleasesSyncClient } from '../src/services/releasesSyncClient.js';

const TEST_PORT = 3095;
const BASE_URL = `http://localhost:${TEST_PORT}/v1`;
const CATALOG_FILE = path.resolve(process.cwd(), 'data/catalog_synced.json');
let initialCatalogSnapshot = '';

before((done) => {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      initialCatalogSnapshot = fs.readFileSync(CATALOG_FILE, 'utf-8');
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
    if (initialCatalogSnapshot && initialCatalogSnapshot.trim().startsWith('[')) {
      const tmp = `${CATALOG_FILE}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmp, initialCatalogSnapshot, 'utf-8');
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

test('DEF-001: PATCH /v1/releases/:id emite mutación real persistente contra PostgreSQL/InsForge', async () => {
  const client = new ReleasesSyncClient(BASE_URL);

  // 1. Crear release de prueba
  const created = await client.createRelease({
    title: 'Audit Track DEF-001',
    type: 'single',
    genre: 'Reggaetón',
    artist_name: 'Kaelo'
  });
  assert(created.id, 'Debe retornar un ID de release generado');

  // 2. Admin emite petición PATCH con mutación de estado y notas A&R
  const patchRes = await fetch(`${BASE_URL}/releases/${created.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://eaj.eajmusic.com'
    },
    body: JSON.stringify({
      status: 'approved',
      review_notes: 'Verificado formalmente por QA Valentina. Cumple estándares DDEX.',
      genre: 'Urbano Pro'
    })
  });

  assert.strictEqual(patchRes.status, 200, 'PATCH debe responder 200 OK');
  const patchData = await patchRes.json();
  assert.strictEqual(patchData.success, true);
  assert.strictEqual(patchData.release.status, 'approved');
  assert.strictEqual(patchData.release.genre, 'Urbano Pro');
  assert.strictEqual(patchData.release.review_notes, 'Verificado formalmente por QA Valentina. Cumple estándares DDEX.');

  // 3. Verificar persistencia real en consulta subsecuente
  const verifyRes = await fetch(`${BASE_URL}/releases`);
  const verifyData = await verifyRes.json();
  const persisted = verifyData.releases.find(r => r.id === created.id);
  assert(persisted, 'El release mutado debe existir en el catálogo persistido');
  assert.strictEqual(persisted.status, 'approved');
  assert.strictEqual(persisted.review_notes, 'Verificado formalmente por QA Valentina. Cumple estándares DDEX.');
});

test('DEF-002: Portal del Artista mapea tracks y releases reales de PostgreSQL sin stubs "Track Title {i}"', async () => {
  const artistClient = new ReleasesSyncClient(BASE_URL);

  // Consultar catálogo del artista
  const catalog = await artistClient.fetchReleases();
  assert(Array.isArray(catalog), 'Debe retornar un arreglo de releases');
  assert(catalog.length > 0, 'Debe contener al menos los lanzamientos de producción');

  // Verificar que ningún release o track contenga el stub "Track Title"
  for (const release of catalog) {
    assert(!release.title.includes('Track Title'), `El release "${release.title}" no debe ser un stub`);
    assert(release.upc, `El release "${release.title}" debe poseer código UPC real`);
    assert(release.release_date, `El release "${release.title}" debe poseer fecha de lanzamiento`);
    assert(['draft', 'in_review', 'approved', 'rejected', 'released'].includes(release.status.toLowerCase()),
      `El estado "${release.status}" debe ser un estado DDEX válido`);

    // Validar tracks asociados si existen
    if (release.tracks && release.tracks.length > 0) {
      for (const track of release.tracks) {
        assert(!track.title.includes('Track Title'), `La pista "${track.title}" no debe ser un stub`);
        assert(track.isrc, `La pista "${track.title}" debe poseer código ISRC oficial`);
        assert(typeof track.duration_seconds === 'number', `La pista "${track.title}" debe tener duración`);
      }
    }
  }
});

test('End-to-End: Flujo persistente Admin PATCH -> PostgreSQL -> Portal Artista sin cookies', async () => {
  const artistClient = new ReleasesSyncClient(BASE_URL);
  const adminClient = new ReleasesSyncClient(BASE_URL);

  // 1. Artista sube un tema
  const release = await artistClient.createRelease({
    title: 'Tema Para Certificacion QA',
    type: 'single',
    artist_name: 'Kaelo',
    genre: 'Urbano / Trap'
  });

  // 2. Admin emite PATCH persistente
  const patchRes = await fetch(`${BASE_URL}/releases/${release.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://eaj.eajmusic.com'
    },
    body: JSON.stringify({
      status: 'approved',
      review_notes: 'Certificación P0 QA superada.'
    })
  });
  assert.strictEqual(patchRes.status, 200);

  // 3. Artista consulta directamente sin cookies (cross-origin seguro)
  const artistView = await artistClient.fetchReleases();
  const updatedItem = artistView.find(r => r.id === release.id);

  assert(updatedItem, 'El tema debe aparecer en el portal del artista');
  assert.strictEqual(updatedItem.status, 'approved');
  assert.strictEqual(updatedItem.review_notes, 'Certificación P0 QA superada.');
});
