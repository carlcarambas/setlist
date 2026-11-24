-- Administrators list member devices and block them (spec 2.1 ACC-09). Run with `npm run test:db`.
begin;
select plan(7);

-- Ana and Ben: member devices. Quiet: a device that never changed anything. Eve: administrator.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-0000000007a1', null, true),
  ('00000000-0000-0000-0000-0000000007b2', null, true),
  ('00000000-0000-0000-0000-0000000007c3', null, true),
  ('00000000-0000-0000-0000-0000000007e5', 'eve@test.local', false);
update public.profiles set status = 'active', role = 'admin' where id = '00000000-0000-0000-0000-0000000007e5';
update public.profiles set display_name = 'Choir iPad' where id = '00000000-0000-0000-0000-0000000007a1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated","is_anonymous":true}', true);
select public.create_plan('Sunday');
select public.create_plan('Evening');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007b2","role":"authenticated","is_anonymous":true}', true);
select public.create_plan('Vandal');
select is((select count(*)::int from public.list_member_devices()), 0, 'members get no device list');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007e5","role":"authenticated"}', true);
select results_eq(
  $$ select display_name, change_count::int from public.list_member_devices() order by change_count desc $$,
  $$ values ('Choir iPad'::text, 2), (null::text, 1) $$,
  'administrators see devices that changed plans, with how many changes');
select is((select count(*)::int from public.list_member_devices() where id = '00000000-0000-0000-0000-0000000007c3'), 0,
  'devices that never changed anything are left out');
select is((select count(*)::int from public.list_member_devices() where id = '00000000-0000-0000-0000-0000000007e5'), 0,
  'administrators are not listed as devices');
select lives_ok($$ select public.set_member_status('00000000-0000-0000-0000-0000000007b2', 'inactive') $$,
  'an administrator can block a device');
select is((select status::text from public.list_member_devices() where id = '00000000-0000-0000-0000-0000000007b2'), 'inactive',
  'the blocked device stays listed, so it can be unblocked');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007b2","role":"authenticated","is_anonymous":true}', true);
select throws_ok($$ select public.create_plan('Again') $$, '42501', null, 'a blocked device can no longer change plans');
reset role;

select * from finish();
rollback;
