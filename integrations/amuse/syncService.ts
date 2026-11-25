/**
 * AmuseSyncService — Pipeline de Sincronización Automática
 * Conecta con Amuse API (upstream) y actualiza la base de datos y caché de EAJMUSIC.
 */

import { AmuseApiClient } from './client';
import { AmuseIngestionBridge, EAJPublicReleaseCard, EAJArtistDashboardStats } from './bridge';
import { AmuseRelease, AmuseAnalyticsSummary, AmuseDailyStreamPoint, AmusePlaylistPlacement } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface SyncResult {
  timestamp: string;
  releasesCount: number;
  totalStreamsSynced: string;
  playlistsDetected: number;
  success: boolean;
  error?: string;
}

export class AmuseSyncService {
  private client: AmuseApiClient;
  private cacheDir: string;

  constructor(token?: string, cacheDir?: string) {
    this.client = new AmuseApiClient(token);
    this.cacheDir = cacheDir || path.resolve(__dirname, '../../data');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Ejecuta la sincronización completa de Catálogo + Analíticas
   */
  public async executeFullSync(artistId?: string): Promise<SyncResult> {
    const timestamp = new Date().toISOString();

    try {
      // 1. Ingesta de Catálogo de Lanzamientos
      const { releases } = await this.client.getReleases({
        artistId,
        status: 'released',
        pageSize: 50
      });

      const publicCatalog: EAJPublicReleaseCard[] = AmuseIngestionBridge.transformToPublicCatalog(
        releases,
        'EAJMusic Artist'
      );

      // Guardar caché de catálogo
      const catalogPath = path.join(this.cacheDir, 'catalog_synced.json');
      fs.writeFileSync(catalogPath, JSON.stringify(publicCatalog, null, 2), 'utf-8');

      // 2. Ingesta de Analíticas & Métricas si se provee artistId
      let dashboardStats: EAJArtistDashboardStats | null = null;
      let totalStreamsFormatted = '0';
      let playlistsCount = 0;

      if (artistId) {
        const [summary, daily, playlists] = await Promise.all([
          this.client.getArtistAnalyticsSummary(artistId).catch(() => null),
          this.client.getArtistDailyStreams(artistId).catch(() => []),
          this.client.getArtistPlaylists(artistId).catch(() => [])
        ]);

        if (summary) {
          dashboardStats = AmuseIngestionBridge.transformToArtistDashboard(
            summary,
            daily,
            playlists
          );
          totalStreamsFormatted = dashboardStats.totalPlays;
          playlistsCount = playlists.length;

          // Guardar caché de analíticas
          const statsPath = path.join(this.cacheDir, `analytics_${artistId}.json`);
          fs.writeFileSync(statsPath, JSON.stringify(dashboardStats, null, 2), 'utf-8');
        }
      }

      return {
        timestamp,
        releasesCount: publicCatalog.length,
        totalStreamsSynced: totalStreamsFormatted,
        playlistsDetected: playlistsCount,
        success: true
      };
    } catch (err: any) {
      return {
        timestamp,
        releasesCount: 0,
        totalStreamsSynced: '0',
        playlistsDetected: 0,
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Obtiene el catálogo sincronizado desde caché local
   */
  public getCachedCatalog(): EAJPublicReleaseCard[] {
    const catalogPath = path.join(this.cacheDir, 'catalog_synced.json');
    if (fs.existsSync(catalogPath)) {
      return JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    }
    return [];
  }
}
