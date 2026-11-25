/**
 * Mock Data con la estructura exacta de Amuse API
 * Usado para desarrollo local y render inicial en eajmusic.com y artist.eajmusic.com
 */

import { AmuseRelease, AmuseAnalyticsSummary, AmuseDailyStreamPoint, AmusePlaylistPlacement } from './types';

export const MOCK_AMUSE_ARTIST_ID = 'art_eaj_001';

export const MOCK_AMUSE_RELEASES: AmuseRelease[] = [
  {
    id: 'rel_amuse_01',
    title: 'Sentimiento Urbano (Remix)',
    type: 'single',
    status: 'released',
    upc: '7427258901234',
    releaseDate: '2026-10-15',
    coverArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80',
    pLine: '2026 EAJMusic / Empire Animations Joyful',
    cLine: '2026 EAJMusic',
    labelName: 'EAJMusic',
    stores: ['spotify', 'apple_music', 'tidal', 'tiktok', 'youtube_music'],
    storeStatuses: {
      spotify: 'live',
      apple_music: 'live',
      tiktok: 'live',
      youtube_music: 'live'
    },
    tracks: [
      {
        id: 'trk_01',
        title: 'Sentimiento Urbano (Remix)',
        sequenceNumber: 1,
        durationSeconds: 198,
        isrc: 'US-EAJ-26-00101',
        explicit: false,
        genre: 'Reggaetón / Urbano Latino',
        contributors: [
          { name: 'Ernesto', role: 'primary_artist' },
          { name: 'EAJ Producer', role: 'producer' }
        ]
      }
    ]
  },
  {
    id: 'rel_amuse_02',
    title: 'Noche en San Juan',
    type: 'single',
    status: 'released',
    upc: '7427258901241',
    releaseDate: '2026-09-28',
    coverArtUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    pLine: '2026 EAJMusic / Empire Animations Joyful',
    cLine: '2026 EAJMusic',
    labelName: 'EAJMusic',
    stores: ['spotify', 'apple_music', 'tidal', 'tiktok'],
    storeStatuses: {
      spotify: 'live',
      apple_music: 'live',
      tiktok: 'live'
    },
    tracks: [
      {
        id: 'trk_02',
        title: 'Noche en San Juan',
        sequenceNumber: 1,
        durationSeconds: 215,
        isrc: 'US-EAJ-26-00102',
        explicit: false,
        genre: 'Trap Latino / Synthwave',
        contributors: [
          { name: 'Ernesto', role: 'primary_artist' }
        ]
      }
    ]
  },
  {
    id: 'rel_amuse_03',
    title: 'Bajo La Lluvia EP',
    type: 'ep',
    status: 'released',
    upc: '7427258901258',
    releaseDate: '2026-08-14',
    coverArtUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    pLine: '2026 EAJMusic / Empire Animations Joyful',
    cLine: '2026 EAJMusic',
    labelName: 'EAJMusic',
    stores: ['spotify', 'apple_music', 'amazon_music', 'deezer'],
    storeStatuses: {
      spotify: 'live',
      apple_music: 'live'
    },
    tracks: [
      {
        id: 'trk_03_1',
        title: 'Preludio',
        sequenceNumber: 1,
        durationSeconds: 90,
        isrc: 'US-EAJ-26-00103',
        explicit: false,
        genre: 'Instrumental',
        contributors: [{ name: 'EAJ Music Collective', role: 'primary_artist' }]
      },
      {
        id: 'trk_03_2',
        title: 'Bajo La Lluvia',
        sequenceNumber: 2,
        durationSeconds: 204,
        isrc: 'US-EAJ-26-00104',
        explicit: false,
        genre: 'R&B Latino',
        contributors: [{ name: 'Ernesto', role: 'primary_artist' }]
      }
    ]
  }
];

export const MOCK_AMUSE_ANALYTICS_SUMMARY: AmuseAnalyticsSummary = {
  artistId: MOCK_AMUSE_ARTIST_ID,
  totalStreams: 1845920, // 1.8M streams
  monthlyListeners: 142800, // 142.8K oyentes mensuales
  followers: 38400,
  totalSaves: 92300,
  topCountries: [
    { countryCode: 'PR', countryName: 'Puerto Rico', streamCount: 920000, percentage: 49.8 },
    { countryCode: 'US', countryName: 'Estados Unidos', streamCount: 460000, percentage: 24.9 },
    { countryCode: 'MX', countryName: 'México', streamCount: 220000, percentage: 11.9 },
    { countryCode: 'CO', countryName: 'Colombia', streamCount: 145000, percentage: 7.8 },
    { countryCode: 'ES', countryName: 'España', streamCount: 100920, percentage: 5.6 }
  ]
};

export const MOCK_AMUSE_DAILY_STREAMS: AmuseDailyStreamPoint[] = [
  { date: '2026-10-25', streams: 18420 },
  { date: '2026-10-26', streams: 19100 },
  { date: '2026-10-27', streams: 22450 },
  { date: '2026-10-28', streams: 21800 },
  { date: '2026-10-29', streams: 26300 },
  { date: '2026-10-30', streams: 31200 },
  { date: '2026-10-31', streams: 34850 }
];

export const MOCK_AMUSE_PLAYLISTS: AmusePlaylistPlacement[] = [
  {
    id: 'pl_01',
    playlistName: 'Fuego Urbano 2026',
    platform: 'spotify',
    curatorType: 'editorial',
    trackTitle: 'Sentimiento Urbano (Remix)',
    trackId: 'trk_01',
    followerCount: 840000,
    addedAt: '2026-10-18',
    position: 4
  },
  {
    id: 'pl_02',
    playlistName: 'Vibras de Puerto Rico',
    platform: 'apple_music',
    curatorType: 'editorial',
    trackTitle: 'Noche en San Juan',
    trackId: 'trk_02',
    followerCount: 420000,
    addedAt: '2026-10-02',
    position: 12
  },
  {
    id: 'pl_03',
    playlistName: 'Descubrimiento Semanal',
    platform: 'spotify',
    curatorType: 'algorithmic',
    trackTitle: 'Sentimiento Urbano (Remix)',
    trackId: 'trk_01',
    followerCount: 1200000,
    addedAt: '2026-10-26'
  }
];
