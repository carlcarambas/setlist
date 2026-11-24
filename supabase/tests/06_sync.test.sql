-- Offline sync (spec v2 §4.5, §8.2): pull_changes and tombstones. Run with `npm run test:db`.
begin;
select plan(16);

-- Ana: member device. Eve: administrator. Cy: blocked device.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000006a1', null, true),
  ('00000000-0000-0000-0000-0000000006c3', null, true),
  ('00000000-0000-0000-0000-0000000006e5', 'eve@test.local', false);
update public.profiles set status = 'active', role = 'admin' where id = '00000000-0000-0000-0000-0000000006e5';
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000006c3';

insert into public.music_pieces (id, title, status, created_by, updated_by) values
  ('10000000-0000-0000-0000-0000000000a1', 'Amazing Grace', 'active',
   '00000000-0000-0000-0000-0000000006e5', '00000000-0000-0000-0000-0000000006e5');
insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes, status, uploaded_by)
values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'Key of G',
   '10000000-0000-0000-0000-0000000000a1/20000000-0000-0000-0000-0000000000a1/a.pdf', 'a.pdf', 'application/pdf', 100, 'active',
   '00000000-0000-0000-0000-0000000006e5'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1', 'Pending upload',
   '10000000-0000-0000-0000-0000000000a1/20000000-0000-0000-0000-0000000000a2/b.pdf', 'b.pdf', 'application/pdf', 100, 'pending',
   '00000000-0000-0000-0000-0000000006e5');

create temporary table t (name text primary key, id uuid, at timestamptz) on commit drop;
grant select, insert, update on t to authenticated;
create temporary table snap (name text primary key, doc jsonb) on commit drop;
grant select, insert on snap to authenticated;

-- ---- Ana: first sync gets everything visible ---------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated","is_anonymous":true}', true);
insert into t (name, id) values ('plan', public.create_plan('Sunday'));
select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-0000000000a1');
insert into public.events (title, event_date) values ('Service', '2026-12-06');
insert into t (name, id) select 'event', id from public.events where title = 'Service';
insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'plan';

insert into snap values ('full', public.pull_changes(null));
select ok((select doc ? 'server_time' from snap where name = 'full'), 'the server time is returned for the next cursor');
select is((select jsonb_array_length(doc -> 'music_pieces') from snap where name = 'full'), 1, 'a first sync returns the songs');
select is((select jsonb_array_length(doc -> 'arrangements') from snap where name = 'full'), 1,
  'a first sync returns sheets but never pending uploads');
select is((select jsonb_array_length(doc -> 'plans') from snap where name = 'full'), 1, 'a first sync returns plans');
select is((select jsonb_array_length(doc -> 'plan_items') from snap where name = 'full'), 1, 'and their songs');
select is((select jsonb_array_length(doc -> 'events') from snap where name = 'full'), 1, 'and events');
select is((select jsonb_array_length(doc -> 'event_plans') from snap where name = 'full'), 1, 'and event links');
select ok((select jsonb_array_length(doc -> 'profiles') from snap where name = 'full') >= 3, 'and names');
select ok(not ((select doc -> 'profiles' -> 0 from snap where name = 'full') ? 'email'), 'profiles never include emails');
select is((select doc -> 'app_settings' ->> 'timezone' from snap where name = 'full'), 'Asia/Manila', 'and settings');
reset role;

-- Move everything into the past so the next pull's cursor sits between the old rows and new changes.
-- (Replica mode skips the updated_at triggers, which would otherwise stamp now() again.)
set local session_replication_role = replica;
update public.music_pieces set updated_at = now() - interval '1 hour';
update public.arrangements set updated_at = now() - interval '1 hour';
update public.plans set updated_at = now() - interval '1 hour';
update public.plan_items set updated_at = now() - interval '1 hour';
update public.events set updated_at = now() - interval '1 hour';
update public.event_plans set created_at = now() - interval '1 hour';
update public.profiles set updated_at = now() - interval '1 hour';
set local session_replication_role = origin;
insert into t (name, at) values ('cursor', now() - interval '30 minutes');

-- ---- Eve deletes the plan's song and the event; a delta pull sees exactly that ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006e5","role":"authenticated"}', true);
select public.remove_plan_item((select id from public.plan_items where plan_id = (select id from t where name = 'plan')));
delete from public.events where id = (select id from t where name = 'event');
reset role;
-- Tombstones are stamped with the transaction time; that's after the cursor, as in real use.

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated","is_anonymous":true}', true);
insert into snap values ('delta', public.pull_changes((select at from t where name = 'cursor')));
select is((select jsonb_array_length(doc -> 'music_pieces') from snap where name = 'delta'), 0, 'a delta skips unchanged songs');
select is((select jsonb_array_length(doc -> 'plans') from snap where name = 'delta'), 1, 'a delta returns the changed plan');
select results_eq(
  $$ select d ->> 'table' from snap, jsonb_array_elements(doc -> 'deleted') d where name = 'delta' order by 1 $$,
  $$ values ('event_plans'), ('events'), ('plan_items') $$,
  'deletions, including cascaded ones, arrive as tombstones');
select is((select jsonb_array_length(doc -> 'deleted') from snap where name = 'full'), 0, 'a first sync needs no tombstones');
reset role;

-- ---- Blocked device and no session -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c3","role":"authenticated","is_anonymous":true}', true);
select is((select jsonb_array_length(public.pull_changes(null) -> 'plans')), 0, 'a blocked device gets no plans');
reset role;

set local role anon;
select throws_ok($$ select public.pull_changes(null) $$, '42501', null, 'no session: pull_changes is not callable');
reset role;

select * from finish();
rollback;
