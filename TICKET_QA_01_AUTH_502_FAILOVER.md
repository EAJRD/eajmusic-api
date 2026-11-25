# 🚨 TICKET DE RESOLUCIÓN QA: TICKET-BACK-001
**Para:** BACK  
**De:** Gerente de Proyecto EAJMUSIC  
**Prioridad:** P0 (Bloqueo Crítico)  

### Problema Reportado por QA
* Error **HTTP 502 Bad Gateway** al intentar `POST https://api.eajmusic.com/api/auth/register` o `/login`.
* La aplicación en producción congela la interfaz con el mensaje: `Network request failed: Failed to fetch`.

### Tareas Asignadas a BACK
1. **Configurar Failover Resiliente:** Si el túnel Cloudflare o el backend primario en Proxmox falla o devuelve 502/504, el cliente de API debe conmutar automáticamente a la sesión de respaldo o base de datos Supabase (`https://gniqkwyedexeeruznwgn.supabase.co`).
2. **Endpoints de Autenticación Garantizados:**
   - Asegurar que el backend local (`BACK/src/server.js`) y el backend de producción respondan a `/api/auth/login` y `/api/auth/register` con tokens JWT válidos y perfil de usuario completo.
3. **Manejo de Errores de Red:** Devolver respuestas estructuradas en JSON incluso ante fallos de conexión externa.
