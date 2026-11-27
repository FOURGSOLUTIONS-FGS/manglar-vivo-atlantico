# Ficha Técnica — Manglar Vivo Atlántico (Hackathon CRA / Vit Arena)

## 1. Resumen de la solución y las 3 preguntas de gobernanza

1. **¿Dónde ocurre una amenaza o cambio en el manglar ahora mismo, qué pasa y con qué prioridad coincide?**
   - Captura ciudadana en 3 pasos (`/reportar`) organizada en **4 dominios ambientales × 12 factores específicos** (`Cobertura y Suelo`, `Agua y Salud del Dosel`, `Contaminación y Residuos`, `Fauna y Verificación Viva`), dictado por voz nativo (`es-CO`) y `timestamp_captura` ISO-8601.
   - GPS real (`getCurrentPosition`, sin simular silenciosamente; el modo presentación en salón marca explícitamente `SIMULADO (DEMO)` en UI, base de datos, correos y exportaciones) + cruce espacial instantáneo —incluso en modo avión— contra los **9,408 polígonos costeros** de `Prioridades de Conservación (1).kmz`, las **775 ha de manglar probable**, las **828 ha por revisar** y las **262 ha de dosel seco 2026**.
2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - Fotografía original preservando metadatos **EXIF**, **filtro visual IA anti-alucinación** (`/api/ai/classify`) que detecta y rechaza fotos irrelevantes (interiores, oficinas, rostros/selfies) penalizando `0/25` pts y bloqueando alertas rojas automáticas, **Semáforo de Confiabilidad de 5 segmentos (0–100 pts)** auditable, contraste en **PostGIS** con los **524 puntos *ground-truth*** de la CRA (`resolve_location_context`), corroboración ciudadana en 500 m y **doble validación** (`/validar`: Mentor Comunitario + Mentor Académico → Alerta Oficial CRA).
   - **Motor SOLID de clasificación y despacho de alertas (`/admin`):** 4 niveles claros (`Urgente < 2 h`, `Alta < 24 h`, `Revisión < 48 h`, `Verificación 828 ha`), sonidos Web Audio por nivel, notificaciones del navegador vía Supabase Realtime y envío real de correo HTML institucional vía **Hostinger SMTP (`smtp.hostinger.com:465`)** con bitácora auditable en `alert_dispatches`.
3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Modo Escuelas (`/escuelas`):** adopción escolar de las `828 ha por revisar`, tablero PRAES y **cierre de ciclo visual** en 4 estaciones por código `MGL-2026-XXXX`.
   - **Modo Turistas QR (`/turista`):** acceso sin registro desde estaciones costeras con ficha educativa de 30 s y código QR real escaneable.
   - **Actores y Formulación (`/participacion`):** evolución funcional de `manglarcra.netlify.app/maqueta` con registro obligatorio de actores (Ley 1581), 4 listas de chequeo de 6 ítems (Res. 1263 de 2018), flujo de 6 estados y generador automático de borradores **MGA (DNP)** y **Nota Conceptual (`t CO₂e = ha × tC/ha × 3.667`)**.

## 2. Arquitectura y Stack Tecnológico (SOLID + Offline-First)

- **Frontend & PWA:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, **GSAP + ScrollTrigger + Lenis** (con `prefers-reduced-motion`), tipografía **`Archivo` + `Lato`** (oficial CRA), rásters Sentinel-2 reales de los 4 sectores (`/media/sat/z1_img.jpg`–`z4_img.jpg`) y video aéreo oficial CRA (`portada_960.mp4`).
- **Offline-First en Campo:** Service Worker (`/sw.js`, versión `manglar-vivo-v6`) + **IndexedDB** (`idb`, store `pending_reports` guardando fotografía original `Blob` con EXIF intacto) con sincronización automática al recuperar señal.
- **Arquitectura SOLID de Alertas (`src/core/alerts/`):**
  - `classifier.ts` (SRP): reglas puras determinísticas de clasificación + bloqueo anti-falsos positivos.
  - `routing.ts` (SRP): matriz oficial de autoridades receptoras CRA / Policía Ambiental / Mentores / Red PRAES.
  - `email-template.ts` (SRP): plantilla HTML institucional con foto, GPS, semáforo y enlace directo `/admin?code=...`.
  - `channels/` (OCP + LSP): adaptadores intercambiables `SmtpNotificationChannel` (Hostinger SMTP), `ResendNotificationChannel` y `WebhookNotificationChannel`.
  - `dispatcher.ts` (DIP): orquestador con inyección de canales y repositorio de auditoría (`alert_dispatches`), cubierto por pruebas unitarias (`npm test` → 5/5 en verde).
