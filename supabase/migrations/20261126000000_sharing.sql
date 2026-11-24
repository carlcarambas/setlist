-- Milestone 4: sharing.
-- plan_shares (member access as viewer or editor) and plan_links (view-only public
-- links). See docs/implementation-plan.md §4.3, §4.6 and spec §3.2, §4.5, §10.1.
--
-- - Only the plan owner manages shares and links. Writes go through the SECURITY
--   DEFINER functions below, which check ownership explicitly and record activity;
--   signed-in users have no direct write privileges on either table.
-- - Public links are never resolved with a user session. The server hashes the token
--   and calls get_shared_plan()/shared_plan_sheet() with the secret key; those two
--   functions are executable by service_role only. anon gets nothing.
-- - Only sha256(token) is stored. The raw token is shown to the owner once.

create type public.share_permission as enum ('viewer', 'editor');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.plan_shares (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans (id) on delete cascade,
  user_id    uuid not null references public.profiles (id),
  permission public.share_permission not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, user_id)
);

comment on table public.plan_shares is 'Member access to a plan. Managed by the plan owner only.';
create index plan_shares_user on public.plan_shares (user_id);

create trigger plan_shares_set_updated_at
  before update on public.plan_shares
  for each row execute function public.set_updated_at();

create table public.plan_links (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- View-only for the MVP (spec §4.5). Editor links would need a separate review.
  permission public.share_permission not null default 'viewer' check (permission = 'viewer'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.plan_links is 'View-only public links. Stores only sha256(token).';
create index plan_links_plan on public.plan_links (plan_id, created_at desc);

alter table public.plan_activities drop constraint plan_activities_action_check;
alter table public.plan_activities add constraint plan_activities_action_check check (action in (
  'plan_created', 'plan_updated', 'plan_status_changed', 'plan_duplicated',
  'item_added', 'item_removed', 'items_reordered', 'item_notes_updated',
  'share_granted', 'share_changed', 'share_revoked', 'link_created', 'link_revoked'));

-- ---------------------------------------------------------------------------
-- Access helpers now include shares (spec §3.2). Shares keep working if the owner
-- is deactivated (implementation plan, ambiguity 6); the recipient must be active.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.plans p
     where p.id = p_plan_id
       and (p.owner_id = (select auth.uid())
            or exists (select 1 from public.plan_shares s
                        where s.plan_id = p.id and s.user_id = (select auth.uid())))
  );
$$;

create or replace function public.can_edit_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.plans p
     where p.id = p_plan_id
       and (p.owner_id = (select auth.uid())
            or exists (select 1 from public.plan_shares s
                        where s.plan_id = p.id and s.user_id = (select auth.uid())
                          and s.permission = 'editor'))
  );
$$;

