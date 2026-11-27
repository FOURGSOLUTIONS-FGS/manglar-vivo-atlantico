-- Manglar Vivo Atlántico — Migración Inicial PostGIS + Storage + Realtime
-- Proyecto Supabase: nhyicthczgjfzreneiuc

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- 1. Sectores oficiales CRA (4 zonas)
create table if not exists public.cra_sectors (
  sector_id integer primary key,
  nombre text not null,
  centroid_lat double precision not null,
  centroid_lon double precision not null,
  referencia_ha double precision not null default 0,
  segura_ha double precision not null default 0,
  por_revisar_ha double precision not null default 0,
  dosel_seco_ha double precision not null default 0,
  anomalia_dosel double precision not null default 0,
  riesgo_medio double precision not null default 0,
  vulnerabilidad_media double precision not null default 0,
  carbono_tc double precision not null default 0,
  carbono_tc_ha double precision not null default 260,
  geom geography(Polygon, 4326)
);
create index if not exists idx_cra_sectors_geom on public.cra_sectors using gist (geom);

-- 2. Puntos ground-truth oficiales CRA (524 puntos de hl.json)
create table if not exists public.cra_ground_truth_points (
  point_id integer primary key,
  clase_interpretada text not null,
  es_manglar_consenso boolean not null default false,
  lat double precision not null,
  lon double precision not null,
  geom geography(Point, 4326) generated always as (st_setsrid(st_makepoint(lon, lat), 4326)::geography) stored
);
create index if not exists idx_cra_gt_geom on public.cra_ground_truth_points using gist (geom);