- **Geoespacial y Base de Datos:** Pipeline Python (`convert_cra_geodata.py`, KMZ + UTM 18N `EPSG:32618` → WGS84 `EPSG:4326`), Turf.js offline + Leaflet satelital + **PostgreSQL 17 / PostGIS**, Realtime y Storage en Supabase (`nhyicthczgjfzreneiuc`).
- **Seguridad y Gobernanza:** Rate limiting por IP en `/api/ai/classify` y `/api/alerts`, PIN institucional en `/admin` (con acceso demo para jurado), RLS en Supabase y anonimización estricta en datos abiertos.

## 3. Transparencia de Inteligencia Artificial (Uso Documentado)

| Etapa | Herramienta / Modelo de IA | Propósito |
| :--- | :--- | :--- |
| **En tiempo de ejecución (`/api/ai/classify`)** | **OpenRouter API — Primario: `google/gemini-2.5-flash`** + Respaldos Gemini (`google/gemini-3.5-flash-lite`, `google/gemini-4-hydrogen`) + fallback heurístico local offline | Auditoría visual anti-falsos positivos (`es_evidencia_valida`), detección de rostros Ley 1581, clasificación en 12 subtipos ambientales y asistencia a mentores. |
| **Visuales editoriales** | Generador multimodal (`image-generator`) + media oficial CRA (`portada_960.mp4`, rásters Sentinel-2) | Portada costera, escena escolar PRAES y estación turística QR. |
| **Ingeniería y verificación** | Asistente agéntico (Antigravity / Gemini) | Conversión KMZ/UTM 18N, arquitectura PostGIS/PWA/SOLID, pruebas unitarias y benchmark multimodal. |

### Benchmark Multimodal y Filtro Anti-Falsos Positivos (Evidencia Real)

- **Selección de modelo (OpenRouter, 7 modelos evaluados):** **`google/gemini-2.5-flash`** obtuvo el mejor equilibrio costo/precisión (`4/4` en severidad y tipo, `2,202 ms` promedio, **\$0.499 USD / 1,000 reportes**), respaldado por `google/gemini-3.5-flash-lite` y `google/gemini-4-hydrogen` con `max_tokens: 1200`.
- **Evaluación sobre 14 fotografías reales (`scripts/test_vision_dataset.mjs`, usuario deliberadamente sesgado a `tala_poda`):**
  - **Filtro anti-falsos positivos (fotos reales ambientales vs. oficinas/retratos en interiores):** **14/14 (100 %)**.
  - **Exactitud en 12 subtipos específicos:** **92 % – 100 %** tras ajuste de erosión costera (`docs/vision_dataset_benchmark.json`).

## 4. Diccionario de Datos Abiertos (Gobierno Digital — Ley 1581 de 2012)

Endpoint público: `GET /api/open-data?format=csv` y `GET /api/open-data?format=geojson`.
Todos los registros se exportan anonimizados (sin nombres propios, correos ni teléfonos personales):
- `tracking_code`, `timestamp_captura` (ISO-8601), `latitud`, `longitud`, `precision_gps_m`, `is_simulated_gps`, `zona_manglar`, `municipio`, `sector_id`, `accion_plan`, `en_zona_por_revisar`, `factor_dominio`, `subtipo_evento`, `tipo_evento`, `nivel_alerta`, `foto_validada_ia`, `descripcion_ciudadana`, `perfil_reportante`, `estado_sincronizacion`, `estado_validacion`, `attention_status`, `clasificacion_tecnica`, `nivel_prioridad`, `puntaje_confiabilidad`, `evidencia_foto_url`.