-- Viewers can now read a plan they can't edit. SELECT … FOR UPDATE only returns rows
-- that pass the UPDATE policy, so check access before locking: a viewer gets
-- not_allowed (403) rather than plan_not_found (404).
create or replace function public.bump_plan_version(p_plan_id uuid, p_expected_version integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan record;
  v_new integer;
begin
  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;
  if not public.can_edit_plan(p_plan_id) then
    raise exception 'not_allowed' using errcode = 'PT403';
  end if;
  select id, version, status into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'not_allowed' using errcode = 'PT403';
  end if;
  if v_plan.status = 'archived' then
    raise exception 'plan_archived' using errcode = 'PT423';
  end if;
  if p_expected_version is not null and p_expected_version <> v_plan.version then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;

  update public.plans set version = version + 1 where id = p_plan_id returning version into v_new;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants and RLS: read-only for signed-in users; writes via the functions below.
-- ---------------------------------------------------------------------------
alter table public.plan_shares enable row level security;
alter table public.plan_links enable row level security;

revoke all on public.plan_shares, public.plan_links from anon, authenticated;
grant select on public.plan_shares to authenticated;
-- token_hash is never readable by signed-in users, not even the owner.
grant select (id, plan_id, permission, expires_at, revoked_at, created_by, created_at)
  on public.plan_links to authenticated;
grant all on public.plan_shares, public.plan_links to service_role;

create policy "plan_shares: owner or recipient reads" on public.plan_shares for select to authenticated
  using (
    (select public.is_plan_owner(plan_id))
    or (user_id = (select auth.uid()) and (select public.is_active_member()))
  );

create policy "plan_links: owner reads" on public.plan_links for select to authenticated
  using ((select public.is_plan_owner(plan_id)));

-- ---------------------------------------------------------------------------
-- Owner-only sharing functions (SECURITY DEFINER with explicit checks)
--   PT404 plan_not_found · PT403 not_allowed · PT422 member_unavailable / invalid_expiry
-- ---------------------------------------------------------------------------

-- Grants or changes a member's access. Returns the share id.
create or replace function public.share_plan(
  p_plan_id uuid, p_user_id uuid, p_permission public.share_permission
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_old public.share_permission;
  v_id uuid;
begin
  select owner_id into v_owner from public.plans where id = p_plan_id for update;
  if v_owner is null or not public.can_view_plan(p_plan_id) then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;
  if not public.is_plan_owner(p_plan_id) then
    raise exception 'not_allowed' using errcode = 'PT403';
  end if;
  -- Only other active members (never yourself: the owner already has full access).
  if p_user_id = v_owner
     or not exists (select 1 from public.profiles where id = p_user_id and status = 'active') then
    raise exception 'member_unavailable' using errcode = 'PT422';
  end if;

  select permission into v_old from public.plan_shares where plan_id = p_plan_id and user_id = p_user_id;

  insert into public.plan_shares (plan_id, user_id, permission, created_by)
  values (p_plan_id, p_user_id, p_permission, (select auth.uid()))
  on conflict (plan_id, user_id) do update set permission = excluded.permission
  returning id into v_id;

  if v_old is null or v_old <> p_permission then
    insert into public.plan_activities (plan_id, action, metadata)
    values (p_plan_id,
            case when v_old is null then 'share_granted' else 'share_changed' end,
            jsonb_build_object('user_id', p_user_id, 'permission', p_permission));
  end if;
  return v_id;
end;
$$;

create or replace function public.revoke_plan_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share record;
begin
  select plan_id, user_id into v_share from public.plan_shares where id = p_share_id;
  if not found or not public.is_plan_owner(v_share.plan_id) then
    raise exception 'share_not_found' using errcode = 'PT404';
  end if;
  delete from public.plan_shares where id = p_share_id;
  insert into public.plan_activities (plan_id, action, metadata)
  values (v_share.plan_id, 'share_revoked', jsonb_build_object('user_id', v_share.user_id));
end;
$$;

-- The server generates the token and passes only its hash. Returns the link id.
create or replace function public.create_plan_link(
  p_plan_id uuid, p_token_hash text, p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.can_view_plan(p_plan_id) then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;
  if not public.is_plan_owner(p_plan_id) then
    raise exception 'not_allowed' using errcode = 'PT403';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = 'PT422';
  end if;

  insert into public.plan_links (plan_id, token_hash, expires_at, created_by)
  values (p_plan_id, p_token_hash, p_expires_at, (select auth.uid()))
  returning id into v_id;

  -- Never log the token or its hash (spec §8.1 plan_activities).
  insert into public.plan_activities (plan_id, action, metadata)
  values (p_plan_id, 'link_created', jsonb_build_object('link_id', v_id, 'expires_at', p_expires_at));
  return v_id;
end;
$$;

create or replace function public.revoke_plan_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
begin
  select plan_id into v_plan_id from public.plan_links where id = p_link_id;
  if v_plan_id is null or not public.is_plan_owner(v_plan_id) then
    raise exception 'link_not_found' using errcode = 'PT404';
  end if;
  update public.plan_links set revoked_at = now() where id = p_link_id and revoked_at is null;
  if found then
    insert into public.plan_activities (plan_id, action, metadata)
    values (v_plan_id, 'link_revoked', jsonb_build_object('link_id', p_link_id));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public link resolution (service_role only; called by the server with the secret key)
-- A link works only while: not revoked, not expired, the plan isn't archived and the
-- owner is an active member (implementation plan, ambiguity 5).
-- ---------------------------------------------------------------------------
create or replace function public.valid_link_plan(p_token_hash text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select l.plan_id
    from public.plan_links l
    join public.plans p on p.id = l.plan_id
    join public.profiles o on o.id = p.owner_id
   where l.token_hash = p_token_hash
     and l.revoked_at is null
     and (l.expires_at is null or l.expires_at > now())
     and p.status <> 'archived'
     and o.status = 'active';
$$;

-- Only what the public page shows (spec §4.5 SHARE-08): no ids of people, no storage
-- paths, nothing from the rest of the library.
create or replace function public.get_shared_plan(p_token_hash text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', p.title,
    'description', p.description,
    'updated_at', p.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'notes', i.notes,
               'arrangement_id', a.id,
               'arrangement_title', a.title,
               'musical_key', a.musical_key,
               'bpm', a.bpm,
               'song_title', m.title,
               'file_version', (extract(epoch from a.updated_at) * 1000)::bigint::text)
             order by i.position)
        from public.plan_items i
        join public.arrangements a on a.id = i.arrangement_id
        join public.music_pieces m on m.id = a.music_piece_id
       where i.plan_id = p.id and a.status <> 'pending'), '[]'::jsonb))
    from public.plans p
   where p.id = public.valid_link_plan(p_token_hash);
$$;

-- The stored file of a sheet, only if this link's plan references it.
create or replace function public.shared_plan_sheet(p_token_hash text, p_arrangement_id uuid)
returns table (storage_path text, original_filename text)
language sql
stable
set search_path = ''
as $$
  select a.storage_path, a.original_filename
    from public.arrangements a
   where a.id = p_arrangement_id
     and a.status <> 'pending'
     and exists (
       select 1 from public.plan_items i
        where i.arrangement_id = a.id and i.plan_id = public.valid_link_plan(p_token_hash)
     );
$$;

-- Function privileges
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.share_plan(uuid, uuid, public.share_permission)', 'public.revoke_plan_share(uuid)',
    'public.create_plan_link(uuid, text, timestamptz)', 'public.revoke_plan_link(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  foreach f in array array[
    'public.valid_link_plan(text)', 'public.get_shared_plan(text)', 'public.shared_plan_sheet(text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
