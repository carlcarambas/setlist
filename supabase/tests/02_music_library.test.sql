-- Music library: pieces, arrangements, storage. Run with `npm run test:db`.
begin;
select plan(30);

-- Users: two active members, one inactive.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'ana@test.local'),
  ('00000000-0000-0000-0000-00000000b002', 'ben@test.local'),
  ('00000000-0000-0000-0000-00000000c003', 'cy@test.local');
update public.profiles set status = 'active'
 where id in ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000b002');
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-00000000c003';

-- ---- Ana (active member) ----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.music_pieces (title, composer, tags)
     values ('Amazing Grace', 'John Newton', '{hymn}') $$,
  'active member can add a music piece');

select results_eq(
  $$ select created_by, updated_by from public.music_pieces where title = 'Amazing Grace' $$,
  $$ values ('00000000-0000-0000-0000-00000000a001'::uuid, '00000000-0000-0000-0000-00000000a001'::uuid) $$,
  'creator is recorded from the session');

select throws_ok(
  $$ insert into public.music_pieces (title, created_by)
     values ('Spoofed', '00000000-0000-0000-0000-00000000b002') $$,
  '42501', null, 'created_by cannot be supplied by the client');

-- Arrangement ids/paths for the tests.
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated, service_role;
insert into ids select 'piece', id from public.music_pieces where title = 'Amazing Grace';
insert into ids values ('arr', gen_random_uuid()), ('other_arr', gen_random_uuid());

select lives_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes)
     select a.id, p.id, 'Key of G', p.id || '/' || a.id || '/sheet.pdf', 'grace.pdf', 'application/pdf', 1000
       from ids p, ids a where p.name = 'piece' and a.name = 'arr' $$,
  'active member can add a pending arrangement');

select is(
  (select status::text from public.arrangements where id = (select id from ids where name = 'arr')),
  'pending', 'new arrangements start as pending');

select throws_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes)
     select a.id, p.id, 'Wrong folder', 'somewhere-else/sheet.pdf', 'x.pdf', 'application/pdf', 1000
       from ids p, ids a where p.name = 'piece' and a.name = 'other_arr' $$,
  '23514', null, 'the file must live in the arrangement''s own folder');

select throws_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes, status)
     select a.id, p.id, 'Pre-approved', p.id || '/' || a.id || '/s.pdf', 'x.pdf', 'application/pdf', 1000, 'active'
       from ids p, ids a where p.name = 'piece' and a.name = 'other_arr' $$,
  '42501', null, 'status cannot be set on insert');

update public.arrangements set status = 'active' where id = (select id from ids where name = 'arr');
select is(
  (select status::text from public.arrangements where id = (select id from ids where name = 'arr')),
  'pending', 'a member cannot approve their own pending upload');

-- Storage: Ana may upload exactly her pending file, nothing else.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'music-sheets', storage_path from public.arrangements where id = (select id from ids where name = 'arr') $$,
  'member can upload the file for their own pending arrangement');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('music-sheets', 'random/other.pdf') $$,
  '42501', null, 'member cannot upload to an arbitrary path');
reset role;

-- ---- Ben (another active member) -------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);

select is((select count(*)::int from public.arrangements), 0, 'others cannot see a pending upload');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'music-sheets', (select id from ids where name = 'piece') || '/' || (select id from ids where name = 'arr') || '/sheet.pdf' $$,
  '42501', null, 'others cannot upload into someone else''s pending upload');
reset role;

-- ---- Server finalizes the upload (secret key) -------------------------------
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$ update public.arrangements set status = 'active' where id = (select id from ids where name = 'arr') $$,
  'the server can activate a checked upload');
reset role;

-- ---- Ben, after activation ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);

select is((select count(*)::int from public.arrangements), 1, 'active arrangements are visible to every member');

update public.arrangements set musical_key = 'G', bpm = 72 where id = (select id from ids where name = 'arr');
select is((select musical_key from public.arrangements where id = (select id from ids where name = 'arr')),
  'G', 'any member can edit arrangement details');

select throws_ok(
  $$ update public.arrangements set storage_path = 'x' where id = (select id from ids where name = 'arr') $$,
  '42501', null, 'members cannot repoint an arrangement to another file');

select lives_ok(
  $$ update public.arrangements set status = 'archived' where id = (select id from ids where name = 'arr') $$,
  'members can archive an arrangement');
select lives_ok(
  $$ update public.arrangements set status = 'active' where id = (select id from ids where name = 'arr') $$,
  'members can restore an archived arrangement');
select throws_ok(
  $$ update public.arrangements set status = 'pending' where id = (select id from ids where name = 'arr') $$,
  '42501', null, 'members cannot move an arrangement back to pending');

update public.music_pieces set title = 'Amazing Grace (My Chains)' where id = (select id from ids where name = 'piece');
select results_eq(
  $$ select title, updated_by from public.music_pieces where id = (select id from ids where name = 'piece') $$,
  $$ values ('Amazing Grace (My Chains)', '00000000-0000-0000-0000-00000000b002'::uuid) $$,
  'any member can edit a piece; updated_by follows the editor');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'music-sheets', (select id from ids where name = 'piece') || '/' || (select id from ids where name = 'arr') || '/replacement.pdf' $$,
  'members can upload a replacement file into an existing arrangement''s folder');

select throws_ok(
  $$ delete from public.music_pieces where id = (select id from ids where name = 'piece') $$,
  '42501', null, 'music cannot be deleted, only archived');

select results_eq(
  $$ select reason from public.find_possible_duplicates('Amazing Grace', null) $$,
  $$ values ('similar_title') $$,
  'similar titles are reported as possible duplicates');

select is((select count(*)::int from public.music_categories()), 0, 'no categories until one is set');
update public.music_pieces set category = 'Hymn' where id = (select id from ids where name = 'piece');
select results_eq($$ select * from public.music_categories() $$, $$ values ('Hymn') $$,
  'categories in use are listed for filtering');

-- Archived pieces stay readable (plans keep working); new arrangements need an active piece.
update public.music_pieces set status = 'archived' where id = (select id from ids where name = 'piece');
select is((select count(*)::int from public.music_pieces where status = 'archived'), 1,
  'archived pieces remain readable');
select throws_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes)
     select a.id, p.id, 'Late', p.id || '/' || a.id || '/s.pdf', 'x.pdf', 'application/pdf', 1000
       from ids p, ids a where p.name = 'piece' and a.name = 'other_arr' $$,
  '42501', null, 'cannot add arrangements to an archived piece');
reset role;

-- ---- Inactive member ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c003","role":"authenticated"}', true);
select is((select count(*)::int from public.music_pieces), 0, 'inactive member cannot see the library');
select is((select count(*)::int from storage.objects where bucket_id = 'music-sheets'), 0,
  'inactive member cannot see sheet files');
reset role;

-- ---- Anonymous ------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.music_pieces $$, '42501', null, 'anonymous users have no library access');
reset role;

select * from finish();
rollback;
