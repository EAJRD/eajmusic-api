/**
 * ⚙️ EAJMUSIC BACKEND — CRON DE SINCRONIZACIÓN AUTOMÁTICA AMUSE
 * Ubicación: src/cron/syncAmuseCron.ts
 * Descripción: Descarga periódicamente lanzamientos y analíticas desde api.amuse.io
 * y actualiza data/catalog_synced.json y la base de datos PostgreSQL.
 */

import { AmuseSyncService } from '../../integrations/amuse';

export async function runAmuseSync(): Promise<{ success: boolean; catalogCount: number; timestamp: string }> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔄 [AMUSE CRON] Iniciando proceso de ingesta...`);

  const apiToken = process.env.AMUSE_API_TOKEN;
  const syncService = new AmuseSyncService(apiToken);

  try {
    const result = await syncService.executeFullSync();
    console.log(`[${timestamp}] ✅ [AMUSE CRON] Ingesta finalizada con éxito.`);
    console.log(`[${timestamp}] 📊 Lanzamientos sincronizados: ${result.catalog.length}`);
    
    return {
      success: true,
      catalogCount: result.catalog.length,
      timestamp
    };
  } catch (error) {
    console.error(`[${timestamp}] ❌ [AMUSE CRON] Fallo crítico durante la sincronización:`, error);
    throw error;
  }
}

// Ejecución directa si se invoca desde CLI: node syncAmuseCron.js
if (require.main === module) {
  runAmuseSync()
    .then((res) => {
      console.log('🏁 Proceso finalizado:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Error en ejecución:', err);
      process.exit(1);
    });
}
