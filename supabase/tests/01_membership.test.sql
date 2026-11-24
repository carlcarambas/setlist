-- Access model (spec v2 §3, §4.1, §10): anonymous member devices, invited administrators,
-- profiles and app_settings. Run with `npm run test:db`.
begin;
select plan(32);

-- Test users (created as postgres; the trigger makes their profiles).
--   a1 administrator, a2 second administrator, c1 invited administrator,
--   m1 / m2 anonymous member devices, s1 self-registered by email (never invited).
insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local',   '{"display_name":"Ada Admin"}', false),
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@test.local',  '{"display_name":"Al Admin"}',  false),
  ('00000000-0000-0000-0000-0000000000c1', 'invited@test.local', '{}',                           false),
  ('00000000-0000-0000-0000-0000000000e1', null,                 '{}',                           true),
  ('00000000-0000-0000-0000-0000000000e2', null,                 '{}',                           true),
  ('00000000-0000-0000-0000-0000000000f1', 'stranger@test.local','{}',                           false);

-- ---- trigger --------------------------------------------------------------
select results_eq(
  $$ select role::text, status::text, is_anonymous, display_name from public.profiles
      where id = '00000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('member', 'active', true, null::text) $$,
  'an anonymous device becomes an active member with no name');
select results_eq(
  $$ select role::text, status::text, is_anonymous from public.profiles
      where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('member', 'invited', false) $$,
  'an email sign-up starts as an invited member, never an administrator');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'invited', 'an email user''s name falls back to the email local part');

update auth.users set email = 'admin1@test.local' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select email from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'admin1@test.local', 'profile email follows auth email changes');

-- Invitations (server, secret key) make administrators.
update public.profiles set status = 'active', role = 'admin'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';

-- ---- no session -----------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'no session: profiles unreadable');
select throws_ok($$ select * from public.app_settings $$, '42501', null, 'no session: app_settings unreadable');
select throws_ok($$ select public.is_admin() $$, '42501', null, 'no session: is_admin() not callable');
reset role;

-- ---- anonymous member device ----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","is_anonymous":true}', true);

select ok(public.is_active_member(), 'an anonymous device is an active member');
select ok(not public.is_admin(), 'an anonymous device is not an administrator');
select is((select count(*)::int from public.app_settings), 1, 'a member device reads app_settings');
select ok((select count(*) from public.profiles) >= 5, 'a member device sees names and roles');
select throws_ok($$ select email from public.profiles $$, '42501', null, 'a member device cannot read emails');
select is((select count(*)::int from public.list_administrators()), 0, 'a member device gets no administrator list');

update public.profiles set display_name = 'Choir iPad' where id = (select auth.uid());
select is((select display_name from public.profiles where id = (select auth.uid())), 'Choir iPad',
  'a device can set its display name');
update public.profiles set display_name = null where id = (select auth.uid());
select is((select display_name from public.profiles where id = (select auth.uid())), null,
  'the display name is optional');
select throws_ok($$ update public.profiles set role = 'admin' where id = (select auth.uid()) $$,
  '42501', null, 'a device cannot make itself an administrator');
update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Ada Admin', 'a device cannot rename someone else');
update public.app_settings set church_name = 'Hacked';
select is((select church_name from public.app_settings), 'Music Ministry', 'a device cannot change app_settings');
select throws_ok($$ select public.set_member_status('00000000-0000-0000-0000-0000000000e2', 'inactive') $$,
  '42501', 'not_authorized', 'a device cannot block other devices');
reset role;

-- ---- invited administrator ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(not public.is_admin(), 'an invited administrator has no administrator rights yet');
select lives_ok($$ select public.complete_invitation('  Cara Choir  ') $$, 'the invitation can be completed');
select results_eq(
  $$ select display_name, status::text from public.profiles where id = (select auth.uid()) $$,
  $$ values ('Cara Choir', 'active') $$, 'completing sets the trimmed name and activates');
select ok(public.is_admin(), 'the invited administrator is now an administrator');
reset role;

-- ---- administrator ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select results_eq(
  $$ select email from public.list_administrators() where email like '%@test.local' order by email $$,
  $$ values ('admin1@test.local'), ('admin2@test.local'), ('invited@test.local') $$,
  'administrators see administrators'' emails, and only theirs');
select lives_ok($$ select public.set_member_status('00000000-0000-0000-0000-0000000000e2', 'inactive') $$,
  'an administrator can block a member device');
select lives_ok($$ select public.set_member_status('00000000-0000-0000-0000-0000000000a2', 'inactive') $$,
  'an administrator can deactivate another administrator');
select throws_ok($$ select public.set_member_status('00000000-0000-0000-0000-0000000000a1', 'inactive') $$,
  '42501', 'cannot_change_own_status', 'an administrator cannot deactivate themselves');
select throws_ok($$ update public.app_settings set updated_by = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'updated_by cannot be set by the client');
update public.app_settings set church_name = 'Grace Chapel';
select results_eq($$ select church_name, updated_by from public.app_settings $$,
  $$ values ('Grace Chapel', '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'an administrator updates settings; updated_by comes from the session');
reset role;

-- ---- blocked device and deactivated administrator ---------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated","is_anonymous":true}', true);
select ok(not public.is_active_member(), 'a blocked device is no longer a member');
select is((select count(*)::int from public.app_settings), 0, 'a blocked device loses access immediately');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select ok(not public.is_admin(), 'a deactivated administrator loses administrator rights immediately');
reset role;

select * from finish();
rollback;
