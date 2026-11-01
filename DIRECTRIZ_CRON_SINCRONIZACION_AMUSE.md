# ⚙️ BACK — DELEGACIÓN TÉCNICA: CRON DE SINCRONIZACIÓN AMUSE ➔ EAJMUSIC
> **De:** Líder del Equipo Web (`WEBMUSIC`)  
> **Para:** BACK (Desarrollador Backend)  
> **Prioridad:** Alta / Inmediata  
> **Módulo Asignado:** `integrations/amuse/`  
> **Referencia:** [`GUIA_INTEGRACION_AMUSE_EAJMUSIC.md`](file:///Users/dralanalex/orca/workspaces/EAJ/WEBMUSIC/GUIA_INTEGRACION_AMUSE_EAJMUSIC.md)  
> **Fecha:** 2026-10-31  

---

## 🎯 1. Misión
Implementar el proceso de fondo (cron de sincronización periódica) y los endpoints del servidor para consumir `AmuseSyncService`, almacenar los datos ingeridos en caché local / base de datos y servir el catálogo público y métricas a los portales `eajmusic.com` y `artist.eajmusic.com`.

---

## 📦 2. Recursos Disponibles en tu Espacio de Trabajo
El módulo `integrations/amuse/` está disponible en tu directorio raíz:
* `syncService.ts` (`AmuseSyncService`): Ejecuta el ciclo completo de ingesta (`executeFullSync()`) y guarda `catalog_synced.json` y `analytics_*.json`.
* `client.ts` (`AmuseApiClient`): Maneja la autenticación y peticiones HTTP contra `https://api.amuse.io`.
* `bridge.ts` (`AmuseIngestionBridge`): Transforma DTOs de Amuse a los esquemas de presentación de EAJMusic.
* `mockData.ts`: Permite ejecutar pruebas completas sin requerir token en vivo en el entorno de desarrollo.

---

## 🛠️ 3. Tareas Asignadas a BACK

### Tarea A: Script y Cron de Sincronización Automática
1. Crea el servicio cron en `src/cron/syncAmuseCron.ts`:
   * Frecuencia sugerida: Cada 6 horas (`0 */6 * * *`) o configurable vía `CRON_SCHEDULE_AMUSE`.
   * Lógica de ejecución:
     ```typescript
     import { AmuseSyncService } from '../../integrations/amuse';

     export async function runAmuseSync() {
       console.log('🔄 [CRON] Iniciando sincronización con Amuse API...');
       const token = process.env.AMUSE_API_TOKEN;
       const syncService = new AmuseSyncService(token);
       
       try {
         const result = await syncService.executeFullSync();
         console.log(`✅ [CRON] Sincronización exitosa: ${result.catalog.length} lanzamientos procesados.`);
         return result;
       } catch (error) {
         console.error('❌ [CRON] Error durante la sincronización:', error);
         throw error;
       }
     }
     ```

### Tarea B: Endpoints de Entrega en la API (`api.eajmusic.com/v1`)
Debes exponer los siguientes endpoints en tu servidor Express / Fastify / Node:
1. `GET /v1/catalog`:
   - Lee `data/catalog_synced.json` (generado por `AmuseSyncService`).
   - Retorna array de `EAJPublicReleaseCard`.
   - Incluye header `Cache-Control: public, max-age=300`.
2. `GET /v1/artists/:id/analytics`:
   - Lee `data/analytics_:id.json`.
   - Retorna objeto `EAJArtistDashboardStats`.
3. `POST /v1/admin/sync-amuse`:
   - Protegido con middleware de autenticación (rol `SUPER_ADMIN`).
   - Dispara inmediatamente `syncService.executeFullSync()` sin esperar al cron.
   - Retorna `{ success: true, timestamp: ISOString, count: number }`.

### Tarea C: Variables de Entorno Requeridas
Configura en `.env.example`:
```env
# Configuración Amuse Ingestion
AMUSE_API_TOKEN=tu_token_bearer_aqui
AMUSE_EMAIL=admin@eajmusic.com
AMUSE_PASSWORD=tu_clave_segura
CRON_SCHEDULE_AMUSE="0 */6 * * *"
```

---

## 🚀 Entregable
Implementa el cron y los endpoints, y comitea tus cambios en tu rama con el mensaje:
`feat(back): implementacion del cron de sincronizacion amuse y endpoints de catalogo y metricas`
