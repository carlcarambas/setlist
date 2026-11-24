-- Milestone 7: pull sync for offline devices (spec v2 §4.5 OFF-03, §8.2).
--
--   * deleted_rows: tombstones for rows that are really deleted (plans, plan items, events, event links),
--     so a device can remove them. Music is never deleted (only archived), so it needs none.
--   * pull_changes(since): everything the caller may read that changed since `since`, plus tombstones,
--     in one statement (one consistent snapshot). SECURITY INVOKER: RLS and column grants apply.

create table public.deleted_rows (
  id          bigint generated always as identity primary key,
  table_name  text not null check (table_name in ('plans', 'plan_items', 'events', 'event_plans')),
  row_id      uuid not null,
  deleted_at  timestamptz not null default now()
);
create index deleted_rows_deleted_at on public.deleted_rows (deleted_at);

comment on table public.deleted_rows is
  'Tombstones for offline sync. Kept 90 days; older devices do a full resync.';

alter table public.deleted_rows enable row level security;
revoke all on public.deleted_rows from anon, authenticated;
grant select on public.deleted_rows to authenticated;
grant all on public.deleted_rows to service_role;
-- Only ids and times: any active session may read them (every plan and event is visible to members).
create policy "deleted_rows: members read" on public.deleted_rows for select to authenticated
  using ((select public.is_active_member()));

-- Records a tombstone for every deleted row, including cascaded deletes, and prunes old ones.
create or replace function public.record_deleted_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.deleted_rows (table_name, row_id) values (tg_table_name, old.id);
  delete from public.deleted_rows where deleted_at < now() - interval '90 days';
  return old;
end;
$$;
revoke execute on function public.record_deleted_row() from public, anon, authenticated;

create trigger plans_record_deleted after delete on public.plans
  for each row execute function public.record_deleted_row();
create trigger plan_items_record_deleted after delete on public.plan_items
  for each row execute function public.record_deleted_row();
create trigger events_record_deleted after delete on public.events
  for each row execute function public.record_deleted_row();
create trigger event_plans_record_deleted after delete on public.event_plans
  for each row execute function public.record_deleted_row();

-- Sync cursors compare updated_at (created_at for event links, which are never updated).
create index music_pieces_updated_at on public.music_pieces (updated_at);
create index arrangements_updated_at on public.arrangements (updated_at);
create index plans_updated_at on public.plans (updated_at);
create index plan_items_updated_at on public.plan_items (updated_at);
create index events_updated_at on public.events (updated_at);
create index event_plans_created_at on public.event_plans (created_at);
create index profiles_updated_at on public.profiles (updated_at);

-- Changes since p_since (null = everything). Columns are listed explicitly: only what the device shows.
create or replace function public.pull_changes(p_since timestamptz default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'server_time', now(),
    'music_pieces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'composer', p.composer, 'description', p.description,
        'category', p.category, 'tags', p.tags, 'status', p.status,
        'created_at', p.created_at, 'updated_at', p.updated_at))
        from public.music_pieces p
       where p_since is null or p.updated_at > p_since), '[]'::jsonb),
    'arrangements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'music_piece_id', a.music_piece_id, 'title', a.title, 'musical_key', a.musical_key,
        'bpm', a.bpm, 'instrument_notes', a.instrument_notes, 'original_filename', a.original_filename,
        'file_size_bytes', a.file_size_bytes, 'status', a.status, 'uploaded_by', a.uploaded_by,
        'created_at', a.created_at, 'updated_at', a.updated_at))
        from public.arrangements a
       where a.status <> 'pending' and (p_since is null or a.updated_at > p_since)), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'description', p.description, 'status', p.status,
        'version', p.version, 'owner_id', p.owner_id, 'updated_by', p.updated_by,
        'created_at', p.created_at, 'updated_at', p.updated_at))
        from public.plans p
       where p_since is null or p.updated_at > p_since), '[]'::jsonb),
    'plan_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'plan_id', i.plan_id, 'arrangement_id', i.arrangement_id, 'position', i.position,
        'notes', i.notes, 'updated_at', i.updated_at))
        from public.plan_items i
       where p_since is null or i.updated_at > p_since), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'description', e.description, 'event_date', e.event_date,
        'start_time', e.start_time, 'created_by', e.created_by, 'updated_at', e.updated_at))
        from public.events e
       where p_since is null or e.updated_at > p_since), '[]'::jsonb),
    'event_plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ep.id, 'event_id', ep.event_id, 'plan_id', ep.plan_id, 'position', ep.position,
        'created_at', ep.created_at))
        from public.event_plans ep
       where p_since is null or ep.created_at > p_since), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'display_name', pr.display_name, 'role', pr.role, 'status', pr.status,
        'is_anonymous', pr.is_anonymous, 'updated_at', pr.updated_at))
        from public.profiles pr
       where p_since is null or pr.updated_at > p_since), '[]'::jsonb),
    'app_settings', (
      select jsonb_build_object('church_name', s.church_name, 'timezone', s.timezone, 'updated_at', s.updated_at)
        from public.app_settings s),
    'deleted', coalesce((
      select jsonb_agg(jsonb_build_object('table', d.table_name, 'id', d.row_id))
        from public.deleted_rows d
       where p_since is not null and d.deleted_at > p_since), '[]'::jsonb)
  );
$$;
revoke execute on function public.pull_changes(timestamptz) from public, anon;
grant execute on function public.pull_changes(timestamptz) to authenticated;
