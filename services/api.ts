/// <reference types="vite/client" />
import axios from 'axios';

// En un entorno real, esto vendría de una variable de entorno (.env)
const API_URL = import.meta.env?.VITE_API_URL || 'https://api.eajmusic.com/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token de autenticación a cada llamada
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores globales (ej: token expirado)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Lógica para redirigir al login o refrescar token
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Servicios específicos (Ejemplos)
export const ArtistService = {
  getProfile: () => api.get('/artist/profile'),
  updateProfile: (data: any) => api.put('/artist/profile', data),
  getStats: () => api.get('/artist/stats'),
};

export const ReleaseService = {
  create: (data: any) => api.post('/releases', data),
  uploadAsset: (releaseId: string, file: File, type: 'audio' | 'cover') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return api.post(`/releases/${releaseId}/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getAll: () => api.get('/releases'),
};