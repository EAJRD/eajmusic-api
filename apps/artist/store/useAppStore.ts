import { create } from 'zustand';
import { User, Release } from '../types';

interface AppState {
  user: User | null;
  releases: Release[];
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (user: User) => void;
  logout: () => void;
  addRelease: (release: Release) => void;
  setReleases: (releases: Release[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  releases: [],
  isAuthenticated: false,
  isLoading: false,

  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false, releases: [] }),
  
  addRelease: (release) => set((state) => ({ 
    releases: [release, ...state.releases] 
  })),
  
  setReleases: (releases) => set({ releases }),
  setLoading: (loading) => set({ isLoading: loading }),
}));