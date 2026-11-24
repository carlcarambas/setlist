-- Milestone 2: music library.
-- music_pieces (the song), arrangements (a specific PDF sheet of it), the private
-- music-sheets bucket and its access rules. See docs/implementation-plan.md §4.2–§4.5.
--
-- Upload flow (spec §19 P1): the server inserts a 'pending' arrangement and issues a
-- signed upload URL; the browser uploads the PDF straight to Storage; the server then
-- checks the stored bytes and marks the arrangement 'active'. Only the server (secret
-- key) can move an arrangement out of 'pending' or change which file it points to.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.content_status as enum ('active', 'archived');
create type public.arrangement_status as enum ('pending', 'active', 'archived');

-- updated_by: the signed-in user, or the existing value for server (secret-key) updates.
create or replace function public.stamp_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- music_pieces
-- ---------------------------------------------------------------------------
create table public.music_pieces (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 1 and 200),
  composer    text check (composer is null or length(composer) <= 200),
  description text check (description is null or length(description) <= 2000),
  category    text check (category is null or length(category) <= 60),
  tags        text[] not null default '{}' check (cardinality(tags) <= 20),
  status      public.content_status not null default 'active',
  created_by  uuid not null default auth.uid() references public.profiles (id),
  updated_by  uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.music_pieces is 'A song. Its sheets are arrangements. Archived, never deleted.';

create index music_pieces_title_trgm on public.music_pieces using gin (title extensions.gin_trgm_ops);
create index music_pieces_tags on public.music_pieces using gin (tags);
create index music_pieces_status_title on public.music_pieces (status, title);
create index music_pieces_created_at on public.music_pieces (created_at desc);

create trigger music_pieces_set_updated_at
  before update on public.music_pieces
  for each row execute function public.set_updated_at();

create trigger music_pieces_stamp_updated_by
  before update on public.music_pieces
  for each row execute function public.stamp_updated_by();

alter table public.music_pieces enable row level security;

grant select on public.music_pieces to authenticated;
grant insert (title, composer, description, category, tags) on public.music_pieces to authenticated;
grant update (title, composer, description, category, tags, status) on public.music_pieces to authenticated;
grant all on public.music_pieces to service_role;

create policy "music_pieces: read as active member"
  on public.music_pieces for select to authenticated
  using ((select public.is_active_member()));

create policy "music_pieces: add as active member"
  on public.music_pieces for insert to authenticated
  with check ((select public.is_active_member()) and created_by = (select auth.uid()));

create policy "music_pieces: edit as active member"
  on public.music_pieces for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));

-- ---------------------------------------------------------------------------
-- arrangements
-- ---------------------------------------------------------------------------
create table public.arrangements (
  id                uuid primary key default gen_random_uuid(),
  music_piece_id    uuid not null references public.music_pieces (id) on delete restrict,
  title             text not null check (length(trim(title)) between 1 and 200),
  musical_key       text check (musical_key is null or length(musical_key) <= 20),
  bpm               integer check (bpm between 20 and 400),
  instrument_notes  text check (instrument_notes is null or length(instrument_notes) <= 500),
  storage_path      text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 255),
  mime_type         text not null check (mime_type = 'application/pdf'),
  file_size_bytes   bigint not null check (file_size_bytes > 0),
  content_sha256    text check (content_sha256 ~ '^[0-9a-f]{64}$'),
  status            public.arrangement_status not null default 'pending',
  uploaded_by       uuid not null default auth.uid() references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- The file must live under this arrangement's own folder.
  constraint arrangements_storage_path_folder
    check (storage_path like music_piece_id::text || '/' || id::text || '/%')
);

comment on table public.arrangements is
  'A specific PDF sheet of a music piece. Plans reference arrangements, never pieces.';

create index arrangements_piece on public.arrangements (music_piece_id, status);
create index arrangements_sha256 on public.arrangements (content_sha256);
create index arrangements_pending on public.arrangements (created_at) where status = 'pending';

