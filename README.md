# 🌿 Manglar Vivo Atlántico — Ciencia Ciudadana, Alerta Temprana y Satélite NASA (CRA · Vit Arena)

Plataforma **offline-first**, **omnicanal (PWA + NFC + QR + WhatsApp interactivo)** y **en tiempo real** de monitoreo ciudadano, validación con Inteligencia Artificial (100 % anti-falsos), detección satelital de incendios **NASA FIRMS** y gobernanza de datos abiertos para los manglares del departamento del Atlántico (**Corporación Autónoma Regional del Atlántico — CRA**).

## 🔗 Enlaces oficiales de entrega (Vit Arena 2026)

| Recurso | Enlace público |
| :--- | :--- |
| 🌐 **Aplicación en producción (PWA Offline-First)** | https://manglar.arpadura.com |
| 🎥 **Video Demo Oficial 1080p (75 s · Voz de estudio)** | [Ver en navegador (MP4)](https://nhyicthczgjfzreneiuc.supabase.co/storage/v1/object/public/demo-media/Manglar_Vivo_Atlantico_Demo_VitArena.mp4) · [GitHub Release v2.0.0](https://github.com/FOURGSOLUTIONS-FGS/manglar-vivo-atlantico/releases/tag/v2.0.0) |
| 📄 **Brief Ejecutivo Entregable (PDF para Jurado)** | [docs/Brief_Entregable_VitArena_Manglar_Vivo_Atlantico.pdf](./docs/Brief_Entregable_VitArena_Manglar_Vivo_Atlantico.pdf) |
| 💻 **Repositorio de Código Abierto (GitHub)** | https://github.com/FOURGSOLUTIONS-FGS/manglar-vivo-atlantico |
| 🧭 **Centro de Mando CRA (CRM + Decisiones + NASA FIRMS)** | https://manglar.arpadura.com/admin |
| 🗺️ **Sala Satelital CRA + Datos Abiertos (Ley 1581)** | https://manglar.arpadura.com/cra |
| 📱 **Estación NFC / QR en Campo (Estuario Juan de Acosta)** | https://manglar.arpadura.com/p/3 (estaciones `/p/1` a `/p/4`) |
| 📋 **Ficha Técnica y Transparencia de IA** | [FICHA_TECNICA.md](./FICHA_TECNICA.md) |
| 🎤 **Guion de presentación (7 minutos)** | [PITCH_VIT_ARENA.md](./PITCH_VIT_ARENA.md) |

---

## 🎯 Las 3 preguntas mínimas de gobernanza que resuelve

1. **¿Dónde ocurre una amenaza o cambio en el manglar ahora mismo, qué pasa y con qué prioridad coincide?**
   - **Captura ultrarrápida en 3 pasos (`/reportar`):** 4 dominios × 12 factores específicos, **dictado por voz universal** (funciona en Android, iOS y desktop vía Gemini Audio), **GPS honesto** (nunca inventado; modo presentación etiquetado `SIMULADO (DEMO)`) y cruce espacial instantáneo **incluso en modo avión** contra los **9,408 polígonos costeros** del KMZ CRA, las **1,069.6 ha de manglar probable**, las **828 ha por verificar en campo** y los focos de calor en vivo de **NASA FIRMS VIIRS 375 m (NOAA-20 + NOAA-21)**.
   - **Bot Interactivo de WhatsApp (vía Zernio):** recibe reportes sin descargar apps — menú visual con foto cabecera, **carrusel deslizable de las 4 estaciones del Atlántico**, botón nativo de **ubicación 1 toque**, **notas de voz transcritas**, botón **`🔥 Fuego NASA hoy`** y trazabilidad automática `Canal: WHATSAPP` en el CRM.
2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - **Foto original intacta (EXIF preservado)** + **Escudo Anti-Spam de 6 capas** (`13/13` pruebas automatizadas) + **Filtro Visual IA Anti-Falsos (`google/gemini-2.5-flash`)** con **15/15 (100 %)** de precisión incluyendo fotos de pantallas de PC/portátiles mostrando manglares (penalización `0/25` y bloqueo automático de alertas rojas).
   - **Semáforo de Confiabilidad (0–100 pts)** + cruce en **PostgreSQL / PostGIS** con los **524 puntos reales (*ground-truth*)** de la CRA + **doble validación comunitaria y académica (`/validar`)**.
   - **Centro de Mando Operativo (`/admin`):** motor de decisiones recomendadas (Índice de Presión 0–100), simulador táctico de cuadrillas, focos corroborados (`≤ 1.8 km`), alertas sonoras en vivo y envío real de correos ejecutivos con **minimapa satelital PNG** a la CRA o a cualquier correo personalizado en 1 clic.
3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Estaciones físicas NFC y QR (`/p/1` a `/p/4`):** 1 toque sin registro abre audioguía en voz colombiana (MP3 offline), **Pasaporte Costero de 4 sellos**, retos en sitio, guía de las **4 especies locales** (mangle rojo, negro, blanco y zaragoza) y apartado de sensores de agua (`/api/telemetry`).
   - **Modo Escuelas PRAES (`/escuelas`):** adopción territorial de las `828 ha por verificar` y cierre de ciclo público con código `MGL-XXXX`.
   - **Actores y Formulación (`/participacion`):** registro de actores (Ley 1581), listas de chequeo Res. 1263/2018 y borradores prellenados **MGA (DNP)** y **CO₂e (`× 3.667`)**.
   - **Gobierno Digital abierto:** descarga en 1 clic de **CSV** y **GeoJSON** (`/api/open-data`) 100 % anonimizado conforme a la **Ley 1581 de 2012**.

---

## ✅ Verificación y pruebas reproducibles

```bash
npm install
npm test                              # 13/13 pruebas unitarias SOLID y Anti-Spam
node scripts/test_vision_dataset.mjs  # Benchmark de 15 fotos reales (100% anti-falsos/pantalla PC)
npm run build                         # Compilación producción Next.js 16 + TypeScript (24/24 rutas)
```

## 🚀 Desarrollo local

```bash
cp .env.example .env.local
# Configura Supabase, OpenRouter, Zernio y SMTP en .env.local
npm run dev
```
