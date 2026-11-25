/**
 * Amuse.io Client SDK for Node.js / TypeScript
 * Implements the official REST protocol used by artist.amuse.io
 * Base URL: https://api.amuse.io
 */

import {
  AmuseAuthCredentials,
  AmuseAuthResponse,
  AmuseArtist,
  AmuseRelease,
  AmuseAnalyticsSummary,
  AmuseDailyStreamPoint,
  AmusePlaylistPlacement,
  AmuseRoyaltyAgreement
} from './types';

export class AmuseApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private userAgent: string;

  constructor(token?: string, baseUrl: string = 'https://api.amuse.io') {
    this.baseUrl = baseUrl;
    this.token = token || null;
    this.userAgent = 'EAJMusic-Ingestion-Engine/1.0 (Macintosh; Intel Mac OS X)';
  }

  public setToken(token: string): void {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      acceptVersion?: number;
      authRequired?: boolean;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      acceptVersion = 6,
      authRequired = true
    } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'acceptVersion': acceptVersion.toString()
    };

    if (authRequired) {
      if (!this.token) {
        throw new Error('Amuse API Error: Authentication token is required for this operation');
      }
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Amuse API HTTP ${res.status} [${method} ${endpoint}]: ${errText}`);
    }

    return res.json() as Promise<T>;
  }

  // --- AUTHENTICATION ---
  public async login(credentials: AmuseAuthCredentials): Promise<AmuseAuthResponse> {
    const data = await this.request<AmuseAuthResponse>('/auth/login/', {
      method: 'POST',
      body: {
        email: credentials.email,
        password: credentials.password
      },
      authRequired: false,
      acceptVersion: 6
    });

    if (data.token) {
      this.token = data.token;
    }
    return data;
  }

  public async getMe(): Promise<any> {
    return this.request('/users/me/', { acceptVersion: 6 });
  }

  // --- ARTISTS ---
  public async getArtists(): Promise<AmuseArtist[]> {
    const data = await this.request<{ results?: AmuseArtist[] } | AmuseArtist[]>('/artists/', {
      acceptVersion: 6
    });
    return Array.isArray(data) ? data : (data.results || []);
  }

  public async getArtistById(artistId: string): Promise<AmuseArtist> {
    return this.request<AmuseArtist>(`/artists/${artistId}/`, { acceptVersion: 6 });
  }

  // --- RELEASES (CATALOG INGESTION) ---
  public async getReleases(params: {
    artistId?: string;
    status?: string;
    pageSize?: number;
  } = {}): Promise<{ releases: AmuseRelease[]; count: number }> {
    const query = new URLSearchParams();
    if (params.artistId) query.set('artist_id', params.artistId);
    if (params.status) query.set('status', params.status);
    if (params.pageSize) query.set('page_size', params.pageSize.toString());

    const endpoint = `/releases/?${query.toString()}`;
    const data = await this.request<{ results: AmuseRelease[]; count: number }>(endpoint, {
      acceptVersion: 5
    });

    return {
      releases: data.results || [],
      count: data.count || 0
    };
  }

  public async getReleaseById(releaseId: string): Promise<AmuseRelease> {
    return this.request<AmuseRelease>(`/releases/${releaseId}/`, { acceptVersion: 5 });
  }

  // --- ANALYTICS (REAL-TIME STREAMING METRICS) ---
  public async getArtistAnalyticsSummary(artistId: string): Promise<AmuseAnalyticsSummary> {
    return this.request<AmuseAnalyticsSummary>(`/analytics/artist/${artistId}/summary`, {
      acceptVersion: 6
    });
  }

  public async getArtistDailyStreams(artistId: string): Promise<AmuseDailyStreamPoint[]> {
    return this.request<AmuseDailyStreamPoint[]>(`/analytics/artist/${artistId}/daily`, {
      acceptVersion: 6
    });
  }

  public async getArtistPlaylists(artistId: string, limit: number = 50): Promise<AmusePlaylistPlacement[]> {
    const endpoint = `/analytics/artist/${artistId}/playlists?offset=0&limit=${limit}`;
    const data = await this.request<{ results?: AmusePlaylistPlacement[] } | AmusePlaylistPlacement[]>(endpoint, {
      acceptVersion: 6
    });
    return Array.isArray(data) ? data : (data.results || []);
  }

  // --- WALLET & SPLITS ---
  public async getRoyaltyAgreements(): Promise<AmuseRoyaltyAgreement[]> {
    const data = await this.request<{ results?: AmuseRoyaltyAgreement[] } | AmuseRoyaltyAgreement[]>('/wallet/agreements/', {
      acceptVersion: 6
    });
    return Array.isArray(data) ? data : (data.results || []);
  }
}
