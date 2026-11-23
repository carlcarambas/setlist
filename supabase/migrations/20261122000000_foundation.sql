-- Milestone 0: foundation.
-- Extensions and helpers shared by later migrations, plus the single-row app_settings table.
-- RLS policies for app_settings arrive in Milestone 1 together with profiles and the
-- is_active_member() / is_admin() helpers. Until then RLS is enabled with no policies,
-- which denies all access through the API.

create extension if not exists pg_trgm with schema extensions;

-- Stamps updated_at on every UPDATE. Attached to each table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.app_settings (
  id          boolean primary key default true check (id),   -- enforces a single row
  church_name text not null default 'Music Ministry'
              check (length(trim(church_name)) between 1 and 120),
  timezone    text not null default 'Asia/Manila',
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is
  'Single-row application settings, editable by administrators (spec §19 P3).';

alter table public.app_settings enable row level security;

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (id) values (true);
