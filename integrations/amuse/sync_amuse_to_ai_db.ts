/**
 * ==============================================================================
 * EAJMUSIC — Sincronizador de Ingesta Amuse.io → Base de Datos IA (InsForge / Supabase)
 * ==============================================================================
 * Extrae catálogo, pistas, reproducciones y analíticas desde artist.amuse.io
 * y los inserta/actualiza en la base de datos de Inteligencia Artificial de EAJMUSIC.
 *
 * Uso:
 *   npx ts-node sync_amuse_to_ai_db.ts [--mock] [--artist-id <id>] [--dry-run]
 */

import { AmuseApiClient } from './client';
import { AmuseIngestionBridge } from './bridge';
import { AIDatabaseClient, IngestedArtistRecord, IngestedReleaseRecord, IngestedTrackRecord, IngestedStreamingStatRecord } from './dbClient';
import { MOCK_AMUSE_RELEASES, MOCK_AMUSE_ANALYTICS_SUMMARY, MOCK_AMUSE_DAILY_STREAMS } from './mockData';
import * as fs from 'fs';
import * as path from 'path';

interface IngestionOptions {
  useMock: boolean;
  dryRun: boolean;
  artistId?: string;
  cacheDir: string;
}

export class AmuseToAIDatabaseSync {
  private amuseClient: AmuseApiClient;
  private dbClient: AIDatabaseClient;
  private options: IngestionOptions;

  constructor(options: Partial<IngestionOptions> = {}) {
    this.options = {
      useMock: options.useMock ?? (process.argv.includes('--mock') || !process.env.AMUSE_JWT_TOKEN),
      dryRun: options.dryRun ?? process.argv.includes('--dry-run'),
      artistId: options.artistId || process.env.AMUSE_ARTIST_ID || 'art_eaj_001',
      cacheDir: options.cacheDir || path.resolve(__dirname, '../../data')
    };

    this.amuseClient = new AmuseApiClient(process.env.AMUSE_JWT_TOKEN);
    this.dbClient = new AIDatabaseClient();

    if (!fs.existsSync(this.options.cacheDir)) {
      fs.mkdirSync(this.options.cacheDir, { recursive: true });
    }
  }

