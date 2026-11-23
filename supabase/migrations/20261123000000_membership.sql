-- Milestone 1: membership.
-- profiles (one per auth user), permission helpers, RLS for profiles and app_settings.
-- See docs/implementation-plan.md §4.1–§4.3 and spec §3, §10.

-- ---------------------------------------------------------------------------
-- Privileges: make local behave like cloud.
-- New Supabase cloud projects don't grant table privileges to anon/authenticated
-- by default; the local stack does. Remove the defaults so every migration has to
-- grant explicitly, and both environments match.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on public.app_settings from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('member', 'admin');
create type public.member_status as enum ('invited', 'active', 'inactive');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  email        text not null,
  role         public.member_role   not null default 'member',
  status       public.member_status not null default 'invited',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Created by trigger; never hard-deleted (spec §3.3).';

create index profiles_status_name on public.profiles (status, display_name);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Create a profile whenever an auth user is created (invitation or seed).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep profiles.email in step with the auth email.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_change();

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_user_email_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permission helpers (SECURITY DEFINER so policies can call them without
-- recursing into profiles' own RLS). Each is a single indexed lookup.
-- ---------------------------------------------------------------------------
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and status = 'active' and role = 'admin'
  );
$$;

-- Invited user finishes joining: set their display name and become active.
-- Users can't change their own status any other way (column grants below).
create or replace function public.complete_invitation(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(p_display_name);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) not between 1 and 100 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  update public.profiles
     set display_name = v_name, status = 'active'
   where id = (select auth.uid()) and status = 'invited';

  if not found then
    raise exception 'invitation_not_pending' using errcode = '42501';
  end if;
end;
$$;

-- Administrator activates/deactivates a member. Admins can't change their own
-- status (prevents locking the ministry out of administration by accident).
create or replace function public.set_member_status(p_user_id uuid, p_status public.member_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_change_own_status' using errcode = '42501';
  end if;
  if p_status = 'invited' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.is_active_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.complete_invitation(text) from public, anon;
revoke execute on function public.set_member_status(uuid, public.member_status) from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.complete_invitation(text) to authenticated;
grant execute on function public.set_member_status(uuid, public.member_status) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: grants and policies
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;   -- not role/status/email
grant all on public.profiles to service_role;

-- Active members see the member directory; anyone signed in sees their own row
-- (an invited user needs it to finish joining).
create policy "profiles: read own or as active member"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_active_member()));

create policy "profiles: update own display name"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and (select public.is_active_member()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- app_settings: grants and policies
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column updated_by uuid references public.profiles (id);

grant select on public.app_settings to authenticated;
grant update (church_name, timezone) on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

create policy "app_settings: read as active member"
  on public.app_settings for select
  to authenticated
  using ((select public.is_active_member()));

create policy "app_settings: update as admin"
  on public.app_settings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Record who last changed settings; ignores any client-supplied value.
create or replace function public.stamp_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke execute on function public.stamp_updated_by() from public, anon, authenticated;

create trigger app_settings_stamp_updated_by
  before update on public.app_settings
  for each row execute function public.stamp_updated_by();
