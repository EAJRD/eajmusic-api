/**
 * 🧪 PRUEBAS END-TO-END: REACTIVIDAD Y SINCRONIZACIÓN CROSS-ORIGIN DE RELEASES
 *
 * Escenario:
 * - artist.eajmusic.com (Origen Artista)
 * - eaj.eajmusic.com (Origen Backoffice A&R)
 * - Sin dependencia de cookies (100% cookie-free / Authorization Header / CORS)
 * - Conectado a PostgreSQL / InsForge
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import server, { releasesSyncManager } from '../src/server.js';
import { ReleasesSyncClient } from '../src/services/releasesSyncClient.js';

const TEST_PORT = 3096;
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
    if (initialCatalogSnapshot) {
      fs.writeFileSync(CATALOG_FILE, initialCatalogSnapshot, 'utf-8');
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

test('1. Sincronización bidireccional entre artist.eajmusic.com y eaj.eajmusic.com vía ReleasesSyncClient', async () => {
  const artistClient = new ReleasesSyncClient(BASE_URL);
  const adminClient = new ReleasesSyncClient(BASE_URL);

  // Obtener catálogo inicial
  const initialReleases = await artistClient.fetchReleases();
  assert(Array.isArray(initialReleases));
  const initialCount = initialReleases.length;

  // 1. Artista sube un nuevo sencillo
  const created = await artistClient.createRelease({
    title: 'Boricua en Tokio',
    type: 'single',
    genre: 'Reggaetón Alternativo',
    release_date: '2026-12-15',
    artist_name: 'Kaelo'
  });

  assert.strictEqual(created.title, 'Boricua en Tokio');
  assert.strictEqual(created.status, 'draft');
  assert(created.upc.startsWith('73000'));

  // 2. Admin en eaj.eajmusic.com consulta y ve el nuevo release
  const adminReleases = await adminClient.fetchReleases();
  assert.strictEqual(adminReleases.length, initialCount + 1);
  const foundInAdmin = adminReleases.find(r => r.id === created.id);
  assert(foundInAdmin, 'El release debe existir en la consulta del admin');
  assert.strictEqual(foundInAdmin.title, 'Boricua en Tokio');

  // 3. Admin aprueba el lanzamiento para entrega DDEX
  const approved = await adminClient.approveRelease(created.id, 'Metadata DDEX verificada. Aprobado para DSPs.');
  assert.strictEqual(approved.status, 'approved');
  assert.strictEqual(approved.review_notes, 'Metadata DDEX verificada. Aprobado para DSPs.');

  // 4. Artista consulta su catálogo y observa el estado aprobado
  const artistUpdatedCatalog = await artistClient.fetchReleases();
  const updatedInArtist = artistUpdatedCatalog.find(r => r.id === created.id);
  assert.strictEqual(updatedInArtist.status, 'approved');
});

test('2. Ausencia total de cookies: Las peticiones no envían ni requieren cabecera Set-Cookie', async () => {
  const res = await fetch(`${BASE_URL}/releases`, {
    headers: {
      'Origin': 'https://artist.eajmusic.com',
      'Accept': 'application/json'
    }
  });

  assert.strictEqual(res.status, 200);
  // Verificar que el backend no intenta fijar cookies dependientes de dominio
  const setCookie = res.headers.get('set-cookie');
  assert.strictEqual(setCookie, null, 'El backend no debe forzar cookies en endpoints de releases cross-origin');
});

test('3. Validación y rechazo A&R con retroalimentación para el artista', async () => {
  const artistClient = new ReleasesSyncClient(BASE_URL);
  const adminClient = new ReleasesSyncClient(BASE_URL);

  const testRelease = await artistClient.createRelease({
    title: 'Demo Sin Masterizar',
    type: 'single',
    genre: 'Urbano'
  });

  // Admin rechaza indicando el motivo
  const rejected = await adminClient.rejectRelease(
    testRelease.id,
    'El audio presenta distorsión armónica superior a -0.1 dBFS. Por favor remitir nuevo master.'
  );

  assert.strictEqual(rejected.status, 'rejected');
  assert(rejected.review_notes.includes('distorsión'));

  const verify = await artistClient.fetchReleases();
  const found = verify.find(r => r.id === testRelease.id);
  assert.strictEqual(found.status, 'rejected');
  assert.strictEqual(found.review_notes, rejected.review_notes);
});
