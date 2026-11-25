export type UserRole = 'artist' | 'admin';
export type ViewState = 'login' | 'artist_app' | 'admin_dashboard';
export type ReleaseStatus = 'pending' | 'approved' | 'ready_for_bot' | 'uploaded' | 'rejected';

export interface SplitContributor {
  id: string;
  name: string;
  email: string;
  role: 'Artist' | 'Producer' | 'Composer' | 'Songwriter' | 'Label' | 'Other';
  percentage: number;
}

export interface Track {
  id: string;
  title: string;
  version: string;
  hasFeaturedArtists: boolean;
  featuredArtists?: string; 
  tiktokStart: string;
  explicitType: 'Clean' | 'Explicit' | 'Instrumental';
  hasLyrics: boolean;
  lyrics: string;
  composer?: string;
  producers?: string;
  audioUrl?: string;
  coverUrl?: string;
  splitSheetUrl?: string;
  splits?: SplitContributor[];
}

export interface Release {
  id: string;
  artistId: string;
  title: string;
  coverUrl: string | null;
  releaseDate: string;
  submissionDate: string;
  type: 'Single' | 'EP' | 'Album';
  genre: string;
  mainArtist: string;
  soundEngineers: string;
  mixingEngineers: string;
  masteringEngineers: string;
  tracks: Track[];
  splitSheetUrl: string | null;
  splits?: SplitContributor[];
  status: ReleaseStatus;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  walletBalance: number;
}