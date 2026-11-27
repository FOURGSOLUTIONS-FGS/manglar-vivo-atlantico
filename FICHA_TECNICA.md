# Ficha Técnica — Manglar Vivo Atlántico (Hackathon CRA / Vit Arena 2026)

- **Aplicación en producción:** https://manglar.arpadura.com
- **Repositorio oficial:** https://github.com/FOURGSOLUTIONS-FGS/manglar-vivo-atlantico
- **Video Demo 1080p (público):** https://nhyicthczgjfzreneiuc.supabase.co/storage/v1/object/public/demo-media/Manglar_Vivo_Atlantico_Demo_VitArena.mp4
- **Release GitHub v2.0.0:** https://github.com/FOURGSOLUTIONS-FGS/manglar-vivo-atlantico/releases/tag/v2.0.0
- **Brief Ejecutivo PDF:** [docs/Brief_Entregable_VitArena_Manglar_Vivo_Atlantico.pdf](./docs/Brief_Entregable_VitArena_Manglar_Vivo_Atlantico.pdf)

## 1. Resumen de la solución y las 3 preguntas de gobernanza

1. **¿Dónde ocurre una amenaza o cambio en el manglar ahora mismo, qué pasa y con qué prioridad coincide?**
   - **Captura ciudadana offline en 3 pasos (`/reportar`):** 4 dominios ambientales × 12 factores específicos (`Cobertura y Suelo`, `Agua y Salud del Dosel`, `Contaminación y Residuos`, `Fauna y Verificación Viva`), multi-evidencia fotográfica (1 a 3 fotos preservando metadatos originales), **dictado por voz universal** (vía `/api/ai/transcribe` en móvil iOS/Android y escritorio) y `timestamp_captura` ISO-8601.
   - **Monitor Satelital de Fuego NASA FIRMS en Vivo (`/api/nasa-fires`):** ingesta directa en tiempo real (sin clave de terceros) de los satélites **NOAA-20 y NOAA-21 VIIRS 375 m (últimas 24 h)** cruzada espacialmente con los 4 sectores costeros del Atlántico, visible en el CRM `/admin` y consultable en 1 toque desde WhatsApp.
   - **Estaciones físicas NFC y QR (`/p/1` a `/p/4`):** etiquetas ultracortas (`NTAG213/215/216`) que abren la vista de cada sector con ráster Sentinel-2, minimapa exacto, **audioguía MP3 en voz colombiana (`es-CO`)**, **Pasaporte Costero de 4 sellos**, pistas en terreno, guía de las **4 especies locales** (*Rhizophora mangle*, *Avicennia germinans*, *Laguncularia racemosa*, *Conocarpus erectus*) y módulo de sensores de agua (`/api/telemetry`, 5 variables de campo CRA/Uninorte).
   - **GPS honesto y capas oficiales:** usa `getCurrentPosition` sin inventar coordenadas silenciosamente; el modo presentación en salón etiqueta `SIMULADO (DEMO)` en UI, base de datos, correos y exportaciones. Cruce espacial offline contra **9,408 polígonos costeros** del KMZ CRA, **1,069.6 ha de manglar probable**, **828 ha por revisar** y **262 ha de dosel seco 2026**.

2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - **Escudo anti-spam / anti-troll de 6 capas (`src/core/security/anti-spam.ts`):** Honeypot invisible, temporizador humano mínimo (`>= 2.5 s`), geocerca estricta del Atlántico, filtro de texto basura/phishing/insultos, detección de fotos duplicadas por hash **SHA-256**, rate limiting y cooldown anti-bombardeo de correos urgentes (`13/13` pruebas automatizadas en `npm test`).
   - **Filtro Visual IA Anti-Falsos (`/api/ai/classify`):** `15/15 (100 %)` rechazo a interiores, personas y **fotos tomadas a pantallas de computador/portátil incluso mostrando manglares** (penalización `0/25` y bloqueo automático de alertas rojas), con reglas botánicas anti-confusión para raíces zancudas normales de *Rhizophora mangle*.
   - **Semáforo de Confiabilidad (0–100 pts) + Doble Validación (`/validar`):** contraste en **PostgreSQL / PostGIS** con los **524 puntos reales (*ground-truth*)** de la CRA, corroboración de focos múltiples (`≤ 1.8 km`) y validación comunitaria + académica.
   - **Centro de Mando Operativo y Decisiones (`/admin`):** Índice de Presión Operativa (0–100), Simulador Táctico de Cuadrillas, trazabilidad por canal de entrada (`WhatsApp`, `Telegram`, `Instagram`, `Facebook`, `SMS`, `NFC`, `QR`, `App PWA`), despacho automático de correos ejecutivos con **minimapa satelital PNG (`/api/minimap`)** y envío manual a cualquier correo en 1 clic.

