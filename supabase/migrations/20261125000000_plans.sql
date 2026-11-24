-- Milestone 3: plans (setlists).
-- plans, plan_items (ordered arrangements), plan_activities, and the versioned
-- functions every plan edit goes through. See docs/implementation-plan.md §4.4 and
-- spec §4.3, §19 P4.
--
-- Access in this milestone: a plan is private to its owner. Milestone 4 extends
-- can_view_plan()/can_edit_plan() with member shares; nothing else changes.
--
-- Concurrency (spec §19 P4): every edit increments plans.version. Title/description,
-- item notes and reorder must name the version they were based on and fail with
-- 'version_conflict' (HTTP 409) if someone else changed the plan first. Adding and
-- removing songs never overwrite anything, so they don't require a match.

create type public.plan_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  owner_id    uuid not null default auth.uid() references public.profiles (id),
  status      public.plan_status not null default 'draft',
  version     integer not null default 1 check (version >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid not null default auth.uid() references public.profiles (id)
);

comment on table public.plans is 'A setlist. Private to its owner until shared. Archived, never deleted.';
create index plans_owner_updated on public.plans (owner_id, updated_at desc);

create table public.plan_items (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.plans (id) on delete cascade,
  arrangement_id uuid not null references public.arrangements (id) on delete restrict,
  position       integer not null check (position >= 0),
  notes          text check (notes is null or length(notes) <= 500),
  added_by       uuid not null default auth.uid() references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Deferred so a reorder can rewrite every position in one statement.
  constraint plan_items_position_key unique (plan_id, position) deferrable initially deferred
);

create index plan_items_arrangement on public.plan_items (arrangement_id);

create table public.plan_activities (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id),
  action     text not null check (action in (
               'plan_created', 'plan_updated', 'plan_status_changed', 'plan_duplicated',
               'item_added', 'item_removed', 'items_reordered', 'item_notes_updated')),
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index plan_activities_plan on public.plan_activities (plan_id, created_at desc);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();
create trigger plans_stamp_updated_by
  before update on public.plans
  for each row execute function public.stamp_updated_by();
create trigger plan_items_set_updated_at
  before update on public.plan_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER: avoids RLS recursion; one indexed lookup each)
-- ---------------------------------------------------------------------------
create or replace function public.is_plan_owner(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.plans where id = p_plan_id and owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_view_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_plan_owner(p_plan_id);
$$;

create or replace function public.can_edit_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_plan_owner(p_plan_id);
$$;

-- Owner can't change; only the owner archives or restores (spec §3.2).
create or replace function public.plans_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_cannot_change' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and 'archived' in (old.status, new.status)
     and old.owner_id <> (select auth.uid()) then
    raise exception 'only_owner_can_archive' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger plans_guard
  before update on public.plans
  for each row execute function public.plans_guard();

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.plan_activities enable row level security;

grant select on public.plans to authenticated;
grant insert (title, description) on public.plans to authenticated;
grant update (title, description, status, version) on public.plans to authenticated;
grant select on public.plan_items to authenticated;
grant insert (plan_id, arrangement_id, position, notes) on public.plan_items to authenticated;
grant update (position, notes) on public.plan_items to authenticated;
grant delete on public.plan_items to authenticated;
grant select on public.plan_activities to authenticated;
grant insert (plan_id, action, metadata) on public.plan_activities to authenticated;
grant all on public.plans, public.plan_items, public.plan_activities to service_role;

-- Ownership is checked on the row itself too, so a newly inserted plan is readable
-- within its own INSERT … RETURNING (the helper can't see the row yet).
create policy "plans: read if allowed" on public.plans for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.is_active_member()))
    or public.can_view_plan(id)
  );
create policy "plans: create own" on public.plans for insert to authenticated
  with check ((select public.is_active_member()) and owner_id = (select auth.uid()));
create policy "plans: edit if allowed" on public.plans for update to authenticated
  using ((select public.can_edit_plan(id)))
  with check ((select public.can_edit_plan(id)));

