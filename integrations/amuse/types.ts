/**
 * Amuse.io API TypeScript Type Definitions
 * Source: Reverse-engineered from artist.amuse.io Nuxt.js client
 * Target: EAJMUSIC Platform Ingestion Engine
 */

export interface AmuseAuthCredentials {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface AmuseAuthResponse {
  id: string;
  token: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
  mainArtistProfileId?: string;
  createdAt: string;
}

export interface AmuseArtist {
  id: string;
  name: string;
  spotifyUri?: string;
  spotifyId?: string;
  appleArtistId?: string;
  avatarUrl?: string;
  bio?: string;
  instagramHandle?: string;
  country?: string;
  isVerified: boolean;
  activeTier: 'free' | 'boost' | 'pro';
}

export interface AmuseTrack {
  id: string;
  title: string;
  version?: string;
  sequenceNumber: number;
  durationSeconds: number;
  isrc: string;
  explicit: boolean;
  genre: string;
  subgenre?: string;
  audioFileUrl?: string;
  previewUrl?: string;
  contributors: Array<{
    name: string;
    role: 'primary_artist' | 'featured_artist' | 'producer' | 'writer' | 'composer';
    spotifyUri?: string;
  }>;
}

export interface AmuseRelease {
  id: string;
  title: string;
  type: 'single' | 'ep' | 'album';
  status: 'draft' | 'pending' | 'approved' | 'delivered' | 'released' | 'taken_down';
  upc?: string;
  releaseDate: string; // ISO Date YYYY-MM-DD
  originalReleaseDate?: string;
  coverArtUrl: string;
  pLine: string; // Phonographic copyright (P) EAJMusic
  cLine: string; // Copyright notice (C) EAJMusic
  labelName: string; // "EAJMusic"
  tracks: AmuseTrack[];
  stores: string[]; // ['spotify', 'apple_music', 'tidal', 'tiktok', 'youtube_music', 'amazon_music']
  storeStatuses?: Record<string, 'pending' | 'delivered' | 'live' | 'failed'>;
}

export interface AmuseAnalyticsSummary {
  artistId: string;
  totalStreams: number;
  monthlyListeners: number;
  followers: number;
  totalSaves: number;
  topCountries: Array<{
    countryCode: string;
    countryName: string;
    streamCount: number;
    percentage: number;
  }>;
}

export interface AmuseDailyStreamPoint {
  date: string; // YYYY-MM-DD
  streams: number;
  downloads?: number;
}

export interface AmusePlaylistPlacement {
  id: string;
  playlistName: string;
  platform: 'spotify' | 'apple_music' | 'deezer' | 'youtube';
  curatorType: 'editorial' | 'algorithmic' | 'user';
  trackTitle: string;
  trackId: string;
  followerCount: number;
  addedAt: string;
  position?: number;
}

export interface AmuseRoyaltyAgreement {
  id: string;
  releaseId: string;
  releaseTitle: string;
  splits: Array<{
    payeeName: string;
    payeeEmail: string;
    percentage: number;
    role: string;
  }>;
  totalGeneratedUsd: number;
  currency: string;
}
