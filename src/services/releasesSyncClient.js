/**
 * ⚡ RELEASES REACTIVE SYNC CLIENT (Cross-Origin Safe, Cookie-Free)
 * Ubicación: src/services/releasesSyncClient.js
 *
 * Arquitectura:
 * - Diseñado para conectar eaj.eajmusic.com y artist.eajmusic.com sin compartir cookies.
 * - Utiliza SSE (Server-Sent Events) cross-origin con cabeceras CORS abiertas.
 * - Soporta BroadcastChannel para sincronización instantánea entre pestañas abiertas.
 * - Provee cliente agnóstico `ReleasesSyncClient`.
 */

export class ReleasesSyncClient {
  constructor(apiBase) {
    if (apiBase) {
      this.apiBase = apiBase.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.apiBase = isLocal ? 'http://localhost:3001/v1' : 'https://api-api.eajmusic.com/v1';
    } else {
      this.apiBase = 'http://localhost:3001/v1';
    }

    this.token = null;
    this.eventSource = null;
    this.broadcastChannel = null;
    this.listeners = new Set();
    this.reconnectTimeout = null;
    this.isConnected = false;

    // Inicializar canal de difusión local para sincronía cross-tab
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('eaj_releases_sync_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data) {
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        // BroadcastChannel no disponible en ciertos sandboxes
      }
    }
  }

  setToken(token) {
    this.token = token;
  }

  getApiBase() {
    return this.apiBase;
  }

  connect() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource) {
      this.disconnect();
    }

    const streamUrl = `${this.apiBase}/releases/stream`;

    try {
      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onopen = () => {
        this.isConnected = true;
      };

      this.eventSource.addEventListener('connected', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners({ type: 'CONNECTED', timestamp: new Date().toISOString(), ...data });
        } catch (err) {}
      });

      this.eventSource.addEventListener('RELEASE_CREATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners(data);
          this.broadcastLocally(data);
        } catch (err) {}
      });

      this.eventSource.addEventListener('RELEASE_STATUS_UPDATED', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners(data);
          this.broadcastLocally(data);
        } catch (err) {}
      });

      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners(data);
          this.broadcastLocally(data);
        } catch (err) {}
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.disconnect();
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      };
    } catch (err) {
      console.warn('⚠️ [ReleasesSyncClient] Error al instanciar EventSource:', err);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(payload) {
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('Error in release sync listener:', err);
      }
    });
  }

  broadcastLocally(payload) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async fetchReleases() {
    const res = await fetch(`${this.apiBase}/releases`, {
      headers: this.getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener releases`);
    }
    const data = await res.json();
    return data.releases || data.items || [];
  }

  async createRelease(releaseData) {
    const res = await fetch(`${this.apiBase}/releases`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(releaseData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.release;
  }

  async patchRelease(id, updates) {
    const res = await fetch(`${this.apiBase}/releases/${id}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al mutar release con PATCH`);
    }
    const data = await res.json();
    return data.release;
  }

  async updateReleaseStatus(id, status, reviewNotes) {
    const res = await fetch(`${this.apiBase}/releases/${id}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status, review_notes: reviewNotes })
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al actualizar estado`);
    }
    const data = await res.json();
    return data.release;
  }

  async approveRelease(id, reviewNotes) {
    const res = await fetch(`${this.apiBase}/releases/${id}/approve`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ review_notes: reviewNotes })
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al aprobar release`);
    }
    const data = await res.json();
    return data.release;
  }

  async rejectRelease(id, reviewNotes) {
    const res = await fetch(`${this.apiBase}/releases/${id}/reject`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ review_notes: reviewNotes })
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al rechazar release`);
    }
    const data = await res.json();
    return data.release;
  }
}

export const defaultReleasesSyncClient = new ReleasesSyncClient();
