-- Events (spec v2 §4.4): every member device views, creates, edits and attaches; only administrators
-- delete; deleting an event keeps its plans. Run with `npm run test:db`.
begin;
select plan(24);

-- Ana and Ben: member devices. Eve: administrator. Cy: blocked device.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000005a1', null, true),
  ('00000000-0000-0000-0000-0000000005b2', null, true),
  ('00000000-0000-0000-0000-0000000005c3', null, true),
  ('00000000-0000-0000-0000-0000000005e5', 'eve@test.local', false);
update public.profiles set status = 'active', role = 'admin' where id = '00000000-0000-0000-0000-0000000005e5';
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000005c3';

create temporary table t (name text primary key, id uuid) on commit drop;
grant select, insert, update on t to authenticated;

-- ---- Ana: plans and an event ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated","is_anonymous":true}', true);
insert into t values ('plan_a', public.create_plan('Morning Set'));
insert into t values ('plan_b', public.create_plan('Evening Set'));
insert into t values ('old', public.create_plan('Old Plan'));
select public.set_plan_status((select id from t where name = 'old'), 'archived');

select lives_ok(
  $$ insert into public.events (title, event_date, start_time) values ('Sunday Service', '2026-12-06', '09:00') $$,
  'a member can create an event');
insert into t select 'event', id from public.events where title = 'Sunday Service';
select is((select created_by from public.events where id = (select id from t where name = 'event')),
  '00000000-0000-0000-0000-0000000005a1'::uuid, 'the creator is recorded from the session');
select throws_ok(
  $$ insert into public.events (title, event_date, created_by) values ('Spoofed', '2026-12-06', '00000000-0000-0000-0000-0000000005b2') $$,
  '42501', null, 'created_by cannot be supplied by the client');
select throws_ok($$ insert into public.events (title, event_date) values ('   ', '2026-12-06') $$,
  '23514', null, 'an event needs a title');
select throws_ok($$ insert into public.events (title) values ('No date') $$,
  '23502', null, 'an event needs a date');
select lives_ok($$ insert into public.events (title, event_date) values ('Christmas Eve', '2026-12-24') $$,
  'the start time is optional');
insert into t select 'second', id from public.events where title = 'Christmas Eve';

select lives_ok(
  $$ insert into public.event_plans (event_id, plan_id)
     select e.id, p.id from t e, t p where e.name = 'event' and p.name in ('plan_a', 'plan_b') $$,
  'an event can have several plans');
select throws_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'plan_a' $$,
  '23505', null, 'a plan is attached to an event only once');
select lives_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'second' and p.name = 'plan_a' $$,
  'a plan can belong to more than one event');
select throws_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'old' $$,
  '42501', null, 'archived plans cannot be attached');
reset role;

-- ---- Ben: another member device -----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005b2","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.events), 2, 'every member sees every event');
select is((select count(*)::int from public.event_plans where event_id = (select id from t where name = 'event')), 2,
  'every member sees every plan of an event');
update public.events set title = 'Sunday Worship' where id = (select id from t where name = 'event');
select is((select title from public.events where id = (select id from t where name = 'event')), 'Sunday Worship',
  'any member can edit an event');
select lives_ok(
  $$ delete from public.event_plans where event_id = (select id from t where name = 'event')
       and plan_id = (select id from t where name = 'plan_b') $$,
  'any member can detach a plan');
select lives_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'plan_b' $$,
  'any member can attach a plan');
delete from public.events where id = (select id from t where name = 'event');
select is((select count(*)::int from public.events where id = (select id from t where name = 'event')), 1,
  'members cannot delete events');
reset role;

-- ---- Eve: administrator deletes ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005e5","role":"authenticated"}', true);
select lives_ok($$ delete from public.events where id = (select id from t where name = 'event') $$,
  'an administrator can delete an event');
select is((select count(*)::int from public.events where id = (select id from t where name = 'event')), 0,
  'the event is gone');
reset role;

select is((select count(*)::int from public.event_plans where event_id = (select id from t where name = 'event')), 0,
  'deleting an event removes its associations');
select is((select count(*)::int from public.event_plans where event_id = (select id from t where name = 'second')), 1,
  'other events keep theirs');
select is((select count(*)::int from public.plans where id in (select id from t)), 3,
  'deleting an event never deletes plans');

-- ---- Blocked device and no session --------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c3","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::int from public.events), 0, 'a blocked device sees no events');
select throws_ok($$ insert into public.events (title, event_date) values ('Nope', '2026-12-06') $$,
  '42501', null, 'a blocked device cannot create events');
reset role;

set local role anon;
select throws_ok($$ select * from public.events $$, '42501', null, 'no session: no event access');
reset role;

select * from finish();
rollback;
