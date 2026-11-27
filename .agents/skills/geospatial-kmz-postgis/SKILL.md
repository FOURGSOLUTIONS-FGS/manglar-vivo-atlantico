---
name: geospatial-kmz-postgis
description: >-
  Use when converting Prioridades de Conservación (1).kmz or CRA Atlántico
  mangrove layers (core.json, hl.json) to WGS84 GeoJSON, simplifying polygons
  for offline PWA point-in-polygon checks, or querying spatial layers in PostGIS.
---

# Geoprocesamiento KMZ / CRA → GeoJSON & PostGIS

Procedimiento estandarizado para transformar los insumos espaciales del Atlántico (KMZ de ArcGIS y capas SVG/UTM 18N de `manglarcra.netlify.app`) a **WGS84 (`EPSG:4326`)** listo tanto para el visor offline de la PWA como para **Supabase PostGIS**.

## 1. Particularidades críticas de los datos fuente

1. **`Prioridades de Conservación (1).kmz` (17.6 MB ZIP → `doc.kml` 96.3 MB):**
   - No usa `<ExtendedData>/<SimpleData>`; los atributos viven en una tabla HTML dentro de `<description>`.
   - El primer campo (`FID`) incluye saltos de línea y el nombre de la zona hidrográfica (ej. `Caribe - Litoral\n...\nFID`). Normalizar la clave quedándose con el último token (`FID`).
   - Los decimales vienen en formato español con coma (`0,01884` → `0.01884`). Convertir a `float` estándar.
   - Contiene `14,732` polígonos en todo el departamento; los `9,408` costeros corresponden a `NOMSZH` in `("Arroyos Directos al Caribe", "Cienaga Mallorquin")`.

2. **Capas oficiales de `manglarcra.netlify.app/data/core.json` y `hl.json`:**
   - Están en coordenadas locales de grilla relativas a **WGS84 / UTM Zone 18N (`EPSG:32618`)** con origen `orig = [461700, 1232920]`:
     - `Easting = 461700 + x`
     - `Northing = 1232920 - y`  *(el eje Y del SVG crece hacia abajo)*
   - Los polígonos se almacenan como strings SVG path (`M x,y L x,y ... Z`), donde cada `M...Z` es un anillo exterior o polígono independiente.

## 2. Ejecutar conversión a GeoJSON WGS84

Usa el script autocontenido (sin librerías externas) [convert_cra_geodata.py](./scripts/convert_cra_geodata.py):

```bash
python3 .agents/skills/geospatial-kmz-postgis/scripts/convert_cra_geodata.py \
  --kmz "Prioridades de Conservación (1).kmz" \
  --out-dir data/geo
```

Opciones útiles:
- `--skip-remote`: procesa solo el KMZ local sin descargar `core.json`/`hl.json`.
- `--tolerance 0.00015`: ajusta la tolerancia Douglas-Peucker (en grados WGS84, ~15 m) para mantener `coastal_priorities.geojson` liviano para cacheo offline en PWA.
- `--all-kmz`: exporta los 14,732 polígonos completos (útil para carga masiva en PostGIS; por defecto exporta los costeros + muestreo/resumen para la PWA).

## 3. Arquitectura espacial dual (Offline + PostGIS)

1. **En el cliente (PWA offline):**
   - Cachear `cra_sectors.geojson`, `cra_mangrove_layers.geojson` y `coastal_priorities_light.geojson` en Cache Storage.
   - Usar `@turf/boolean-point-in-polygon` + `@turf/nearest-point` para determinar **en modo avión** si el ciudadano está dentro de un sector de manglar, dentro de las `828 ha` por revisar, o en qué nivel de prioridad (`Alto`, `Medio`, `Bajo`) y acción (`Preservación`, `Restauración`, `Recuperación`, `Rehabilitación`) cae.
2. **En Supabase PostGIS (online):**
   - Persistir todas las geometrías con índice `GIST` (`geography(MultiPolygon, 4326)`).
   - Al sincronizar un reporte, ejecutar RPC `resolve_location_context(lat, lon)` para enriquecer el registro oficial con el cruce autoritativo del KMZ completo y la distancia al punto *ground-truth* más cercano de los `524` de `cra_ground_truth_pts.geojson`.

## 4. Validación post-conversión

El script verifica automáticamente que las coordenadas convertidas caigan dentro del bounding box del Atlántico (`lat ∈ [10.1, 11.2]`, `lon ∈ [-75.4, -74.6]`). Confirmar siempre que los 5 archivos `.geojson`/`.json` existan y no estén vacíos en `data/geo/`.
