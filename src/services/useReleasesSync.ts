/**
 * ⚡ HOOK REACTIVO: useReleasesSync
 * Ubicación: src/services/useReleasesSync.ts
 *
 * Conecta componentes React de artist.eajmusic.com y eaj.eajmusic.com
 * al flujo reactivo sin recargas de página ni cookies compartidas.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Release,
  SyncEventPayload,
  ReleasesSyncClient,
  defaultReleasesSyncClient
} from './releasesSyncClient';

export interface UseReleasesSyncOptions {
  client?: ReleasesSyncClient;
  initialReleases?: Release[];
  autoConnect?: boolean;
}

export function useReleasesSync(options: UseReleasesSyncOptions = {}) {
  const client = options.client || defaultReleasesSyncClient;
  const [releases, setReleases] = useState<Release[]>(options.initialReleases || []);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SyncEventPayload | null>(null);

  const fetchReleases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await client.fetchReleases();
      setReleases(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar catálogo de releases');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (options.autoConnect !== false) {
      client.connect();
    }

    fetchReleases();

    const unsubscribe = client.subscribe((event: SyncEventPayload) => {
      setLastEvent(event);

      if (event.type === 'RELEASE_CREATED' && event.release) {
        setReleases((prev) => {
          // Evitar duplicados
          const exists = prev.some((r) => r.id === event.release!.id);
          if (exists) return prev;
          return [event.release!, ...prev];
        });
      }

      if (event.type === 'RELEASE_STATUS_UPDATED' && event.release) {
        setReleases((prev) =>
          prev.map((r) => (r.id === event.release!.id ? { ...r, ...event.release } : r))
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [client, fetchReleases, options.autoConnect]);

  const createRelease = useCallback(
    async (payload: Partial<Release>) => {
      const created = await client.createRelease(payload);
      // Actualización optimista local
      setReleases((prev) => {
        const exists = prev.some((r) => r.id === created.id);
        if (exists) return prev;
        return [created, ...prev];
      });
      return created;
    },
    [client]
  );

  const approveRelease = useCallback(
    async (id: string, notes?: string) => {
      const updated = await client.approveRelease(id, notes);
      setReleases((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      return updated;
    },
    [client]
  );

  const rejectRelease = useCallback(
    async (id: string, reason: string) => {
      const updated = await client.rejectRelease(id, reason);
      setReleases((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      return updated;
    },
    [client]
  );

  const updateStatus = useCallback(
    async (id: string, status: string, notes?: string) => {
      const updated = await client.updateReleaseStatus(id, status, notes);
      setReleases((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      return updated;
    },
    [client]
  );

  return {
    releases,
    loading,
    error,
    lastEvent,
    reload: fetchReleases,
    createRelease,
    approveRelease,
    rejectRelease,
    updateStatus
  };
}

export default useReleasesSync;
