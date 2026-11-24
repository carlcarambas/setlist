-- Events and event-plan associations. Run with `npm run test:db`.
begin;
select plan(28);

-- Users: Ana (creator), Ben and Dee (members), Eve (admin), Cy (inactive).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'ana@test.local'),
  ('00000000-0000-0000-0000-0000000005b2', 'ben@test.local'),
  ('00000000-0000-0000-0000-0000000005c3', 'cy@test.local'),
  ('00000000-0000-0000-0000-0000000005d4', 'dee@test.local'),
  ('00000000-0000-0000-0000-0000000005e5', 'eve@test.local');
update public.profiles set status = 'active'
 where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005b2',
              '00000000-0000-0000-0000-0000000005d4', '00000000-0000-0000-0000-0000000005e5');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000005e5';
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000005c3';

create temporary table t (name text primary key, id uuid) on commit drop;
grant select, insert, update on t to authenticated;

-- ---- Ana: plans, shares and an event ----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
insert into t values ('private', public.create_plan('Private Plan'));
insert into t values ('shared', public.create_plan('Shared With Ben'));
insert into t values ('viewonly', public.create_plan('Viewable By Dee'));
insert into t values ('old', public.create_plan('Old Plan'));
select public.share_plan((select id from t where name = 'shared'), '00000000-0000-0000-0000-0000000005b2', 'editor');
select public.share_plan((select id from t where name = 'viewonly'), '00000000-0000-0000-0000-0000000005d4', 'viewer');
select public.set_plan_status((select id from t where name = 'old'), 'archived');

select lives_ok(
  $$ insert into public.events (title, event_date, start_time) values ('Sunday Service', '2026-12-06', '09:00') $$,
  'an active member can create an event');
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
     select e.id, p.id from t e, t p where e.name = 'event' and p.name in ('private', 'shared', 'viewonly') $$,
  'the plan owner can attach several plans to an event');
select throws_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'private' $$,
  '23505', null, 'a plan is attached to an event only once');
select lives_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'second' and p.name = 'private' $$,
  'a plan can belong to more than one event');
select throws_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'old' $$,
  '42501', null, 'archived plans cannot be attached');
reset role;

-- ---- Ben: editor of one plan ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005b2","role":"authenticated"}', true);
select is((select count(*)::int from public.events), 2, 'every active member sees every event');
select is((select count(*)::int from public.event_plans where event_id = (select id from t where name = 'event')), 1,
  'an event shows only the plans the viewer can see');

update public.events set title = 'Hijacked' where id = (select id from t where name = 'event');
delete from public.events where id = (select id from t where name = 'event');
select is((select title from public.events where id = (select id from t where name = 'event')), 'Sunday Service',
  'other members cannot edit or delete someone else''s event');

select lives_ok(
  $$ delete from public.event_plans where event_id = (select id from t where name = 'event')
       and plan_id = (select id from t where name = 'shared') $$,
  'a plan editor can detach the plan');
select lives_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'shared' $$,
  'a plan editor can attach the plan to any event');
insert into t values ('ben_plan', public.create_plan('Ben''s Plan'));
select lives_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'event' and p.name = 'ben_plan' $$,
  'members can attach their own plans to someone else''s event');
reset role;

-- ---- Dee: viewer of one plan ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005d4","role":"authenticated"}', true);
select results_eq(
  $$ select p.title from public.event_plans ep join public.plans p on p.id = ep.plan_id
      where ep.event_id = (select id from t where name = 'event') $$,
  $$ values ('Viewable By Dee') $$,
  'a viewer sees only the plans shared with them on the event');
select throws_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'second' and p.name = 'viewonly' $$,
  '42501', null, 'a plan viewer cannot attach it to an event');
select throws_ok(
  $$ insert into public.event_plans (event_id, plan_id) select e.id, p.id from t e, t p where e.name = 'second' and p.name = 'ben_plan' $$,
  '42501', null, 'members cannot attach plans they cannot see');
delete from public.event_plans where plan_id = (select id from t where name = 'viewonly');
reset role;

select is((select count(*)::int from public.event_plans where plan_id = (select id from t where name = 'viewonly')), 1,
  'a plan viewer cannot detach the plan');

-- ---- Eve: administrator ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005e5","role":"authenticated"}', true);
update public.events set title = 'Sunday Worship' where id = (select id from t where name = 'event');
select is((select title from public.events where id = (select id from t where name = 'event')), 'Sunday Worship',
  'an administrator can edit any event');
select lives_ok($$ delete from public.events where id = (select id from t where name = 'second') $$,
  'an administrator can delete any event');
reset role;

-- ---- Ana deletes her event ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
update public.events set start_time = null where id = (select id from t where name = 'event');
select is((select start_time from public.events where id = (select id from t where name = 'event')), null::time,
  'the creator can edit their event');
select lives_ok($$ delete from public.events where id = (select id from t where name = 'event') $$,
  'the creator can delete their event');
reset role;

select is((select count(*)::int from public.event_plans), 0, 'deleting an event removes its associations');
select is((select count(*)::int from public.plans where id in (select id from t)), 5,
  'deleting an event never deletes plans');

-- ---- Inactive member and anonymous -----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c3","role":"authenticated"}', true);
select throws_ok($$ insert into public.events (title, event_date) values ('Nope', '2026-12-06') $$,
  '42501', null, 'inactive members cannot create events');
reset role;

set local role anon;
select throws_ok($$ select * from public.events $$, '42501', null, 'anonymous users have no event access');
reset role;

select * from finish();
rollback;
