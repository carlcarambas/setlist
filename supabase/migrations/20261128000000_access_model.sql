-- Milestone 6: access model for spec v2.0 (§2, §3, §4.1, §10).
--
--   * Members are anonymous devices (Supabase anonymous sign-ins); they're active as soon as they exist.
--   * Administrators are invited, sign in with email and password, and alone change the music library.
--   * Every active session can view and edit every plan; only administrators permanently delete
--     plans or events.
--   * Sharing (plan_shares, plan_links, public links) is removed.
--
-- Most policies call is_active_member(), can_view_plan() and can_edit_plan(); redefining those moves
-- the existing rules to the new model.

-- ---------------------------------------------------------------------------
-- Sharing removed (spec v2 §8.1). Dropping the functions first, then the tables.
-- ---------------------------------------------------------------------------
drop function if exists public.share_plan(uuid, uuid, public.share_permission);
drop function if exists public.revoke_plan_share(uuid);
drop function if exists public.create_plan_link(uuid, text, timestamptz);
drop function if exists public.revoke_plan_link(uuid);
drop function if exists public.get_shared_plan(text);
drop function if exists public.shared_plan_sheet(text, uuid);
drop function if exists public.valid_link_plan(text);
drop table if exists public.plan_links;
drop table if exists public.plan_shares;
drop type if exists public.share_permission;

alter table public.plan_activities drop constraint plan_activities_action_check;
alter table public.plan_activities add constraint plan_activities_action_check check (action in (
  'plan_created', 'plan_updated', 'plan_status_changed', 'plan_duplicated',
  'item_added', 'item_removed', 'items_reordered', 'item_notes_updated'));

-- ---------------------------------------------------------------------------
-- Profiles: anonymous devices, optional display names, emails hidden from members.
-- ---------------------------------------------------------------------------
alter table public.profiles add column is_anonymous boolean not null default false;
alter table public.profiles alter column display_name drop not null;
alter table public.profiles drop constraint profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (display_name is null or length(trim(display_name)) between 1 and 100);

-- Anonymous users (member devices) are active immediately. Everyone else starts as an invited member:
-- only an administrator's invitation (server, secret key) makes someone an administrator, so a
-- stranger who self-registers by email gains nothing beyond what an anonymous device already has.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, is_anonymous, status)
  values (
    new.id,
    coalesce(new.email, ''),
    case when new.is_anonymous then null
         else coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                       nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                       'Administrator')
    end,
    coalesce(new.is_anonymous, false),
    case when new.is_anonymous then 'active'::public.member_status else 'invited'::public.member_status end
  );
  return new;
end;
$$;

-- Administrators only: anonymous sessions are never administrators.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and status = 'active' and role = 'admin' and not is_anonymous
  );
$$;

-- Members see names and roles, never emails (the app is reachable by anyone, spec v2 §10).
revoke select on public.profiles from authenticated;
grant select (id, display_name, role, status, is_anonymous, created_at, updated_at)
  on public.profiles to authenticated;

-- Administrators' email addresses, for the Administrators page.
create or replace function public.list_administrators()
returns table (id uuid, display_name text, email text, status public.member_status, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.email, p.status, p.created_at
    from public.profiles p
   where public.is_admin() and p.role = 'admin' and not p.is_anonymous
   order by p.status, p.display_name;
$$;
revoke execute on function public.list_administrators() from public, anon;
grant execute on function public.list_administrators() to authenticated;

-- Deactivate/reactivate an administrator, or block/unblock a member device. Nobody changes their own
-- status, so at least one active administrator always remains.
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

-- ---------------------------------------------------------------------------
-- Music library: everyone reads; only administrators write (spec v2 §4.2).
-- ---------------------------------------------------------------------------
drop policy "music_pieces: add as active member" on public.music_pieces;
drop policy "music_pieces: edit as active member" on public.music_pieces;
create policy "music_pieces: add as admin" on public.music_pieces for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy "music_pieces: edit as admin" on public.music_pieces for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy "arrangements: add as active member" on public.arrangements;
drop policy "arrangements: edit as active member" on public.arrangements;
create policy "arrangements: add as admin" on public.arrangements for insert to authenticated
  with check (
    (select public.is_admin())
    and uploaded_by = (select auth.uid())
    and exists (select 1 from public.music_pieces p where p.id = music_piece_id and p.status = 'active')
  );
create policy "arrangements: edit as admin" on public.arrangements for update to authenticated
  using ((select public.is_admin()) and status <> 'pending')
  with check ((select public.is_admin()));

create or replace function public.can_upload_sheet(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.arrangements a
     where (a.status = 'pending' and a.uploaded_by = (select auth.uid()) and a.storage_path = p_name)
        or (a.status <> 'pending'
            and p_name like a.music_piece_id::text || '/' || a.id::text || '/%'
            and p_name <> a.storage_path)
  );
$$;

-- ---------------------------------------------------------------------------
-- Plans: every active session views and edits every plan (spec v2 §3.2, D1).
-- ---------------------------------------------------------------------------
create or replace function public.can_view_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (select 1 from public.plans where id = p_plan_id);
$$;

create or replace function public.can_edit_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_plan(p_plan_id);
$$;

drop policy "plans: read if allowed" on public.plans;
create policy "plans: members read" on public.plans for select to authenticated
  using ((select public.is_active_member()));

-- Anyone may archive or restore (D4); the creator column still never changes.
create or replace function public.plans_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_cannot_change' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Permanent delete: administrators only. Items, activity and event links cascade.
create or replace function public.delete_plan(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = 'PT403';
  end if;
  delete from public.plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;
end;
$$;
revoke execute on function public.delete_plan(uuid) from public, anon;
grant execute on function public.delete_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Events: anyone edits; only administrators delete (spec v2 §4.4).
-- ---------------------------------------------------------------------------
drop policy "events: creator or admin edits" on public.events;
drop policy "events: creator or admin deletes" on public.events;
create policy "events: members edit" on public.events for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "events: admins delete" on public.events for delete to authenticated
  using ((select public.is_admin()));
