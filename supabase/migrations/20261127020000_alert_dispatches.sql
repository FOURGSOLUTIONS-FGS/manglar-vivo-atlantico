-- Tabla de auditoría de despachos de alertas (correos Hostinger/Resend, webhooks, notificaciones)
create table if not exists public.alert_dispatches (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.citizen_reports(id) on delete cascade,
  tracking_code text not null,
  alert_level text not null check (alert_level in ('urgente', 'alta', 'media', 'verificacion')),
  channel text not null,
  recipient_group text not null,
  recipient_email text,
  subject text not null,
  status text not null check (status in ('enviado', 'preview_sandbox', 'omitido', 'error')),
  provider_message_id text,
  preview_url text,
  error_detail text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_alert_dispatches_created on public.alert_dispatches(created_at desc);
create index if not exists idx_alert_dispatches_report on public.alert_dispatches(report_id);
create index if not exists idx_alert_dispatches_level on public.alert_dispatches(alert_level);

alter table public.alert_dispatches enable row level security;

drop policy if exists "alert_dispatches_read_public" on public.alert_dispatches;
create policy "alert_dispatches_read_public"
  on public.alert_dispatches for select
  using (true);

-- Realtime para que /admin y /cra muestren despachos en vivo
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'alert_dispatches'
  ) then
    alter publication supabase_realtime add table public.alert_dispatches;
  end if;
end $$;