3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Asistente Interactivo de WhatsApp (vía Zernio, `/api/webhooks/zernio`):** sin descargas ni registros — ofrece menú visual con foto, **carrusel deslizable nativo de 4 tarjetas con foto y botón de audioguía**, solicitud nativa de **ubicación en 1 toque**, transcripción de **notas de voz**, botón **`🔥 Fuego NASA hoy`**, auditoría visual IA inmediata con respuesta en minimapa satelital y creación automática del reporte en el CRM con `Canal: WHATSAPP`.
   - **Lenguaje 100 % amigable para todas las edades:** toda la interfaz ciudadana y operativa sustituye jerga técnica por español claro, con identidad visual oficial CRA, logo propio y tarjetas OpenGraph dinámicas (`/api/og`) al compartir cualquier enlace.
   - **Modo Escuelas PRAES (`/escuelas`) y Participación (`/participacion`):** adopción de las `828 ha por revisar`, cierre de ciclo público por código `MGL-XXXX`, registro de actores (Ley 1581), listas de chequeo Res. 1263/2018 y borradores automáticos **MGA (DNP)** y **CO₂e (`× 3.667`)**.

## 2. Arquitectura y Stack Tecnológico (SOLID + Offline-First + Rendimiento 2G/3G)

- **Frontend & PWA:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, **GSAP + ScrollTrigger**, tipografía oficial CRA (`Lato` + `Archivo`), imágenes optimizadas (`-91 %` en peso de portada), compresión HTTP + caché inmutable y desplazamiento nativo en móviles de gama baja.
- **Offline-First en Campo:** Service Worker liviano (`/sw.js`, precache `< 250 KB`, timeout `2 s`) + almacenamiento local en el navegador (`idb`) guardando fotografías originales con metadatos intactos para sincronización automática al volver la señal.
- **Arquitectura SOLID de Alertas (`src/core/alerts/`):** `classifier.ts` (SRP), `routing.ts` (SRP), `email-template.ts` (SRP), canales intercambiables `SmtpNotificationChannel` / `ResendNotificationChannel` / `WebhookNotificationChannel` (OCP + LSP) y `dispatcher.ts` (DIP) con auditoría persistente en `alert_dispatches`.
- **Omnicanalidad (Zernio API):** integración completa en `src/lib/zernio.ts`, `/api/zernio` y `/api/webhooks/zernio` con verificación de firma, deduplicación por evento y anonimización de remitentes por hash SHA-256 (Ley 1581).
- **Geoespacial y Base de Datos:** Pipeline Python (`convert_cra_geodata.py`, KMZ + UTM 18N `EPSG:32618` → WGS84 `EPSG:4326`), Turf.js offline + Leaflet satelital + **PostgreSQL 17 / PostGIS**, Realtime y Storage en Supabase (`nhyicthczgjfzreneiuc`).

## 3. Transparencia de Inteligencia Artificial (Uso Documentado para Vit Arena)

| Etapa | Herramienta / Modelo de IA | Propósito |
| :--- | :--- | :--- |
| **Auditoría visual en tiempo real (`/api/ai/classify`)** | **OpenRouter — Primario: `google/gemini-2.5-flash`** (respaldos Gemini Flash Lite / Hydrogen + fallback seguro offline) | Validación anti-falsos (15/15 = 100 %, rechaza pantallas de PC e interiores), detección de rostros Ley 1581 y clasificación en 12 factores ambientales. |
| **Transcripción de voz (`/api/ai/transcribe`)** | **OpenRouter — `google/gemini-2.5-flash` (`input_audio`)** | Dictado por voz universal en móviles (iOS/Android) y notas de voz enviadas por WhatsApp. |
| **Audioguías y locución de demo** | **Microsoft Neural TTS (`es-CO-SalomeNeural` y `es-MX-DaliaNeural`)** + masterización FFmpeg | 4 audioguías inclusivas de campo en voz colombiana (`public/media/audio/estacion-1..4.mp3`) y locución de estudio del video demo 1080p. |
| **Identidad visual y material editorial** | Generación de logo institucional y piezas gráficas (`image-generator`) + rásters reales Sentinel-2 y video aéreo oficial CRA | Logo oficial de la app, icono PWA, tarjeta OpenGraph (`/api/og`) y visuales de estaciones turísticas/escolares. |
| **Ingeniería y verificación** | Asistente agéntico (Antigravity / Gemini) | Conversión KMZ/UTM 18N, arquitectura PostGIS/PWA/SOLID/Zernio/NASA FIRMS, pruebas automatizadas y producción de video HyperFrames. |

## 4. Diccionario de Datos Abiertos (Gobierno Digital — Ley 1581 de 2012)

Endpoints públicos: `GET /api/open-data?format=csv` y `GET /api/open-data?format=geojson`.
Todos los registros se exportan **100 % anonimizados** (cero teléfonos, correos ni nombres personales):
- `tracking_code`, `timestamp_captura` (ISO-8601), `latitud`, `longitud`, `precision_gps_m`, `is_simulated_gps`, `zona_manglar`, `municipio`, `sector_id`, `accion_plan`, `en_zona_por_revisar`, `canal_ingreso`, `factor_dominio`, `subtipo_evento`, `tipo_evento`, `nivel_alerta`, `foto_validada_ia`, `descripcion_ciudadana`, `perfil_reportante`, `estado_sincronizacion`, `estado_validacion`, `attention_status`, `clasificacion_tecnica`, `nivel_prioridad`, `puntaje_confiabilidad`, `evidencia_foto_url`.
