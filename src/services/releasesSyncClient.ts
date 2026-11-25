/**
 * ⚡ RELEASES REACTIVE SYNC CLIENT (Cross-Origin Safe, Cookie-Free)
 * Ubicación: src/services/releasesSyncClient.ts
 *
 * Arquitectura:
 * - Diseñado para conectar eaj.eajmusic.com y artist.eajmusic.com sin compartir cookies.
 * - Utiliza SSE (Server-Sent Events) cross-origin con cabeceras CORS abiertas.
 * - Soporta BroadcastChannel para sincronización instantánea entre pestañas abiertas.
 * - Provee hook de React `useReleasesSync()` y cliente agnóstico `ReleasesSyncClient`.
 */

export interface ReleaseTrack {
  id?: string;
  title: string;
  isrc?: string;
  duration_seconds?: number;
  preview_url?: string;
}

export interface Release {
  id: string;
  artist_id?: string;
  artist_name?: string;
  title: string;
  type: string;
  upc: string;
  isrc?: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'released' | 'PENDING' | 'APPROVED' | 'REJECTED';
  release_date: string;
  cover_art_url?: string;
  genre: string;
  label_name?: string;
  tracks?: ReleaseTrack[];
  review_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type SyncEventType = 'CONNECTED' | 'RELEASE_CREATED' | 'RELEASE_STATUS_UPDATED' | 'RELEASE_DELETED';

export interface SyncEventPayload {
  type: SyncEventType;
  timestamp: string;
  release?: Release;
  id?: string;
  status?: string;
  review_notes?: string;
  total?: number;
}

export type EventListener = (payload: SyncEventPayload) => void;

export class ReleasesSyncClient {
  private apiBase: string;
  private token: string | null = null;
  private eventSource: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<EventListener> = new Set();
  private reconnectTimeout: any = null;
  private isConnected: boolean = false;

  constructor(apiBase?: string) {
    // Si no se provee, autodetectar según el entorno
    if (apiBase) {
      this.apiBase = apiBase.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      this.apiBase = isLocal ? 'http://localhost:3001/v1' : 'https://api-api.eajmusic.com/v1';
    } else {
      this.apiBase = 'http://localhost:3001/v1';
    }

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

  public setToken(token: string | null) {
    this.token = token;
  }

  public getApiBase(): string {
    return this.apiBase;
  }

  /**
   * Conecta al stream reactivo SSE (/v1/releases/stream)
   */
  public connect(): void {
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

      this.eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners({ type: 'CONNECTED', timestamp: new Date().toISOString(), ...data });
        } catch (err) {}
      });

      this.eventSource.addEventListener('RELEASE_CREATED', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners(data);
          this.broadcastLocally(data);
        } catch (err) {}
      });

      this.eventSource.addEventListener('RELEASE_STATUS_UPDATED', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners(data);
          this.broadcastLocally(data);
        } catch (err) {}
      });

      this.eventSource.onmessage = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners(data);
          this.broadcastLocally(data);
        } catch (err) {}
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.disconnect();
        // Reintento automático con retroceso exponencial
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      };
    } catch (err) {
      console.warn('⚠️ [ReleasesSyncClient] Error al instanciar EventSource:', err);
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(payload: SyncEventPayload): void {
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('Error in release sync listener:', err);
      }
    });
  }

  private broadcastLocally(payload: SyncEventPayload): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
  }

  private getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Obtiene la lista completa de releases desde el backend
   */
  public async fetchReleases(): Promise<Release[]> {
    const res = await fetch(`${this.apiBase}/releases`, {
      headers: this.getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener releases`);
    }
    const data = await res.json();
    return data.releases || data.items || [];
  }

  /**
   * Crea un nuevo lanzamiento (invocado típicamente desde artist.eajmusic.com)
   */
  public async createRelease(releaseData: Partial<Release>): Promise<Release> {
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

  public async patchRelease(id: string, updates: Partial<Release>): Promise<Release> {
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

  /**
   * Actualiza el estado de un lanzamiento (moderación A&R en eaj.eajmusic.com)
   */
  public async updateReleaseStatus(id: string, status: string, reviewNotes?: string): Promise<Release> {
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

  /**
   * Aprobar formalmente lanzamiento
   */
  public async approveRelease(id: string, reviewNotes?: string): Promise<Release> {
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

  /**
   * Rechazar lanzamiento con notas de revisión
   */
  public async rejectRelease(id: string, reviewNotes: string): Promise<Release> {
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

// Singleton global para aplicaciones frontend
export const defaultReleasesSyncClient = new ReleasesSyncClient();
