-- Run with `npm run test:db` (needs `npm run db:start`).
begin;
select plan(7);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

-- Visitors without a session (role anon) get nothing directly (spec 2.1 §10).
select is_empty(
  $$ select table_name from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public' $$,
  'anon has no privileges on any table in public'
);
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute any function in public'
);
select is(
  (select public from storage.buckets where id = 'music-sheets'),
  false,
  'the sheet bucket is private'
);

select is(
  (select count(*)::int from public.app_settings),
  1,
  'app_settings has exactly one row'
);

select throws_ok(
  $$ insert into public.app_settings (id) values (false) $$,
  '23514',
  null,
  'a second settings row is rejected'
);

set local role anon;
select throws_ok(
  $$ select * from public.app_settings $$,
  '42501',
  null,
  'anonymous users have no privileges on app_settings'
);

select * from finish();
rollback;
