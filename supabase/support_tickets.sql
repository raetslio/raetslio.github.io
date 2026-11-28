-- Tabelle für Support-Nachrichten (im Supabase SQL-Editor einmal ausführen).
-- Row Level Security ist an und es gibt absichtlich KEINE Richtlinien: Nur die Edge Functions (Service-Key) kommen an die Daten.
create table if not exists public.support_tickets (
  id          text primary key,                 -- zufällige Answer-ID, z. B. ID-k3j9x0a7q2mz
  user_id     uuid,
  email       text not null,
  name        text,
  topic       text,
  message     text not null,
  created_at  timestamptz not null default now(),
  replies     jsonb not null default '[]'::jsonb
);
alter table public.support_tickets enable row level security;

-- Rechte: nur die Edge Functions (service_role) dürfen an die Tabelle, Nutzer und Besucher nie.
revoke all on table public.support_tickets from anon, authenticated;
grant usage on schema public to service_role;
grant all on table public.support_tickets to service_role;
