---
name: offline-field-pwa
description: >-
  Use when implementing or debugging offline-first PWA behavior, IndexedDB sync
  queues, Service Worker caching, honest GPS geolocation, or EXIF-preserving
  photo capture for the mangrove field reporting app.
---

# PWA Offline-First en Campo (Patrón Actas Digitales GE)

Patrones probados extraídos de `FOURGSOLUTIONS-FGS/gestiones-electricas-actas` adaptados para captura ciudadana de reportes en zonas de manglar con conectividad intermitente o nula.

## 1. Service Worker (`sw.js` / Workbox)

- **App Shell precacheado:** Cachear el HTML de la ruta ciudadana (`/`, `/reportar`, `/turista`, `/escuelas`), JS/CSS esenciales, íconos y los GeoJSON ligeros (`cra_sectors.geojson`, `cra_mangrove_layers.geojson`, `coastal_priorities_light.geojson`) para que la app **abra en frío en modo avión**.
- **Regla de red para datos:** Todas las peticiones a `/api/*` y Supabase REST/Storage van **directo a red** (nunca se cachean mutaciones en el Service Worker; las maneja IndexedDB).
- **Navegación:** `NetworkFirst` con timeout corto (2.5 s) y fallback a shell cacheado.
- **Bump obligatorio de `VERSION`:** Cada vez que cambie un asset crítico o lógica de captura/cola, incrementar la constante `VERSION` del Service Worker para evitar servir código viejo desde caché en móviles de campo.

## 2. Cola Offline en IndexedDB

Mantener dos *object stores* dedicados (evita el límite ~5 MB de `localStorage` cuando hay fotografías):
1. `pending_reports`:
   - `client_uuid` (UUID v4 generado en cliente para **idempotencia total** al reintentar).
   - `payload` JSON con todos los campos del reporte (`timestamp_captura`, `latitud`, `longitud`, `precision_gps_m`, `is_simulated_gps`, `tipo_evento`, `perfil_reportante`, `contexto_espacial_offline`, `ai_local_hint`).
   - `photo_original` (`Blob` original preservando EXIF) + `photo_preview` (DataURL/Blob comprimido máx. 1000 px para UI rápida).
   - `status`: `'pendiente_offline'` | `'sincronizando'` | `'error'`, `retries`, `last_error`.
2. `drafts`: borrador en curso para no perder el formulario si el navegador móvil recarga la pestaña por falta de memoria.

### Disparadores de sincronización (`flushOfflineQueue`)
- Evento `window.addEventListener('online', ...)`
- Evento `document.addEventListener('visibilitychange', ...)` cuando vuelve a visible y `navigator.onLine === true`
- Botón manual visible **"Sincronizar ahora (N pendientes)"** en la cabecera/banner de estado.
- Al subir a Supabase: primero subir `photo_original` a Storage (usando `client_uuid` en la ruta), luego hacer `upsert` idempotente en `citizen_reports` por `client_uuid`. Borrar de `pending_reports` solo cuando la respuesta sea `2xx` o error permanente `400/409` ya confirmado.

## 3. GPS Honesto y Modo Demo Explícito

- Usar `navigator.geolocation.watchPosition` con `{ enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }`.
- Mostrar siempre el indicador de precisión:
  - `<= 20 m`: verde ("Ubicación precisa").
  - `21–80 m`: ámbar ("Ubicación aproximada").
  - `> 80 m` o error: advertencia clara invitando a salir a cielo abierto o reintentar.
- **Regla de honestidad:** Si el dispositivo no entrega GPS, **no inventar** coordenadas por defecto en silencio.
- **Modo Demo para Jurado (en salón cerrado):** Incluir un toggle explícito **"Simular sitio en el Atlántico (Demo)"** con puntos predefinidos reales (ej. *Juan de Acosta — Zona por revisar*, *Mallorquín — Riesgo alto*, *Totumo — Manglar probable*). Cuando se use, guardar `is_simulated_gps = true` y mostrar un badge `SIMULADO (DEMO)`.

## 4. Protocolo de verificación en Modo Avión (antes de demo)

1. Cargar la app online una vez y confirmar que el indicador muestre `"Listo para campo (offline disponible)"`.
2. Activar **Modo Avión** (o DevTools → Network → Offline).
3. Recargar la página: debe abrir completa con mapa/capas cacheadas.
4. Crear un reporte en 3 pasos con fotografía y ubicación; verificar que el cruce espacial indique sector y prioridad **sin red** y el badge cambie a `"1 reporte en cola offline"`.
5. Desactivar Modo Avión: confirmar que la cola se vacía automáticamente y el reporte aparece en vivo en el Dashboard CRA.
