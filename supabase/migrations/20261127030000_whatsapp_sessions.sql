-- Estado persistente de conversaciones guiadas de WhatsApp/Zernio (anti-dummies, sin pérdida entre lambdas serverless)
-- Cumple Ley 1581: solo almacena sender_hash SHA-256 anónimo, nunca teléfonos ni nombres reales.

create table if not exists public.whatsapp_sessions (
  sender_hash text primary key,
  platform text not null default 'whatsapp',
  step text not null default 'idle',
  lat double precision,
  lon double precision,
  sector_id integer,
  sector_name text,
  is_simulated_gps boolean not null default true,
  photo_url text,
  photo_hash text,
  ai_photo_valid boolean,
  ai_classification jsonb,
  notes text,
  voice_transcript text,
  last_report_id uuid,
  last_tracking_code text,
  last_report_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_sessions enable row level security;

-- Solo service_role (backend Next.js) accede a sesiones activas; sin exposición pública
drop policy if exists "service_role_full_whatsapp_sessions" on public.whatsapp_sessions;
create policy "service_role_full_whatsapp_sessions"
  on public.whatsapp_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