create trigger arrangements_set_updated_at
  before update on public.arrangements
  for each row execute function public.set_updated_at();

-- Members may archive/unarchive, but only the server may leave or enter 'pending'.
create or replace function public.arrangements_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and 'pending' in (old.status, new.status)
     and coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'status_transition_not_allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger arrangements_guard
  before update on public.arrangements
  for each row execute function public.arrangements_guard();

alter table public.arrangements enable row level security;

grant select on public.arrangements to authenticated;
-- status, uploaded_by and timestamps aren't insertable: they take their defaults.
grant insert (id, music_piece_id, title, musical_key, bpm, instrument_notes, storage_path,
              original_filename, mime_type, file_size_bytes, content_sha256)
  on public.arrangements to authenticated;
-- File columns aren't updatable by members; replacing a PDF goes through the server.
grant update (title, musical_key, bpm, instrument_notes, status) on public.arrangements to authenticated;
grant all on public.arrangements to service_role;

-- Pending uploads are visible only to the person uploading them.
create policy "arrangements: read as active member"
  on public.arrangements for select to authenticated
  using (
    (select public.is_active_member())
    and (status <> 'pending' or uploaded_by = (select auth.uid()))
  );

create policy "arrangements: add as active member"
  on public.arrangements for insert to authenticated
  with check (
    (select public.is_active_member())
    and uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.music_pieces p
       where p.id = music_piece_id and p.status = 'active'
    )
  );

create policy "arrangements: edit as active member"
  on public.arrangements for update to authenticated
  using ((select public.is_active_member()) and status <> 'pending')
  with check ((select public.is_active_member()));

-- ---------------------------------------------------------------------------
-- Search helpers
-- ---------------------------------------------------------------------------
-- Possible duplicates for an upload: same file contents, or a similar title (LIB-13).
create or replace function public.find_possible_duplicates(p_title text, p_sha256 text)
returns table (music_piece_id uuid, title text, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (p.id) p.id, p.title,
         case when a.content_sha256 = p_sha256 then 'same_file' else 'similar_title' end
    from public.music_pieces p
    left join public.arrangements a
      on a.music_piece_id = p.id and a.status <> 'pending'
   where (p_sha256 is not null and a.content_sha256 = p_sha256)
      or (coalesce(trim(p_title), '') <> '' and extensions.similarity(p.title, p_title) > 0.45)
   order by p.id, (a.content_sha256 = p_sha256) desc nulls last
   limit 5;
$$;

-- Distinct categories in use, for the library filter.
create or replace function public.music_categories()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct category from public.music_pieces
   where category is not null and status = 'active'
   order by 1;
$$;

revoke execute on function public.find_possible_duplicates(text, text) from public, anon;
revoke execute on function public.music_categories() from public, anon;
grant execute on function public.find_possible_duplicates(text, text) to authenticated;
grant execute on function public.music_categories() to authenticated;
revoke execute on function public.arrangements_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for PDF sheets (spec §9)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music-sheets', 'music-sheets', false, 20 * 1024 * 1024, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- May the current user upload this object? Either the file for their own pending
-- arrangement, or a replacement file in an existing arrangement's folder.
create or replace function public.can_upload_sheet(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.arrangements a
     where (a.status = 'pending' and a.uploaded_by = (select auth.uid()) and a.storage_path = p_name)
        or (a.status <> 'pending'
            and p_name like a.music_piece_id::text || '/' || a.id::text || '/%'
            and p_name <> a.storage_path)
  );
$$;

revoke execute on function public.can_upload_sheet(text) from public, anon;
grant execute on function public.can_upload_sheet(text) to authenticated;

create policy "music-sheets: read as active member"
  on storage.objects for select to authenticated
  using (bucket_id = 'music-sheets' and (select public.is_active_member()));

create policy "music-sheets: upload own pending sheet"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'music-sheets' and public.can_upload_sheet(name));
-- No update/delete policies: old files are removed by the server only.