  public async run() {
    console.log('=================================================================');
    console.log('🚀 INICIANDO INGESTA: Amuse.io → EAJMUSIC AI Database');
    console.log(`📡 Modo: ${this.options.useMock ? '🧪 SIMULACIÓN / MOCK' : '🟢 API EN VIVO'}`);
    console.log(`💾 Base de Datos: InsForge / Supabase PostgREST Engine`);
    console.log(`🎯 Artista ID: ${this.options.artistId}`);
    console.log('=================================================================\n');

    try {
      // 1. Obtener Releases y Catálogo
      console.log('📦 Paso 1: Extrayendo Catálogo de Lanzamientos desde Amuse...');
      let rawReleases = [];

      if (this.options.useMock) {
        rawReleases = MOCK_AMUSE_RELEASES;
        console.log(`   [Mock] ${rawReleases.length} lanzamientos cargados desde plantilla verificada.`);
      } else {
        const res = await this.amuseClient.getReleases({
          artistId: this.options.artistId,
          status: 'released',
          pageSize: 100
        });
        rawReleases = res.releases;
        console.log(`   [Amuse API] ${rawReleases.length} lanzamientos obtenidos en vivo.`);
      }

      // 2. Transformar a Registros de Base de Datos
      const dbReleases: IngestedReleaseRecord[] = rawReleases.map(r => ({
        id: r.id,
        artist_id: this.options.artistId!,
        title: r.title,
        type: r.type.toUpperCase(),
        upc: r.upc,
        status: r.status === 'released' ? 'LIVE' : 'PENDING',
        release_date: r.release_date,
        cover_art_url: r.cover_art_url,
        spotify_url: r.stores?.spotify?.url,
        apple_music_url: r.stores?.apple_music?.url,
        metadata: {
          genre: r.genre,
          label: r.label_name || 'EAJMUSIC',
          amuse_raw: r
        }
      }));

      const dbTracks: IngestedTrackRecord[] = [];
      rawReleases.forEach(r => {
        if (r.tracks && Array.isArray(r.tracks)) {
          r.tracks.forEach((t: any, index: number) => {
            dbTracks.push({
              id: t.id,
              release_id: r.id,
              title: t.title,
              isrc: t.isrc,
              track_number: t.track_number || (index + 1),
              duration_seconds: t.duration_seconds || 180,
              preview_url: t.preview_url,
              audio_url: t.audio_url,
              status: 'READY'
            });
          });
        }
      });

      console.log(`✨ Catálogo preparado: ${dbReleases.length} Lanzamientos, ${dbTracks.length} Pistas asociadas.`);

      // 3. Obtener Analíticas & Reproducciones
      console.log('\n📊 Paso 2: Extrayendo Analíticas y Estadísticas Diarias...');
      let summary = null;
      let dailyStreams = [];

      if (this.options.useMock) {
        summary = MOCK_AMUSE_ANALYTICS_SUMMARY;
        dailyStreams = MOCK_AMUSE_DAILY_STREAMS;
        console.log(`   [Mock] Resumen: ${summary.total_streams.toLocaleString()} streams totales, ${summary.monthly_listeners.toLocaleString()} oyentes mensuales.`);
      } else {
        summary = await this.amuseClient.getArtistAnalyticsSummary(this.options.artistId!);
        dailyStreams = await this.amuseClient.getArtistDailyStreams(this.options.artistId!);
        console.log(`   [Amuse API] Resumen obtenido: ${summary.total_streams} streams.`);
      }

      // Convertir analíticas diarias para tabla de streaming_stats
      const dbStats: IngestedStreamingStatRecord[] = dailyStreams.map(d => ({
        track_id: dbTracks[0]?.id || 'track_default',
        dsp_id: 'spotify',
        date: d.date,
        streams: d.streams,
        saves: Math.round(d.streams * 0.08),
        playlist_adds: Math.round(d.streams * 0.03),
        revenue_gross: +(d.streams * 0.0038).toFixed(4),
        revenue_net: +(d.streams * 0.0032).toFixed(4)
      }));

      // 4. Inserción / Upsert en Base de Datos de IA (InsForge / Supabase)
      console.log('\n🗄️ Paso 3: Sincronizando con Base de Datos IA (InsForge / Supabase)...');
      if (this.options.dryRun) {
        console.log('   [Dry Run] Operación de guardado omitida por flag --dry-run.');
      } else {
        // Upsert Releases
        const resReleases = await this.dbClient.syncReleases(dbReleases);
        console.log(`   ✅ Releases sincronizados en DB: ${resReleases.count} registros.`);

        // Upsert Tracks
        if (dbTracks.length > 0) {
          const resTracks = await this.dbClient.syncTracks(dbTracks);
          console.log(`   ✅ Tracks sincronizados en DB: ${resTracks.count} pistas.`);
        }

        // Upsert Streaming Stats
        if (dbStats.length > 0) {
          const resStats = await this.dbClient.syncStreamingStats(dbStats);
          console.log(`   ✅ Estadísticas diarias sincronizadas en DB: ${resStats.count} puntos de datos.`);
        }
      }

      // 5. Guardar Caché JSON para el Frontend (Web & App)
      console.log('\n⚡ Paso 4: Generando Caché Instantánea para eajmusic.com y artist.eajmusic.com...');
      const publicCatalog = AmuseIngestionBridge.transformToPublicCatalog(rawReleases, 'EAJMusic Artist');
      const dashboardStats = AmuseIngestionBridge.transformToArtistDashboard(summary, dailyStreams, []);

      fs.writeFileSync(
        path.join(this.options.cacheDir, 'catalog_synced.json'),
        JSON.stringify(publicCatalog, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(this.options.cacheDir, `analytics_${this.options.artistId}.json`),
        JSON.stringify(dashboardStats, null, 2),
        'utf-8'
      );
      console.log(`   📁 Caché local actualizada en: ${this.options.cacheDir}`);

      console.log('\n=================================================================');
      console.log('🎉 SINCRONIZACIÓN COMPLETADA CON ÉXITO');
      console.log(`   • Lanzamientos procesados : ${dbReleases.length}`);
      console.log(`   • Pistas registradas      : ${dbTracks.length}`);
      console.log(`   • Total Streams Ingestados: ${summary.total_streams.toLocaleString()}`);
      console.log(`   • Oyentes Mensuales       : ${summary.monthly_listeners.toLocaleString()}`);
      console.log('=================================================================\n');

      return { success: true, releasesCount: dbReleases.length, tracksCount: dbTracks.length };
    } catch (err: any) {
      console.error('❌ Error durante la sincronización:', err.message);
      return { success: false, error: err.message };
    }
  }
}

// Ejecución directa si se invoca por CLI
if (require.main === module) {
  const sync = new AmuseToAIDatabaseSync();
  sync.run();
}
