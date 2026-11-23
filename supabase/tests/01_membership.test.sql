-- Membership: profiles, helpers, app_settings RLS. Run with `npm run test:db`.
begin;
select plan(28);

-- Test users (created as postgres; the trigger makes their profiles).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local',    '{"display_name":"Ada Admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'member@test.local',   '{"display_name":"Ben Member"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'invited@test.local',  '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'inactive@test.local', '{"display_name":"Dee Inactive"}');

-- ---- trigger --------------------------------------------------------------
select results_eq(
  $$ select display_name, status::text from public.profiles
      where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('Ben Member', 'invited') $$,
  'new auth user gets an invited profile named from metadata'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'invited',
  'display name falls back to the email local part'
);

update auth.users set email = 'member2@test.local' where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select email from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'member2@test.local',
  'profile email follows auth email changes'
);

update public.profiles set status = 'active', role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set status = 'active'                 where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set status = 'inactive'               where id = '00000000-0000-0000-0000-0000000000d1';

create temporary table expected (profiles int) on commit drop;
grant select on expected to authenticated;
insert into expected select count(*) from public.profiles;

-- ---- anonymous ------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.app_settings $$, '42501', null, 'anon cannot read app_settings');
select throws_ok($$ select public.is_admin() $$, '42501', null, 'anon cannot call is_admin()');
reset role;

-- ---- invited user ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'invited user sees only their own profile');
select is((select count(*)::int from public.app_settings), 0, 'invited user cannot read app_settings');
select ok(not public.is_active_member(), 'invited user is not an active member');

select lives_ok($$ select public.complete_invitation('  Cara Choir  ') $$, 'invited user can complete the invitation');
select results_eq(
  $$ select display_name, status::text from public.profiles where id = (select auth.uid()) $$,
  $$ values ('Cara Choir', 'active') $$,
  'completing the invitation sets the trimmed name and activates'
);
select throws_ok($$ select public.complete_invitation('Again') $$, '42501', 'invitation_not_pending',
  'an invitation cannot be completed twice');
reset role;

-- ---- active member --------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), (select profiles from expected), 'active member sees the whole member directory');
select is((select count(*)::int from public.app_settings), 1, 'active member can read app_settings');

update public.profiles set display_name = 'Benjamin' where id = '00000000-0000-0000-0000-0000000000b1';
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'Benjamin', 'member can rename themselves');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'member cannot change their own role');
select throws_ok(
  $$ update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'member cannot change their own status');

update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Ada Admin', 'member cannot rename someone else');

update public.app_settings set church_name = 'Hacked';
select is((select church_name from public.app_settings), 'Music Ministry', 'member cannot change app_settings');

select throws_ok(
  $$ select public.set_member_status('00000000-0000-0000-0000-0000000000a1', 'inactive') $$,
  '42501', 'not_authorized', 'member cannot change member status');
reset role;

-- ---- inactive member ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'inactive member sees only their own profile');
select is((select count(*)::int from public.app_settings), 0, 'inactive member cannot read app_settings');
reset role;

-- ---- administrator --------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.set_member_status('00000000-0000-0000-0000-0000000000b1', 'inactive') $$,
  'admin can deactivate a member');
select is((select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'inactive', 'deactivation is recorded');
select throws_ok(
  $$ select public.set_member_status('00000000-0000-0000-0000-0000000000a1', 'inactive') $$,
  '42501', 'cannot_change_own_status', 'admin cannot deactivate themselves');

select throws_ok(
  $$ update public.app_settings set updated_by = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'updated_by cannot be set by the client');
update public.app_settings set church_name = 'Grace Chapel';
select results_eq(
  $$ select church_name, updated_by from public.app_settings $$,
  $$ values ('Grace Chapel', '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'admin can update settings; updated_by is stamped from the session');
reset role;

-- The deactivated member's still-valid session reads nothing from now on.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.app_settings), 0, 'deactivated member loses access immediately');
reset role;

select * from finish();
rollback;
