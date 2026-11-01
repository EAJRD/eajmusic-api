/**
 * EAJMUSIC — AI Database Client (InsForge / Supabase Compatible)
 * Conecta con el Backend-as-a-Service optimizado para Inteligencia Artificial
 * (InsForge / Supabase PostgREST & Vector Engine).
 */

export interface AIDatabaseConfig {
  baseUrl: string;       // e.g. https://<app-id>.insforge.app/rest/v1 o https://<ref>.supabase.co/rest/v1
  apiKey: string;        // Anon key o Service Role key
  isInsforge?: boolean;  // Identificador de plataforma
}

export interface IngestedArtistRecord {
  id: string;
  name: string;
  spotify_uri?: string;
  apple_music_id?: string;
  avatar_url?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface IngestedReleaseRecord {
  id: string;
  artist_id: string;
  title: string;
  type: string;          // SINGLE, EP, ALBUM
  upc?: string;
  status: string;        // LIVE, PENDING, DRAFT
  release_date: string;
  cover_art_url?: string;
  spotify_url?: string;
  apple_music_url?: string;
  metadata?: Record<string, any>;
}

export interface IngestedTrackRecord {
  id: string;
  release_id: string;
  title: string;
  isrc?: string;
  track_number: number;
  duration_seconds: number;
  preview_url?: string;
  audio_url?: string;
  status: string;
  ai_vector_tags?: string[];
}

export interface IngestedStreamingStatRecord {
  track_id: string;
  dsp_id: string;        // spotify, apple_music, tiktok, amazon
  date: string;
  country_code?: string;
  streams: number;
  saves: number;
  playlist_adds: number;
  revenue_gross: number;
  revenue_net: number;
}

export class AIDatabaseClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config?: Partial<AIDatabaseConfig>) {
    this.baseUrl = (
      config?.baseUrl ||
      process.env.INSFORGE_URL ||
      process.env.VITE_SUPABASE_URL ||
      'https://gniqkwyedexeeruznwgn.supabase.co'
    ).replace(/\/$/, '') + '/rest/v1';

    this.apiKey =
      config?.apiKey ||
      process.env.INSFORGE_API_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Prefer': 'resolution=merge-duplicates,return=representation'
    };
  }

  /**
   * Upsert genérico en tabla PostgREST (InsForge / Supabase)
   */
  public async upsert<T>(table: string, data: T | T[]): Promise<{ count: number; data: any; success: boolean; error?: string }> {
    const url = `${this.baseUrl}/${table}`;
    const payload = Array.isArray(data) ? data : [data];

    if (!this.apiKey) {
      console.warn(`[AIDatabaseClient] Sin API KEY configurada. Modo offline/simulación.`);
      return { count: payload.length, data: payload, success: true };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { count: 0, data: null, success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();
      return { count: Array.isArray(result) ? result.length : 1, data: result, success: true };
    } catch (err: any) {
      return { count: 0, data: null, success: false, error: err.message };
    }
  }

  /**
   * Upsert de Perfil de Artista
   */
  public async syncArtist(artist: IngestedArtistRecord) {
    return this.upsert('artists', artist);
  }

  /**
   * Upsert de Catálogo de Lanzamientos
   */
  public async syncReleases(releases: IngestedReleaseRecord[]) {
    return this.upsert('releases', releases);
  }

  /**
   * Upsert de Tracks
   */
  public async syncTracks(tracks: IngestedTrackRecord[]) {
    return this.upsert('tracks', tracks);
  }

  /**
   * Upsert de Métricas Diarias y Plays
   */
  public async syncStreamingStats(stats: IngestedStreamingStatRecord[]) {
    return this.upsert('streaming_stats', stats);
  }
}
