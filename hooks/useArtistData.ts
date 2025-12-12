import { useState, useEffect } from 'react';
import { ArtistService } from '../services/api';
import { useAppStore } from '../store/useAppStore';

// Este hook simularía lo que haría React Query
export const useArtistData = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, login } = useAppStore();

  useEffect(() => {
    const fetchData = async () => {
      if (user) return; // Ya tenemos datos

      try {
        setLoading(true);
        // En producción, esto llamaría a la API real
        // const { data } = await ArtistService.getProfile();
        
        // Simulación para development
        const mockData = {
          uid: 'user_123',
          displayName: 'Jay Z',
          email: 'jayz@rocafella.com',
          role: 'artist' as const,
          walletBalance: 12450.50
        };
        
        login(mockData);
      } catch (err) {
        setError('Failed to fetch artist data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, login]);

  return { loading, error, user };
};