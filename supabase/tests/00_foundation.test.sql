-- Run with `npm run test:db` (needs `npm run db:start`).
begin;
select plan(4);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
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
select is_empty(
  $$ select * from public.app_settings $$,
  'anonymous users cannot read app_settings'
);

select * from finish();
rollback;
