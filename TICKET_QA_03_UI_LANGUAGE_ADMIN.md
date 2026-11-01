# 🚨 TICKET DE RESOLUCIÓN QA: TICKET-WEBMUSIC-003
**Para:** WEBMUSIC  
**De:** Gerente de Proyecto EAJMUSIC  
**Prioridad:** P1 (Alta)  

### Problema Reportado por QA
* **Iconos rotos en Registro:** Los botones de selección de rol muestran texto plano `mic Artist` y `business Label`.
* **Salto de Idioma Inconsistente:** La landing está en español pero Auth y Dashboard cambian bruscamente a inglés.
* **Admin Dashboard Incompleto:** 7 de las 8 pestañas administrativas en `AdminDashboard.tsx` son placeholders "Coming soon...".

### Tareas Asignadas a WEBMUSIC
1. **Reparación de Iconos:** Implementar iconos SVG limpios o emojis nativos para el selector de rol (Artista / Sello) sin depender de fuentes externas rotas.
2. **Unificación al Español Puertorriqueño:**
   - Traducir `Login.tsx` y `Register.tsx` al español: *"Crear cuenta"*, *"Iniciar sesión"*, *"Correo electrónico"*, *"Contraseña"*, *"Artista Independiente"*, *"Sello Discográfico"*.
3. **Admin Dashboard Operativo:**
   - Asegurar que `AdminDashboard.tsx` renderice los módulos funcionales: `ReleasesList` (cola de moderación con botones de Aprobar/Rechazar), `UsersList` (suspensión/activación de cuentas), `PlansAndCommissions` (tarifas de suscripción) y `BrandSettings`.
4. **Reproductor de Catálogo en Home:**
   - Garantizar que el reproductor de audio preview permita escuchar los tracks del catálogo en `eajmusic.com`.
