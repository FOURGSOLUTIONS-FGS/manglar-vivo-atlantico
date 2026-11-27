# Manglar Vivo Atlántico — Ciencia Ciudadana CRA (Vit Arena)

Plataforma **offline-first** de monitoreo ciudadano, validación territorial de doble nivel y gobernanza abierta para los manglares del departamento del Atlántico (**Corporación Autónoma Regional del Atlántico — CRA**).

- **Demo en vivo (Producción):** https://manglar-vivo-atlantico.vercel.app
- **Ficha técnica y diccionario de datos abiertos:** [FICHA_TECNICA.md](./FICHA_TECNICA.md)

## Las 3 preguntas de gobernanza que resuelve

1. **¿Dónde ocurre una amenaza o cambio ahora mismo, qué pasa y con qué prioridad coincide?**
   - Captura ciudadana en 3 pasos (`/reportar`) con timestamp ISO-8601, GPS real (y modo demo explícitamente etiquetado `SIMULADO (DEMO)` para presentaciones en salón) y cruce geoespacial instantáneo —incluso en modo avión— contra los polígonos costeros del KMZ de la CRA, las **775 ha de manglar probable**, las **828 ha por revisar** y las **262 ha de dosel seco 2026**.
2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - Evidencia fotográfica original preservando **EXIF**, preclasificación multimodal con **OpenRouter (Gemini 2.5 Flash + respaldos Gemini 3.5 Flash Lite / Gemini 4 Hydrogen)**, contraste espacial en **PostGIS** con los **524 puntos *ground-truth*** oficiales de la CRA, **Semáforo de Confiabilidad (0–100 pts)** y consola de doble validación (`/validar`: Mentor Comunitario + Mentor Académico → Alerta Oficial CRA).
3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Modo Escuelas (`/escuelas`):** retos escolares sobre las `828 ha por revisar`, tablero por institución y **cierre de ciclo** por código `MGL-2026-XXXX`.
   - **Modo Turistas QR (`/turista`):** acceso sin fricción ni registro desde senderos eco-turísticos con ficha educativa de 30 s.
   - **Actores y Formulación (`/participacion`):** evolución real de `manglarcra.netlify.app/maqueta` con registro obligatorio de actores, checklists oficiales (Res. 1263 de 2018), flujo de 6 estados y generador automático de borradores **MGA (DNP)** y **Nota Conceptual (`× 3.667 t CO₂e`)**.

## Stack y arquitectura

- **Frontend & PWA:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Service Worker (`/sw.js`) + IndexedDB (`idb`) con sincronización automática al reconectar.
- **Geoespacial:** Turf.js offline + Leaflet multicapa + PostgreSQL 17 / PostGIS en Supabase.
- **Datos Abiertos (Ley 1581 de 2012):** Exportación en un clic desde `/cra` o vía `GET /api/open-data?format=csv` y `GET /api/open-data?format=geojson` con anonimización estricta.

## Prueba en Modo Avión (Offline-First)

1. Abre `/reportar` con conexión (el Service Worker precachea el App Shell y los GeoJSON costeros).
2. Activa **Modo Avión** (o DevTools → Network → Offline) y recarga la página.
3. Crea un reporte en 3 pasos con foto y GPS: el cruce espacial y el Semáforo funcionan sin red y el reporte queda en cola local (`IndexedDB`).
4. Desactiva **Modo Avión**: la cola sube automáticamente y aparece en tiempo real en `/cra`.

## Desarrollo local

```bash
cp .env.example .env.local
# Completa tus credenciales de Supabase y OpenRouter en .env.local
npm install
npm run dev
```

Si deseas regenerar las capas GeoJSON desde el archivo KMZ oficial de la CRA:

```bash
python3 .agents/skills/geospatial-kmz-postgis/scripts/convert_cra_geodata.py \
  --kmz "Prioridades de Conservación (1).kmz" \
  --out-dir public/data/geo \
  --tolerance 0.0003
```