-- 3. Reportes ciudadanos (Esquema A del handoff + campos PWA/IA/Gobernanza)
create table if not exists public.citizen_reports (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid unique not null,
  tracking_code text unique not null,
  timestamp_captura timestamptz not null default now(),
  latitud double precision not null,
  longitud double precision not null,
  geom geography(Point, 4326) generated always as (st_setsrid(st_makepoint(longitud, latitud), 4326)::geography) stored,
  precision_gps_m double precision,
  is_simulated_gps boolean not null default false,
  zona_manglar text not null,
  municipio text,
  sector_id integer,
  accion_plan text,
  en_zona_por_revisar boolean not null default false,
  tipo_evento text not null,
  descripcion_ciudadana text,
  evidencia_foto_url text,
  evidencia_exif jsonb,
  perfil_reportante text not null default 'habitante_local',
  school_name text,
  qr_station_id text,
  estado_sincronizacion text not null default 'sincronizado',
  estado_validacion text not null default 'nuevo',
  attention_status text not null default 'pendiente',
  clasificacion_tecnica text,
  nivel_prioridad text not null default 'media',
  puntaje_confiabilidad integer not null default 0,
  ai_classification jsonb,
  ground_truth_match jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_citizen_reports_geom on public.citizen_reports using gist (geom);
create index if not exists idx_citizen_reports_created on public.citizen_reports (created_at desc);
create index if not exists idx_citizen_reports_estado on public.citizen_reports (estado_validacion, nivel_prioridad);

-- 4. Bitácora de doble validación (Mentor Comunitario / Académico / CRA / IA)
create table if not exists public.report_validations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.citizen_reports(id) on delete cascade,
  validator_role text not null,
  validator_name text not null,
  decision text not null,
  technical_label text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_report_validations_report on public.report_validations (report_id, created_at desc);

-- 5. Registro obligatorio de actores (Esquema B + Reglamentación CRA)
create table if not exists public.registered_actors (
  id uuid primary key default gen_random_uuid(),
  nombre_entidad_o_persona text not null,
  tipo_actor text not null,
  tipo_accion text not null,
  sector_id integer,
  municipio_ubicacion text not null,
  papel text[] not null default array['Monitorear y reportar'],
  periodo_inicio date,
  periodo_fin date,
  contacto_privado text,
  acepta_ley_1581 boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. Propuestas ciudadanas de proyectos (Esquema C + evolución /maqueta)
create table if not exists public.citizen_proposals (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.registered_actors(id) on delete set null,
  proponente text not null,
  titulo_proyecto text not null,
  tipo_accion text not null,
  hectareas numeric(8,2) not null default 1.0,
  sector_id integer not null default 1,
  ubicacion_objetivo text not null,
  latitud double precision,
  longitud double precision,
  accion_plan_heredada text,
  prioridad_heredada text,
  resumen_objetivo text,
  checklist_cumplimiento jsonb not null default '[0,0,0,0,0,0]'::jsonb,
  estado text not null default 'Propuesta',
  monitoreos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. RPC PostGIS: resuelve contexto espacial oficial y ground-truth cercano
create or replace function public.resolve_location_context(
  p_lat double precision,
  p_lon double precision
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_point geography;
  v_sector record;
  v_gt record;
  v_nearby_count integer;
begin
  v_point := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;

  select s.sector_id, s.nombre, s.referencia_ha, s.por_revisar_ha, s.dosel_seco_ha,
         s.riesgo_medio, s.carbono_tc_ha,
         round(st_distance(s.geom, v_point)::numeric, 1) as dist_m
  into v_sector
  from public.cra_sectors s
  order by st_distance(s.geom, v_point) asc
  limit 1;

  select g.point_id, g.clase_interpretada, g.es_manglar_consenso,
         g.lat, g.lon,
         round(st_distance(g.geom, v_point)::numeric, 1) as dist_m
  into v_gt
  from public.cra_ground_truth_points g
  order by g.geom <-> v_point
  limit 1;

  select count(*)
  into v_nearby_count
  from public.citizen_reports r
  where r.created_at >= now() - interval '7 days'
    and st_dwithin(r.geom, v_point, 500);

  return jsonb_build_object(
    'sector', case when v_sector is null then null else jsonb_build_object(
      'sector_id', v_sector.sector_id,
      'nombre', v_sector.nombre,
      'dist_m', v_sector.dist_m,
      'por_revisar_ha', v_sector.por_revisar_ha,
      'dosel_seco_ha', v_sector.dosel_seco_ha,
      'riesgo_medio', v_sector.riesgo_medio,
      'carbono_tc_ha', v_sector.carbono_tc_ha
    ) end,
    'nearest_ground_truth', case when v_gt is null then null else jsonb_build_object(
      'point_id', v_gt.point_id,
      'clase_interpretada', v_gt.clase_interpretada,
      'es_manglar_consenso', v_gt.es_manglar_consenso,
      'lat', v_gt.lat,
      'lon', v_gt.lon,
      'dist_m', v_gt.dist_m
    ) end,
    'nearby_reports_500m', coalesce(v_nearby_count, 0)
  );
end;
$$;

-- 8. Row Level Security (RLS) y vistas públicas sin PII
alter table public.cra_sectors enable row level security;
alter table public.cra_ground_truth_points enable row level security;
alter table public.citizen_reports enable row level security;
alter table public.report_validations enable row level security;
alter table public.registered_actors enable row level security;
alter table public.citizen_proposals enable row level security;

drop policy if exists "public_read_cra_sectors" on public.cra_sectors;
create policy "public_read_cra_sectors" on public.cra_sectors for select using (true);

drop policy if exists "public_read_cra_gt" on public.cra_ground_truth_points;
create policy "public_read_cra_gt" on public.cra_ground_truth_points for select using (true);

drop policy if exists "public_read_citizen_reports" on public.citizen_reports;
create policy "public_read_citizen_reports" on public.citizen_reports for select using (true);

drop policy if exists "public_insert_citizen_reports" on public.citizen_reports;
create policy "public_insert_citizen_reports" on public.citizen_reports for insert with check (true);

drop policy if exists "public_read_validations" on public.report_validations;
create policy "public_read_validations" on public.report_validations for select using (true);

drop policy if exists "public_read_proposals" on public.citizen_proposals;
create policy "public_read_proposals" on public.citizen_proposals for select using (true);

drop policy if exists "public_insert_proposals" on public.citizen_proposals;
create policy "public_insert_proposals" on public.citizen_proposals for insert with check (true);

-- Actores: lectura pública sin contacto privado vía vista; la tabla base solo permite insert público
drop policy if exists "public_insert_actors" on public.registered_actors;
create policy "public_insert_actors" on public.registered_actors for insert with check (true);

create or replace view public.public_actors as
select id, nombre_entidad_o_persona, tipo_actor, tipo_accion, sector_id, municipio_ubicacion, papel, periodo_inicio, periodo_fin, created_at
from public.registered_actors;

grant select on public.public_actors to anon, authenticated;

-- 9. Realtime para Dashboard CRA en vivo
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'citizen_reports'
  ) then
    alter publication supabase_realtime add table public.citizen_reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'report_validations'
  ) then
    alter publication supabase_realtime add table public.report_validations;
  end if;
end $$;

-- 10. Bucket Storage para evidencia fotográfica original (con EXIF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "public_read_report_evidence" on storage.objects;
create policy "public_read_report_evidence"
  on storage.objects for select
  using (bucket_id = 'report-evidence');

drop policy if exists "public_upload_report_evidence" on storage.objects;
create policy "public_upload_report_evidence"
  on storage.objects for insert
  with check (bucket_id = 'report-evidence');
