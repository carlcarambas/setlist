-- Music library (spec v2 §4.2): everyone reads; only administrators write. Run with `npm run test:db`.
begin;
select plan(31);

-- Ana: administrator. Ben: anonymous member device. Cy: blocked device.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000a001', 'ana@test.local', false),
  ('00000000-0000-0000-0000-00000000b002', null, true),
  ('00000000-0000-0000-0000-00000000c003', null, true);
update public.profiles set status = 'active', role = 'admin' where id = '00000000-0000-0000-0000-00000000a001';
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-00000000c003';

create temporary table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated, service_role;
insert into ids values ('arr', gen_random_uuid()), ('other_arr', gen_random_uuid());

-- ---- Ana (administrator) -----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.music_pieces (title, composer, tags) values ('Amazing Grace', 'John Newton', '{hymn}') $$,
  'an administrator can add a music piece');
select results_eq(
  $$ select created_by, updated_by from public.music_pieces where title = 'Amazing Grace' $$,
  $$ values ('00000000-0000-0000-0000-00000000a001'::uuid, '00000000-0000-0000-0000-00000000a001'::uuid) $$,
  'the creator is recorded from the session');
select throws_ok(
  $$ insert into public.music_pieces (title, created_by) values ('Spoofed', '00000000-0000-0000-0000-00000000b002') $$,
  '42501', null, 'created_by cannot be supplied by the client');
insert into ids select 'piece', id from public.music_pieces where title = 'Amazing Grace';

select lives_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes)
     select a.id, p.id, 'Key of G', p.id || '/' || a.id || '/sheet.pdf', 'grace.pdf', 'application/pdf', 1000
       from ids p, ids a where p.name = 'piece' and a.name = 'arr' $$,
  'an administrator can add a pending arrangement');
select is((select status::text from public.arrangements where id = (select id from ids where name = 'arr')),
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
select is((select status::text from public.arrangements where id = (select id from ids where name = 'arr')),
  'pending', 'an upload is activated only by the server after checking the file');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'music-sheets', storage_path from public.arrangements where id = (select id from ids where name = 'arr') $$,
  'an administrator can upload the file for their pending arrangement');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('music-sheets', 'random/other.pdf') $$,
  '42501', null, 'not even an administrator can upload to an arbitrary path');
reset role;

-- ---- Ben sees no pending upload --------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.arrangements), 0, 'members cannot see a pending upload');
reset role;

-- ---- Server finalizes the upload (secret key) -------------------------------------
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$ update public.arrangements set status = 'active' where id = (select id from ids where name = 'arr') $$,
  'the server can activate a checked upload');
reset role;

-- ---- Ben (member device) ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated","is_anonymous":true}', true);

select is((select count(*)::int from public.arrangements), 1, 'active arrangements are visible to every member');
select is((select count(*)::int from storage.objects where bucket_id = 'music-sheets'), 1, 'members can read sheet files');
select results_eq($$ select reason from public.find_possible_duplicates('Amazing Grace', null) $$,
  $$ values ('similar_title') $$, 'members can use library search helpers');

select throws_ok($$ insert into public.music_pieces (title) values ('Member Song') $$,
  '42501', null, 'members cannot add music');
update public.music_pieces set title = 'Vandalized' where id = (select id from ids where name = 'piece');
select is((select title from public.music_pieces where id = (select id from ids where name = 'piece')),
  'Amazing Grace', 'members cannot edit music details');
update public.music_pieces set status = 'archived' where id = (select id from ids where name = 'piece');
select is((select status::text from public.music_pieces where id = (select id from ids where name = 'piece')),
  'active', 'members cannot archive music');
update public.arrangements set musical_key = 'X', status = 'archived' where id = (select id from ids where name = 'arr');
select results_eq(
  $$ select musical_key, status::text from public.arrangements where id = (select id from ids where name = 'arr') $$,
  $$ values (null::text, 'active') $$, 'members cannot edit or archive arrangements');
select throws_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes)
     select a.id, p.id, 'Member', p.id || '/' || a.id || '/m.pdf', 'm.pdf', 'application/pdf', 1000
       from ids p, ids a where p.name = 'piece' and a.name = 'other_arr' $$,
  '42501', null, 'members cannot add arrangements');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'music-sheets', (select id from ids where name = 'piece') || '/' || (select id from ids where name = 'arr') || '/replacement.pdf' $$,
  '42501', null, 'members cannot upload or replace sheet files');
select throws_ok($$ delete from public.music_pieces where id = (select id from ids where name = 'piece') $$,
  '42501', null, 'music cannot be deleted through the API');
reset role;

-- ---- Ana edits, archives and restores ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
update public.arrangements set musical_key = 'G', bpm = 72 where id = (select id from ids where name = 'arr');
select is((select musical_key from public.arrangements where id = (select id from ids where name = 'arr')), 'G',
  'an administrator can edit arrangement details');
select throws_ok($$ update public.arrangements set storage_path = 'x' where id = (select id from ids where name = 'arr') $$,
  '42501', null, 'not even an administrator can repoint an arrangement to another file');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     select 'music-sheets', (select id from ids where name = 'piece') || '/' || (select id from ids where name = 'arr') || '/replacement.pdf' $$,
  'an administrator can upload a replacement file into the arrangement''s folder');
select throws_ok($$ update public.arrangements set status = 'pending' where id = (select id from ids where name = 'arr') $$,
  '42501', null, 'an arrangement cannot go back to pending');
update public.music_pieces set category = 'Hymn' where id = (select id from ids where name = 'piece');
select results_eq($$ select * from public.music_categories() $$, $$ values ('Hymn') $$,
  'categories in use are listed for filtering');
update public.music_pieces set status = 'archived' where id = (select id from ids where name = 'piece');
select throws_ok(
  $$ insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes)
     select a.id, p.id, 'Late', p.id || '/' || a.id || '/s.pdf', 'x.pdf', 'application/pdf', 1000
       from ids p, ids a where p.name = 'piece' and a.name = 'other_arr' $$,
  '42501', null, 'arrangements cannot be added to an archived piece');
reset role;

-- ---- Ben still reads archived music (plans keep working) ------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.music_pieces where status = 'archived'), 1, 'archived pieces remain readable');
reset role;

-- ---- Blocked device and no session ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c003","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.music_pieces), 0, 'a blocked device cannot see the library');
reset role;

set local role anon;
select throws_ok($$ select * from public.music_pieces $$, '42501', null, 'no session: no library access');
reset role;

select * from finish();
rollback;