create policy "plan_items: read if plan readable" on public.plan_items for select to authenticated
  using ((select public.can_view_plan(plan_id)));
create policy "plan_items: add if plan editable" on public.plan_items for insert to authenticated
  with check ((select public.can_edit_plan(plan_id)) and added_by = (select auth.uid()));
create policy "plan_items: change if plan editable" on public.plan_items for update to authenticated
  using ((select public.can_edit_plan(plan_id)))
  with check ((select public.can_edit_plan(plan_id)));
create policy "plan_items: remove if plan editable" on public.plan_items for delete to authenticated
  using ((select public.can_edit_plan(plan_id)));

create policy "plan_activities: read if plan readable" on public.plan_activities for select to authenticated
  using ((select public.can_view_plan(plan_id)));
create policy "plan_activities: record if plan editable" on public.plan_activities for insert to authenticated
  with check ((select public.can_edit_plan(plan_id)) and user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Versioned edit functions (SECURITY INVOKER: RLS still applies)
-- Errors use PostgREST's PTxxx codes so the API returns a matching HTTP status:
--   PT404 plan_not_found · PT403 not_allowed · PT409 version_conflict · PT423 plan_archived
-- ---------------------------------------------------------------------------

-- Locks the plan row, checks access and (optionally) the expected version, then
-- increments the version. Returns the new version.
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
  select id, version, status into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;
  if not public.can_edit_plan(p_plan_id) then
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

create or replace function public.create_plan(p_title text, p_description text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.plans (title, description)
  values (trim(p_title), nullif(trim(coalesce(p_description, '')), ''))
  returning id into v_id;
  insert into public.plan_activities (plan_id, action) values (v_id, 'plan_created');
  return v_id;
end;
$$;

create or replace function public.update_plan_details(
  p_plan_id uuid, p_expected_version integer, p_title text, p_description text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer := public.bump_plan_version(p_plan_id, p_expected_version);
begin
  update public.plans
     set title = trim(p_title), description = nullif(trim(coalesce(p_description, '')), '')
   where id = p_plan_id;
  insert into public.plan_activities (plan_id, action) values (p_plan_id, 'plan_updated');
  return v_version;
end;
$$;

create or replace function public.add_plan_item(p_plan_id uuid, p_arrangement_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
  v_item_id uuid;
  v_title text;
begin
  -- Only active sheets of active songs can be added (spec §8.2).
  select p.title || ' — ' || a.title into v_title
    from public.arrangements a
    join public.music_pieces p on p.id = a.music_piece_id
   where a.id = p_arrangement_id and a.status = 'active' and p.status = 'active';
  if v_title is null then
    raise exception 'arrangement_unavailable' using errcode = 'PT422';
  end if;

  v_version := public.bump_plan_version(p_plan_id, null);

  insert into public.plan_items (plan_id, arrangement_id, position)
  select p_plan_id, p_arrangement_id, coalesce(max(position) + 1, 0)
    from public.plan_items where plan_id = p_plan_id
  returning id into v_item_id;

  insert into public.plan_activities (plan_id, action, metadata)
  values (p_plan_id, 'item_added', jsonb_build_object('arrangement_id', p_arrangement_id, 'title', v_title));

  return jsonb_build_object('item_id', v_item_id, 'version', v_version);
end;
$$;

create or replace function public.remove_plan_item(p_item_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_arrangement_id uuid;
  v_version integer;
begin
  select plan_id, arrangement_id into v_plan_id, v_arrangement_id
    from public.plan_items where id = p_item_id;
  if v_plan_id is null then
    raise exception 'item_not_found' using errcode = 'PT404';
  end if;

  v_version := public.bump_plan_version(v_plan_id, null);
  delete from public.plan_items where id = p_item_id;
  insert into public.plan_activities (plan_id, action, metadata)
  values (v_plan_id, 'item_removed', jsonb_build_object('arrangement_id', v_arrangement_id));
  return v_version;
end;
$$;

create or replace function public.reorder_plan_items(
  p_plan_id uuid, p_expected_version integer, p_item_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer := public.bump_plan_version(p_plan_id, p_expected_version);
begin
  -- The new order must contain exactly this plan's items, each once (spec §4.3).
  if cardinality(p_item_ids) <> (select count(distinct x) from unnest(p_item_ids) x)
     or cardinality(p_item_ids) <> (select count(*) from public.plan_items where plan_id = p_plan_id)
     or exists (
       select 1 from unnest(p_item_ids) x
        where not exists (select 1 from public.plan_items i where i.id = x and i.plan_id = p_plan_id)
     ) then
    raise exception 'invalid_item_set' using errcode = 'PT422';
  end if;

  update public.plan_items i
     set position = o.ord - 1
    from unnest(p_item_ids) with ordinality as o(id, ord)
   where i.id = o.id and i.plan_id = p_plan_id and i.position <> o.ord - 1;

  insert into public.plan_activities (plan_id, action) values (p_plan_id, 'items_reordered');
  return v_version;
end;
$$;

create or replace function public.update_plan_item_notes(
  p_item_id uuid, p_expected_version integer, p_notes text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_version integer;
begin
  select plan_id into v_plan_id from public.plan_items where id = p_item_id;
  if v_plan_id is null then
    raise exception 'item_not_found' using errcode = 'PT404';
  end if;

  v_version := public.bump_plan_version(v_plan_id, p_expected_version);
  update public.plan_items set notes = nullif(trim(coalesce(p_notes, '')), '') where id = p_item_id;
  insert into public.plan_activities (plan_id, action, metadata)
  values (v_plan_id, 'item_notes_updated', jsonb_build_object('item_id', p_item_id));
  return v_version;
end;
$$;

-- Draft/published by anyone who can edit; archive/restore by the owner (plans_guard).
create or replace function public.set_plan_status(p_plan_id uuid, p_status public.plan_status)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan record;
  v_new integer;
begin
  select id, status into v_plan from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;
  if not public.can_edit_plan(p_plan_id) then
    raise exception 'not_allowed' using errcode = 'PT403';
  end if;
  if v_plan.status = p_status then
    return (select version from public.plans where id = p_plan_id);
  end if;

  update public.plans set status = p_status, version = version + 1
   where id = p_plan_id returning version into v_new;
  insert into public.plan_activities (plan_id, action, metadata)
  values (p_plan_id, 'plan_status_changed', jsonb_build_object('from', v_plan.status, 'to', p_status));
  return v_new;
end;
$$;

-- Copies a plan the caller can view into a new draft they own. Items are copied;
-- shares and links are not (spec §15).
create or replace function public.duplicate_plan(p_plan_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source record;
  v_new_id uuid;
begin
  select title, description into v_source from public.plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'PT404';
  end if;

  insert into public.plans (title, description)
  values (left('Copy of ' || v_source.title, 200), v_source.description)
  returning id into v_new_id;

  insert into public.plan_items (plan_id, arrangement_id, position, notes)
  select v_new_id, arrangement_id, row_number() over (order by position) - 1, notes
    from public.plan_items where plan_id = p_plan_id;

  insert into public.plan_activities (plan_id, action, metadata)
  values (v_new_id, 'plan_duplicated', jsonb_build_object('from_plan_id', p_plan_id));
  return v_new_id;
end;
$$;

-- Function privileges: signed-in users only.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.is_plan_owner(uuid)', 'public.can_view_plan(uuid)', 'public.can_edit_plan(uuid)',
    'public.bump_plan_version(uuid, integer)', 'public.create_plan(text, text)',
    'public.update_plan_details(uuid, integer, text, text)', 'public.add_plan_item(uuid, uuid)',
    'public.remove_plan_item(uuid)', 'public.reorder_plan_items(uuid, integer, uuid[])',
    'public.update_plan_item_notes(uuid, integer, text)',
    'public.set_plan_status(uuid, public.plan_status)', 'public.duplicate_plan(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke execute on function public.plans_guard() from public, anon, authenticated;
