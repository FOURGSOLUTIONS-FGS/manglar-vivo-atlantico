# Ficha Técnica — Manglar Vivo Atlántico (Hackathon CRA / Vit Arena)

## 1. Resumen de la solución y las 3 preguntas de gobernanza

1. **¿Dónde ocurre una amenaza o cambio en el manglar ahora mismo, qué pasa y con qué prioridad coincide?**
   - Captura ciudadana en 3 pasos (`/reportar`) con `timestamp_captura` ISO-8601, GPS real (`watchPosition` / `getCurrentPosition`, sin fabricar coordenadas) y cruce espacial inmediato —incluso en modo avión— contra los **9,408 polígonos costeros** de `Prioridades de Conservación (1).kmz`, las **775 ha de manglar probable**, las **828 ha por revisar** y las **262 ha de dosel seco 2026**.
2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - Fotografía original preservando metadatos **EXIF**, **Semáforo de Confiabilidad (0–100 pts)** auditable, preclasificación asistida por **IA** (`/api/ai/classify`), contraste espacial con los **524 puntos *ground-truth*** de la CRA (`resolve_location_context` en PostGIS) y consola de **doble validación** (`/validar`: Mentor Comunitario + Mentor Académico → Alerta Oficial CRA).
3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Modo Escuelas (`/escuelas`):** retos por institución educativa enfocados en verificar las 828 ha por revisar y tablero escolar + **cierre de ciclo** por código `MGL-2026-XXXX`.
   - **Modo Turistas QR (`/turista`):** acceso sin registro por estación en senderos con ficha educativa de 30 s y reporte < 1 minuto.
   - **Evolución real de `/maqueta` (`/participacion`):** registro obligatorio de actores (Reglamentación CRA), 4 listas de chequeo de 6 ítems (Res. 1263 de 2018), flujo de 6 estados y generador automático de borradores **MGA (DNP)** y **Nota Conceptual** (`t CO₂e = ha × tC/ha × 3.667`).

## 2. Arquitectura y Stack Tecnológico

- **Frontend & PWA:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 (`Fraunces` + `Lato`, paleta oficial CRA `#005F96` / `#EDB512`).
- **Offline-First en Campo:** Service Worker (`/sw.js`) con precache de App Shell y GeoJSON ligeros + **IndexedDB** (`idb`, store `pending_reports` guardando fotografía original `Blob` con EXIF intacto) con sincronización automática al recuperar conexión.
- **Geoespacial:** Python pipeline (`convert_cra_geodata.py` para KMZ + reproyección UTM 18N `EPSG:32618` → WGS84 `EPSG:4326`), Turf.js offline (`@turf/boolean-point-in-polygon`) + **Leaflet** multicapa + **PostgreSQL 17 / PostGIS** en Supabase (`nhyicthczgjfzreneiuc`).
- **Tiempo Real y Storage:** Supabase Realtime (`citizen_reports`, `report_validations`) y Supabase Storage (`report-evidence`).

## 3. Transparencia de Inteligencia Artificial (Uso Documentado)

| Etapa | Herramienta / Modelo de IA | Propósito |
| :--- | :--- | :--- |
| **En tiempo de ejecución (`/api/ai/classify`)** | **OpenRouter API — Primario: `google/gemini-2.5-flash`** + Respaldos Gemini `google/gemini-3.5-flash-lite` y `google/gemini-4-hydrogen` + fallback heurístico local offline | Preclasificación multimodal (imagen + relato ciudadano + sector CRA) hacia categorías técnicas académicas y severidad preliminar para asistir a mentores. |
| **Generación de visuales del producto** | Generador de imágenes multimodal (`image-generator`) + diseño vectorial SVG | Fotografía editorial de portada, ilustración del Modo Escuelas y fotografía de sendero turístico QR. |
| **Desarrollo e ingeniería** | Asistente de programación agéntico (Antigravity / Gemini) | Análisis del KMZ y capas UTM 18N de la CRA, diseño de arquitectura PostGIS/PWA, generación de componentes y verificación. |

### Benchmark Multimodal OpenRouter (Evidencia de Selección de Modelo)

Se evaluaron 7 modelos multimodales vigentes en OpenRouter sobre 2 casos reales del Atlántico (verificación positiva en zona `828 ha por revisar` y alerta de obstrucción hídrica en `Tubará – Juan de Acosta`, límite `350` tokens de salida):

| Modelo evaluado | JSON válido | Precisión (tipo + severidad) | Latencia promedio | Tokens prom. (in / out) | Costo est. / 1,000 reportes |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`google/gemini-2.5-flash` (Ganador primario)** | **2/2** | **4/4** | **2,202 ms** | 515 / 138 | **\$0.499 USD** |
| **`google/gemini-3.5-flash-lite` (Respaldo veloz)** | 2/2 | 3/4 | **1,753 ms** | 1,316 / 154 | \$0.778 USD |
| **`qwen/qwen3.8-omni-flash` (Respaldo económico)** | 2/2 | 3/4 | 3,208 ms | 471 / 318 | **\$0.220 USD** |
| `openai/gpt-5.6-luna` | 2/2 | 3/4 | 3,119 ms | 453 / 247 | \$0.386 USD |
| `anthropic/claude-haiku-5.5` | 0/2* | 0/4 | 2,681 ms | 654 / 350 | \$0.240 USD |
| `qwen/qwen3.7-flash` | 0/2* | 0/4 | 3,199 ms | 441 / 351 | \$0.059 USD |
| `google/gemini-3.8-flash` | 0/2* | 0/4 | 3,254 ms | 1,316 / 346 | \$2.513 USD |

*\*Los modelos con pensamiento interno (`reasoning tokens`) agotaron el tope de 350 tokens en la primera corrida. Al ampliar a **`1,200` tokens** sobre la familia Gemini, **`google/gemini-4-hydrogen`** (`3,382 ms`, `2/2` JSON, `3/4`) y **`google/gemini-3.8-flash`** (`3,461 ms`, `2/2` JSON, `3/4`) completaron el JSON con detección visual de inconsistencias foto-texto, mientras **`google/gemini-3.5-flash-lite`** (`1,982 ms`) fue el más veloz y **`google/gemini-2.5-flash`** (`2,846 ms`, **`4/4`**) mantuvo el mejor balance costo/precisión. Se configuró `max_tokens: 1200` en producción con cadena 100% Gemini (`gemini-2.5-flash` → `gemini-3.5-flash-lite` → `gemini-4-hydrogen`).*

## 4. Diccionario de Datos Abiertos (Gobierno Digital — Ley 1581 de 2012)

Endpoint público: `GET /api/open-data?format=csv` y `GET /api/open-data?format=geojson`.
Todos los registros se exportan anonimizados (sin nombres propios, correos ni teléfonos personales):
- `tracking_code`, `timestamp_captura` (ISO-8601), `latitud`, `longitud`, `precision_gps_m`, `is_simulated_gps`, `zona_manglar`, `municipio`, `sector_id`, `accion_plan`, `en_zona_por_revisar`, `tipo_evento`, `descripcion_ciudadana`, `perfil_reportante`, `estado_sincronizacion`, `estado_validacion`, `attention_status`, `clasificacion_tecnica`, `nivel_prioridad`, `puntaje_confiabilidad`, `evidencia_foto_url`.
