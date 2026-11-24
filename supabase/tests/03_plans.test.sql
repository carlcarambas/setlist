-- Plans: ownership, ordering, versioning, archiving, duplication. Run with `npm run test:db`.
begin;
select plan(32);

-- Users: Ana (owner), Ben (another member), Cy (inactive).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'ben@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'cy@test.local');
update public.profiles set status = 'active'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000000c3';

-- Library: one song with three sheets (two active, one archived), one archived song.
insert into public.music_pieces (id, title, status, created_by, updated_by) values
  ('10000000-0000-0000-0000-000000000001', 'Amazing Grace', 'active',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000002', 'Old Song', 'archived',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1');
insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes, status, uploaded_by)
select id, piece, title, piece || '/' || id || '/f.pdf', 'f.pdf', 'application/pdf', 100, status::public.arrangement_status,
       '00000000-0000-0000-0000-0000000000a1'
  from (values
    ('20000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Key of G', 'active'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Key of C', 'active'),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Old key', 'archived'),
    ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Only', 'active')
  ) as v(id, piece, title, status);

create temporary table t (name text primary key, id uuid) on commit drop;
grant select, insert, update on t to authenticated;

-- ---- Ana creates and edits a plan -------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into t values ('plan', public.create_plan('Sunday Service', '  '));
select results_eq(
  $$ select title, description, owner_id, status::text, version from public.plans where id = (select id from t where name = 'plan') $$,
  $$ values ('Sunday Service', null::text, '00000000-0000-0000-0000-0000000000a1'::uuid, 'draft', 1) $$,
  'create_plan makes a draft owned by the caller, blank description stored as null');
select is((select action from public.plan_activities where plan_id = (select id from t where name = 'plan')),
  'plan_created', 'plan creation is recorded');

select lives_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001') $$, 'add first song');
select lives_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000002') $$, 'add second song');
select lives_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001') $$, 'the same arrangement can appear twice');

select results_eq(
  $$ select position from public.plan_items where plan_id = (select id from t where name = 'plan') order by position $$,
  $$ values (0), (1), (2) $$, 'songs are appended in order');
select is((select version from public.plans where id = (select id from t where name = 'plan')), 4,
  'every edit increments the version');

select throws_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000003') $$,
  'PT422', 'arrangement_unavailable', 'archived arrangements cannot be added');
select throws_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000004') $$,
  'PT422', 'arrangement_unavailable', 'arrangements of archived songs cannot be added');

-- Reorder: reverse the list.
insert into t select 'order', null;
select throws_ok(
  $$ select public.reorder_plan_items((select id from t where name = 'plan'), 3,
       array(select id from public.plan_items where plan_id = (select id from t where name = 'plan') order by position desc)) $$,
  'PT409', 'version_conflict', 'a reorder based on an old version is rejected');
select is(
  public.reorder_plan_items((select id from t where name = 'plan'), 4,
    array(select id from public.plan_items where plan_id = (select id from t where name = 'plan') order by position desc)),
  5, 'a reorder based on the current version succeeds and returns the new version');
select results_eq(
  $$ select a.title from public.plan_items i join public.arrangements a on a.id = i.arrangement_id
      where i.plan_id = (select id from t where name = 'plan') order by i.position $$,
  $$ values ('Key of G'), ('Key of C'), ('Key of G') $$, 'the new order is saved');
select throws_ok(
  $$ select public.reorder_plan_items((select id from t where name = 'plan'), 5,
       array(select id from public.plan_items where plan_id = (select id from t where name = 'plan') order by position limit 2)) $$,
  'PT422', 'invalid_item_set', 'a reorder missing a song is rejected');
select throws_ok(
  $$ select public.reorder_plan_items((select id from t where name = 'plan'), 5,
       array(select id from public.plan_items where plan_id = (select id from t where name = 'plan')) || gen_random_uuid()) $$,
  'PT422', 'invalid_item_set', 'a reorder with an unknown item is rejected');

select throws_ok(
  $$ select public.update_plan_details((select id from t where name = 'plan'), 1, 'Overwrite', null) $$,
  'PT409', 'version_conflict', 'a title edit based on an old version is rejected');
select is(public.update_plan_details((select id from t where name = 'plan'), 5, ' Easter Sunday ', 'Main service'),
  6, 'a title edit based on the current version succeeds');
select is(public.update_plan_item_notes(
    (select id from public.plan_items where plan_id = (select id from t where name = 'plan') and position = 0), 6, 'Intro twice'),
  7, 'item notes can be saved');
select is(public.remove_plan_item((select id from public.plan_items where plan_id = (select id from t where name = 'plan') and position = 2)),
  8, 'a song can be removed without naming a version');
select is((select count(*)::int from public.plan_items where plan_id = (select id from t where name = 'plan')), 2,
  'the removed song is gone');

select throws_ok($$ update public.plans set owner_id = '00000000-0000-0000-0000-0000000000b2' where id = (select id from t where name = 'plan') $$,
  '42501', null, 'the owner cannot be changed');
reset role;

-- ---- Ben (another member) ----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.plans), 0, 'other members cannot see a private plan');
select is((select count(*)::int from public.plan_items), 0, 'other members cannot see its songs');
select throws_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001') $$,
  'PT404', 'plan_not_found', 'other members cannot add songs');
select throws_ok($$ insert into public.plan_items (plan_id, arrangement_id, position) values ((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001', 9) $$,
  '42501', null, 'other members cannot insert items directly');
select throws_ok($$ select public.duplicate_plan((select id from t where name = 'plan')) $$,
  'PT404', 'plan_not_found', 'other members cannot copy a plan they cannot see');
reset role;

-- ---- Ana: duplicate, archive -------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
update t set id = public.duplicate_plan((select id from t where name = 'plan')) where name = 'order';
select results_eq(
  $$ select title, status::text, version from public.plans where id = (select id from t where name = 'order') $$,
  $$ values ('Copy of Easter Sunday', 'draft', 1) $$, 'duplicating creates a new draft');
select results_eq(
  $$ select position, notes from public.plan_items where plan_id = (select id from t where name = 'order') order by position $$,
  $$ values (0, 'Intro twice'::text), (1, null) $$, 'the copy has the same songs, order and notes');

select lives_ok($$ select public.set_plan_status((select id from t where name = 'plan'), 'archived') $$, 'the owner can archive a plan');
select throws_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001') $$,
  'PT423', 'plan_archived', 'an archived plan cannot be edited');
reset role;

-- Archiving a song doesn't break plans that use it.
update public.music_pieces set status = 'archived' where id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.plan_items i join public.arrangements a on a.id = i.arrangement_id
    where i.plan_id = (select id from t where name = 'order')),
  2, 'plans still show songs that were archived later');
reset role;

-- ---- Inactive and anonymous -----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$ select public.create_plan('Nope') $$, '42501', null, 'inactive members cannot create plans');
reset role;

set local role anon;
select throws_ok($$ select * from public.plans $$, '42501', null, 'anonymous users have no plan access');
reset role;

select * from finish();
rollback;
