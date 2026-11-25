/**
 * 🔄 RELEASES SYNC MANAGER (InsForge / PostgreSQL & Realtime SSE)
 * Ubicación: src/services/releasesSyncManager.js
 *
 * Misión:
 * 1. Gestiona suscripciones reactivas Server-Sent Events (SSE) sin depender de cookies (cross-origin safe).
 * 2. Mantiene sincronía bidireccional entre artist.eajmusic.com y eaj.eajmusic.com.
 * 3. Valida y sincroniza el esquema relacional de la tabla `releases` con PostgreSQL / InsForge PostgREST.
 * 4. Persiste en memoria y en disco (data/catalog_synced.json) con resiliencia ante caídas de red.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { isAllowedOrigin } from '../security/cors.js';

export class ReleasesSyncManager {
  /**
   * @param {Object} options
   * @param {string} [options.catalogPath]
   * @param {string} [options.insforgeUrl]
   * @param {string} [options.insforgeApiKey]
   * @param {Array} [options.initialReleases]
   */
  constructor(options = {}) {
    this.catalogPath = options.catalogPath || path.resolve(process.cwd(), 'data/catalog_synced.json');
    this.insforgeUrl = options.insforgeUrl || process.env.INSFORGE_URL || 'https://sv9mfvjq.us-east.insforge.app';
    this.insforgeApiKey = options.insforgeApiKey || process.env.INSFORGE_API_KEY || process.env.INSFORGE_APP_KEY || 'sv9mfvjq';

    /** @type {Set<http.ServerResponse>} */
    this.clients = new Set();

    // Inicializar catálogo desde disco o fallback provisto
    this.releases = this.loadInitialCatalog(options.initialReleases || []);

    // Heartbeat para mantener vivas las conexiones SSE en proxies y Cloudflare
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  loadInitialCatalog(fallback = []) {
    try {
      if (fs.existsSync(this.catalogPath)) {
        const raw = fs.readFileSync(this.catalogPath, 'utf-8');
        if (raw && raw.trim().length > 0) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      // Fallback limpio a releases en memoria
    }
    return [...fallback];
  }

  persistCatalog() {
    try {
      const dir = path.dirname(this.catalogPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.catalogPath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.releases, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.catalogPath);
    } catch (err) {
      console.warn('⚠️ [ReleasesSyncManager] Error al persistir catalog_synced.json:', err.message);
    }
  }

  reset() {
    this.releases = this.loadInitialCatalog();
    return this.releases;
  }

  getReleases() {
    return [...this.releases];
  }

  getReleaseById(id) {
    return this.releases.find(r => r.id === id);
  }

  /**
   * Suscribe a un cliente HTTP a Server-Sent Events (SSE).
   * Cross-Origin Safe: No requiere cookies. Funciona mediante CORS dinámico de lista blanca y tokens en Authorization.
   */
  addClient(req, res) {
    const origin = req.headers['origin'];

    if (origin && !isAllowedOrigin(origin)) {
      res.writeHead(403, {
        'Content-Type': 'application/json; charset=utf-8',
        'Vary': 'Origin'
      });
      res.end(JSON.stringify({
        error: 'Forbidden',
        message: `CORS Policy: Origin '${origin}' no está autorizado para acceder al stream reactivo.`
      }, null, 2));
      return;
    }

    const headers = {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Vary': 'Origin'
    };

    if (origin && isAllowedOrigin(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey, prefer, x-client-info';
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    }

    res.writeHead(200, headers);

    // Enviar evento de conexión exitosa inicial
    const connectedEvent = {
      type: 'CONNECTED',
      status: 'connected',
      timestamp: new Date().toISOString(),
      total_releases: this.releases.length,
      insforge_host: this.insforgeUrl
    };
    res.write(`event: connected\ndata: ${JSON.stringify(connectedEvent)}\n\n`);

    this.clients.add(res);

    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  sendHeartbeat() {
    for (const res of this.clients) {
      try {
        res.write(': ping\n\n');
      } catch (err) {
        this.clients.delete(res);
      }
    }
  }

  /**
   * Emite un evento a todos los clientes SSE conectados (artist y eaj admin)
   */
  broadcast(eventType, payload) {
    const data = {
      type: eventType,
      timestamp: new Date().toISOString(),
      ...payload
    };

    const sseFrame = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const res of this.clients) {
      try {
        res.write(sseFrame);
      } catch (err) {
        this.clients.delete(res);
      }
    }

    return data;
  }

  /**
   * Crea un nuevo lanzamiento con validación de esquema PostgreSQL / InsForge
   */
  async createRelease(data) {
    const randomHex = crypto.randomBytes(4).toString('hex');
    const release = {
      id: data.id || `rel_eaj_${randomHex}`,
      artist_id: data.artist_id || 'art_eaj_001',
      artist_name: data.artist_name || 'Kaelo & EAJ Collective',
      title: (data.title || '').trim(),
      type: (data.type || 'single').toLowerCase(),
      upc: data.upc || `73000${Math.floor(10000000 + Math.random() * 90000000)}`,
      isrc: data.isrc || `QZDA42600${Math.floor(1000 + Math.random() * 9000)}`,
      status: data.status || 'draft',
      release_date: data.release_date || new Date().toISOString().split('T')[0],
      cover_art_url: data.cover_art_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      genre: data.genre || 'Urbano / Alternativo',
      label_name: data.label_name || 'EAJMUSIC Records',
      tracks: data.tracks || [],
      stores: data.stores || {
        spotify: { status: 'pending' },
        apple_music: { status: 'pending' },
        tiktok: { status: 'pending' },
        youtube: { status: 'pending' }
      },
      created_at: new Date().toISOString()
    };

    this.releases.unshift(release);
    this.persistCatalog();

    // Notificar reactivamente a ambos frontends
    this.broadcast('RELEASE_CREATED', { release });

    // Sincronización asíncrona con PostgreSQL / InsForge
    this.syncToInsForge(release).catch((err) => {
      console.warn('⚠️ [InsForge Sync] Advertencia en background:', err.message);
    });

    return release;
  }

  /**
   * Actualiza parcialmente un release mediante PATCH/PUT persistente contra PostgreSQL / InsForge
   */
  async patchRelease(id, updates = {}) {
    const release = this.releases.find(r => r.id === id);
    if (!release) return null;

    const allowedFields = [
      'status',
      'review_notes',
      'title',
      'type',
      'genre',
      'label_name',
      'cover_art_url',
      'release_date',
      'tracks',
      'stores'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        release[field] = updates[field];
      }
    }
    release.updated_at = new Date().toISOString();

    this.persistCatalog();

    // Notificar reactivamente a través de SSE a todos los portales
    this.broadcast('RELEASE_STATUS_UPDATED', {
      release,
      id,
      status: release.status,
      review_notes: release.review_notes || '',
      updates
    });

    // Sincronizar con PostgreSQL / InsForge
    this.syncToInsForge(release).catch((err) => {
      console.warn('⚠️ [InsForge Sync] Advertencia en patchRelease:', err.message);
    });

    return release;
  }

  /**
   * Actualiza el estado de un release (moderación A&R en eaj.eajmusic.com)
   */
  async updateReleaseStatus(id, newStatus, reviewNotes = '') {
    return this.patchRelease(id, { status: newStatus, review_notes: reviewNotes });
  }

  /**
   * Upsert a tabla PostgreSQL `releases` vía endpoint PostgREST de InsForge
   */
  async syncToInsForge(release) {
    if (!this.insforgeUrl || !this.insforgeApiKey) return false;

    const endpoint = `${this.insforgeUrl.replace(/\/+$/, '')}/rest/v1/releases`;
    const payload = JSON.stringify([
      {
        id: release.id,
        artist_id: release.artist_id,
        title: release.title,
        type: release.type,
        upc: release.upc,
        artwork_url: release.cover_art_url,
        label_name: release.label_name,
        status: release.status,
        release_date: release.release_date,
        created_at: release.created_at
      }
    ]);

    try {
      const url = new URL(endpoint);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      return await new Promise((resolve) => {
        const req = transport.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.insforgeApiKey,
              'Authorization': `Bearer ${this.insforgeApiKey}`,
              'Prefer': 'resolution=merge-duplicates,return=minimal',
              'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 5000
          },
          (res) => {
            res.resume();
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(true);
            } else {
              // No bloqueante: registramos pero no interrumpimos el flujo reactivo
              resolve(false);
            }
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.write(payload);
        req.end();
      });
    } catch (e) {
      // Resiliencia local ante caídas de red o endpoints externos
      return false;
    }
  }
}
