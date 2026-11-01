/**
 * Amuse Ingestion Bridge for EAJMUSIC Platform
 * Transforms upstream Amuse.io metadata and analytics into EAJMusic platform native schema.
 */

import { AmuseRelease, AmuseAnalyticsSummary, AmuseDailyStreamPoint, AmusePlaylistPlacement } from './types';

export interface EAJPublicReleaseCard {
  id: string;
  title: string;
  artistName: string;
  coverArt: string;
  releaseDateFormatted: string;
  primaryGenre: string;
  trackCount: number;
  upc: string;
  isrcCodes: string[];
  streamingLinks: {
    spotify?: string;
    appleMusic?: string;
    youtube?: string;
  };
  badge: 'Nuevo Lanzamiento' | 'Top Sello' | 'Catálogo';
}

export interface EAJArtistDashboardStats {
  artistId: string;
  totalPlays: string; // e.g. "2.4M"
  monthlyAudience: string; // e.g. "185.2K"
  topCountryName: string;
  topCountryPct: number;
  dailyGraph: Array<{
    dia: string;
    reproducciones: number;
  }>;
  activePlaylistsCount: number;
  topPlaylists: Array<{
    nombre: string;
    plataforma: string;
    curador: string;
    seguidores: string;
  }>;
}

export class AmuseIngestionBridge {
  /**
   * Transforma releases crudos de Amuse para el catálogo público de eajmusic.com
   */
  public static transformToPublicCatalog(
    amuseReleases: AmuseRelease[],
    artistNameDefault: string = 'Artista EAJMusic'
  ): EAJPublicReleaseCard[] {
    return amuseReleases.map(rel => {
      const isrcs = rel.tracks ? rel.tracks.map(t => t.isrc).filter(Boolean) : [];
      const primaryArtist = rel.tracks?.[0]?.contributors?.find(c => c.role === 'primary_artist')?.name || artistNameDefault;
      const primaryGenre = rel.tracks?.[0]?.genre || 'Urbano / Indie';

      const releaseDateObj = new Date(rel.releaseDate);
      const formattedDate = releaseDateObj.toLocaleDateString('es-PR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      // Calificar badge
      const isRecent = (Date.now() - releaseDateObj.getTime()) < (30 * 24 * 60 * 60 * 1000);
      const badge: EAJPublicReleaseCard['badge'] = isRecent ? 'Nuevo Lanzamiento' : 'Catálogo';

      return {
        id: rel.id,
        title: rel.title,
        artistName: primaryArtist,
        coverArt: rel.coverArtUrl,
        releaseDateFormatted: formattedDate,
        primaryGenre,
        trackCount: rel.tracks?.length || 1,
        upc: rel.upc || 'N/A',
        isrcCodes: isrcs,
        streamingLinks: {
          spotify: `https://open.spotify.com/search/${encodeURIComponent(rel.title + ' ' + primaryArtist)}`,
          appleMusic: `https://music.apple.com/us/search?term=${encodeURIComponent(rel.title + ' ' + primaryArtist)}`,
          youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(rel.title + ' ' + primaryArtist + ' audio oficial')}`
        },
        badge
      };
    });
  }

  /**
   * Transforma analíticas de Amuse para el portal privado de artistas (artist.eajmusic.com)
   */
  public static transformToArtistDashboard(
    summary: AmuseAnalyticsSummary,
    dailyPoints: AmuseDailyStreamPoint[],
    playlists: AmusePlaylistPlacement[]
  ): EAJArtistDashboardStats {
    const formatNumberK = (num: number): string => {
      if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
      if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
      return num.toLocaleString();
    };

    const topCountry = summary.topCountries?.[0] || { countryName: 'Puerto Rico', percentage: 100 };

    return {
      artistId: summary.artistId,
      totalPlays: formatNumberK(summary.totalStreams),
      monthlyAudience: formatNumberK(summary.monthlyListeners),
      topCountryName: topCountry.countryName,
      topCountryPct: Math.round(topCountry.percentage),
      dailyGraph: dailyPoints.map(p => ({
        dia: p.date.slice(5), // "MM-DD"
        reproducciones: p.streams
      })),
      activePlaylistsCount: playlists.length,
      topPlaylists: playlists.slice(0, 10).map(pl => ({
        nombre: pl.playlistName,
        plataforma: pl.platform.toUpperCase(),
        curador: pl.curatorType === 'editorial' ? 'Editorial DSP' : 'Comunidad / Algorítmica',
        seguidores: formatNumberK(pl.followerCount)
      }))
    };
  }
}
