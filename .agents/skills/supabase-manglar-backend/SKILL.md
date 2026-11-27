---
name: supabase-manglar-backend
description: >-
  Use when creating database migrations, PostGIS spatial functions, Storage
  buckets, RLS policies, Realtime subscriptions, or open-data export endpoints
  in the linked Supabase project (nhyicthczgjfzreneiuc).
---

# Backend Supabase + PostGIS — Plataforma Manglares Atlántico

Convenciones de datos, seguridad, tiempo real y datos abiertos sobre el proyecto Supabase **`nhyicthczgjfzreneiuc`** (organización `manglar`, región `us-east-1`, Postgres 17).

## 1. Extensiones y modelo de datos

Habilitar en la primera migración:
```sql
create extension if not exists postgis;
create extension if not exists pgcrypto;
```

### Tablas núcleo
1. **`citizen_reports`** (Reporte ciudadano — Esquema A del handoff):
   - `id uuid primary key default gen_random_uuid()`
   - `client_uuid uuid unique not null` (idempotencia para sincronización offline)
   - `tracking_code text unique not null` (código corto legible ej. `MGL-2026-0042` para cierre de ciclo)
   - `timestamp_captura timestamptz not null`
   - `latitud double precision not null`, `longitud double precision not null`
   - `geom geography(Point, 4326) generated always as (st_setsrid(st_makepoint(longitud, latitud), 4326)::geography) stored`
   - `precision_gps_m double precision`, `is_simulated_gps boolean default false`
   - `zona_manglar text not null`, `municipio text`, `sector_id integer`
   - `tipo_evento text not null`, `descripcion_ciudadana text`
   - `evidencia_foto_url text`, `evidencia_exif jsonb`
   - `perfil_reportante text not null` (`habitante_local`, `estudiante_escuela`, `turista`, `actor_registrado`)
   - `school_name text`, `qr_station_id text`
   - `estado_sincronizacion text not null default 'sincronizado'`
   - `estado_validacion text not null default 'nuevo'` (`nuevo`, `validado_comunitario`, `validado_academico`, `alerta_oficial_cra`, `descartado`)
   - `attention_status text not null default 'pendiente'` (`pendiente`, `en_revision`, `operativo_en_curso`, `atendido`)
   - `clasificacion_tecnica text`, `nivel_prioridad text` (`alta`, `media`, `baja`), `puntaje_confiabilidad integer`
   - `ai_classification jsonb`, `ground_truth_match jsonb`, `created_at timestamptz default now()`

2. **`report_validations`**: bitácora de auditoría de doble validación (`report_id`, `validator_role`, `validator_name`, `decision`, `technical_label`, `notes`, `created_at`).
3. **`registered_actors`** (Esquema B del handoff): registro obligatorio de actores (`nombre_entidad_o_persona`, `tipo_actor`, `tipo_accion`, `municipio_ubicacion`, `geom`, `periodo_inicio`, `periodo_fin`, `contacto_privado`).
4. **`citizen_proposals`** (Esquema C del handoff): propuestas ciudadanas (`titulo_proyecto`, `ubicacion_objetivo`, `latitud`, `longitud`, `proponente`, `resumen_objetivo`, `sector_heredado`, `accion_plan_heredada`, `prioridad_heredada`, `checklist_cumplimiento jsonb`, `estado`).
5. **`conservation_priorities`** y **`cra_ground_truth_points`**: capas espaciales oficiales con índices `GIST (geom)` para cruce exacto vía RPC `resolve_location_context(p_lat double precision, p_lon double precision)`.

## 2. Storage y Realtime

- **Bucket `report-evidence`:** Guardar las fotografías originales bajo `reports/<client_uuid>/<filename>`.
- **Realtime:** Habilitar `supabase_realtime` sobre `citizen_reports` y `report_validations` para que el **Dashboard CRA** muestre alertas recién sincronizadas al instante sin recargar la página.

## 3. Políticas RLS y privacidad (Ley 1581 de 2012)

- Permitir `INSERT` anónimo/público en `citizen_reports` y `citizen_proposals` (requisito de cero fricción para turistas QR y escuelas).
- Permitir `SELECT` público únicamente sobre vistas/columnas no sensibles (excluir correos o teléfonos personales de `registered_actors` y reporteros).
- Para el flujo de validación en el prototipo de hackathon: proteger las acciones de mentor/CRA con un rol o clave de sesión simple (o Edge Function/Route Handler en Next.js con `SUPABASE_SERVICE_ROLE_KEY` validando token de demo/mentor), evitando dejar mutaciones destructivas abiertas sin control.

## 4. Exportación de Datos Abiertos (Gobierno Digital)

Exponer endpoint `/api/open-data`:
- Parámetros: `?format=csv|geojson&sector=...&prioridad=...&estado=...`
- Columnas estándar sin PII: `tracking_code`, `timestamp_captura`, `latitud`, `longitud`, `precision_gps_m`, `is_simulated_gps`, `zona_manglar`, `municipio`, `tipo_evento`, `perfil_reportante`, `estado_validacion`, `attention_status`, `clasificacion_tecnica`, `nivel_prioridad`, `puntaje_confiabilidad`, `evidencia_foto_url`.
- En `format=geojson`, devolver `FeatureCollection` estándar RFC 7946 con `Content-Disposition: attachment`.
