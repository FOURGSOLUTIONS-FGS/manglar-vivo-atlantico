# Manglares del Atlántico — Reglas del Proyecto (Hackathon CRA)

## 1. Identidad institucional y diseño (CRA Atlántico)

Toda interfaz ciudadana y del panel institucional debe respetar la identidad oficial extraída de `https://manglarcra.netlify.app/`:

- **Colores oficiales:**
  - Azul institucional CRA: `--cra-blue: #005F96` (oscuro de profundidad: `#0b3a58`)
  - Dorado / alerta suave: `--cra-gold: #EDB512` y `--cra-gold-soft: #F8D86F`
  - Colores del Plan de Manejo:
    - `Preservación`: `#1f78b4`
    - `Restauración`: `#33a02c`
    - `Recuperación`: `#ff7f00`
    - `Rehabilitación`: `#cab2d6`
- **Tipografía:** `Lato` (pesos `400`, `700`, `900`), con fallback `"Century Gothic", "Helvetica Neue", Arial, sans-serif`.
- **Usabilidad en campo:** Mobile-first, alto contraste (WCAG AA mínimo, legible bajo luz solar directa), botones grandes (>= 44px), soporte `prefers-reduced-motion` y lenguaje claro para jóvenes, estudiantes, turistas y comunidad local.

## 2. Las 3 preguntas mínimas de gobernanza (Demo máx. 7 min en Vit Arena)

Toda decisión de arquitectura, UI y datos debe responder explícitamente a estas 3 preguntas:

1. **¿Dónde ocurre una amenaza o cambio en el manglar ahora mismo, qué pasa y con qué prioridad de conservación coincide?**
   - Timestamp exacto (`ISO-8601`) + GPS real + cruce inmediato con polígonos de prioridad (`Prioridades de Conservación (1).kmz`), zonas de manglar probable y las **828 ha por revisar** de la CRA.
2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - Evidencia fotográfica geolocalizada + **Semáforo de Confiabilidad** (0–100 pts) + flujo de doble validación (mentor comunitario + mentor académico) + asistencia de IA + contraste con los **524 puntos *ground-truth*** de la CRA.
3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Modo Escuelas** (retos por institución, bitácora y tablero de aportes) + **Modo Turistas QR** (reporte en < 1 minuto sin registro pesado + ficha educativa) + **cierre de ciclo** (estado público del reporte cuando la CRA lo valida y atiende).

## 3. Reglas técnicas no negociables

1. **Offline-first real:** La captura de reporte (3 pasos), toma de foto, captura de GPS y cruce espacial contra capas cacheadas deben funcionar completamente **en modo avión** usando IndexedDB + Service Worker (patrón heredado de `FOURGSOLUTIONS-FGS/gestiones-electricas-actas`).
2. **GPS honesto:** Nunca inventar ni simular coordenadas silenciosamente cuando falla el GPS. Si se incluye un selector de "Modo Demo / Simular punto del Atlántico" para demostraciones en salón ante el jurado, debe mostrarse un distintivo visible `SIMULADO (DEMO)` en UI, en la base de datos y en la exportación.
3. **Evidencia probatoria (EXIF):** Conservar la fotografía original (con metadatos EXIF intactos) para la subida al servidor; generar copia comprimida únicamente para previsualizaciones rápidas en el dispositivo.
4. **Privacidad y Gobierno Digital (Ley 1581 de 2012):** Las exportaciones en formato abierto (**CSV** y **GeoJSON**) deben anonimizar cualquier dato personal sensible de ciudadanos, estudiantes o turistas.
5. **Transparencia de IA:** Todo modelo o herramienta de IA utilizada (tanto en tiempo de ejecución como en desarrollo) debe quedar documentada explícitamente para la Ficha Técnica de Vit Arena.

## 4. Entorno conectado

- **GitHub CLI (`gh`):** Autenticado en cuenta activa `FOURGSOLUTIONS-FGS` (protocolo `https`). Repo base de referencia reutilizable: `FOURGSOLUTIONS-FGS/gestiones-electricas-actas`.
- **Supabase CLI (`supabase`):** Autenticado en organización `manglar` (`mqpbpvbivgvfuhjqbufl`), proyecto `nhyicthczgjfzreneiuc` (`us-east-1`, PostgreSQL `17.12.0.002`).

## 5. Skills del workspace (`.agents/skills/`)

- [cra-manglar-domain](./.agents/skills/cra-manglar-domain/SKILL.md): Reglas de negocio, sectores, métricas oficiales CRA y requisitos de Vit Arena.
- [geospatial-kmz-postgis](./.agents/skills/geospatial-kmz-postgis/SKILL.md): Conversión KMZ y capas UTM 18N → WGS84 GeoJSON + consultas espaciales PostGIS.
- [offline-field-pwa](./.agents/skills/offline-field-pwa/SKILL.md): Patrones de Service Worker, IndexedDB, GPS honesto y captura de evidencia en campo.
- [supabase-manglar-backend](./.agents/skills/supabase-manglar-backend/SKILL.md): Esquema Postgres/PostGIS, RLS, Storage, Realtime y exportación abierta.
