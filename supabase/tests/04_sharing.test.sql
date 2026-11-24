-- Sharing: member shares (viewer/editor), public links. Run with `npm run test:db`.
begin;
select plan(45);

-- Users: Ana (owner), Ben and Dee (members), Cy (inactive).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'ben@test.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'cy@test.local'),
  ('00000000-0000-0000-0000-0000000000d4', 'dee@test.local');
update public.profiles set status = 'active'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2',
              '00000000-0000-0000-0000-0000000000d4');
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000000c3';

-- Library: two songs; only the first is used in the plan.
insert into public.music_pieces (id, title, status, created_by, updated_by) values
  ('10000000-0000-0000-0000-000000000001', 'Amazing Grace', 'active',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000002', 'Unrelated Song', 'active',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1');
insert into public.arrangements (id, music_piece_id, title, storage_path, original_filename, mime_type, file_size_bytes, status, uploaded_by)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Key of G',
   '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/a.pdf', 'grace.pdf', 'application/pdf', 100, 'active',
   '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Key of D',
   '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/b.pdf', 'other.pdf', 'application/pdf', 100, 'active',
   '00000000-0000-0000-0000-0000000000a1');

create temporary table t (name text primary key, id uuid) on commit drop;
grant select, insert, update on t to authenticated;

-- ---- Ana creates a plan and shares it with Ben as a viewer ------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into t values ('plan', public.create_plan('Sunday Service'));
insert into t values ('other', public.create_plan('Private Plan'));
select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001');

select lives_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000b2', 'viewer') $$,
  'the owner can share with a member as viewer');
select throws_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000a1', 'editor') $$,
  'PT422', 'member_unavailable', 'the owner cannot share with themselves');
select throws_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000c3', 'viewer') $$,
  'PT422', 'member_unavailable', 'plans cannot be shared with inactive members');
select throws_ok($$ insert into public.plan_shares (plan_id, user_id, permission) values ((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000d4', 'editor') $$,
  '42501', null, 'shares cannot be inserted directly');
reset role;

-- ---- Ben as viewer ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select results_eq($$ select title from public.plans $$, $$ values ('Sunday Service') $$,
  'a viewer sees the shared plan and not the owner''s other plans');
select is((select count(*)::int from public.plan_items), 1, 'a viewer sees the plan''s songs');
select is(public.can_edit_plan((select id from t where name = 'plan')), false, 'a viewer cannot edit');
select throws_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001') $$,
  'PT403', 'not_allowed', 'a viewer cannot add songs');
select throws_ok($$ select public.update_plan_details((select id from t where name = 'plan'), 2, 'Hijack', null) $$,
  'PT403', 'not_allowed', 'a viewer cannot rename the plan');
select is((select count(*)::int from public.plan_items where notes is not null), 0, 'nothing changed');
select throws_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000d4', 'viewer') $$,
  'PT403', 'not_allowed', 'a viewer cannot share the plan');
select throws_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000b2', 'editor') $$,
  'PT403', 'not_allowed', 'a viewer cannot raise their own permission');
select is((select count(*)::int from public.plan_shares where user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
  'a recipient sees their own share');
reset role;

-- ---- Ana makes Ben an editor and adds Dee as viewer ------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000b2', 'editor'),
  (select id from public.plan_shares where user_id = '00000000-0000-0000-0000-0000000000b2'),
  'changing permission updates the existing share');
select lives_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000d4', 'viewer') $$,
  'the owner can share with a second member');
select is((select count(*)::int from public.plan_shares), 2, 'the owner sees every share of the plan');
reset role;

-- ---- Ben as editor ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000002') $$,
  'an editor can add songs');
select lives_ok($$ select public.update_plan_details((select id from t where name = 'plan'),
    (select version from public.plans where id = (select id from t where name = 'plan')), 'Sunday Service (edited)', null) $$,
  'an editor can rename the plan');
select throws_ok($$ select public.set_plan_status((select id from t where name = 'plan'), 'archived') $$,
  '42501', 'only_owner_can_archive', 'an editor cannot archive the plan');
select throws_ok($$ select public.share_plan((select id from t where name = 'plan'), '00000000-0000-0000-0000-0000000000c3', 'viewer') $$,
  'PT403', 'not_allowed', 'an editor cannot manage shares');
select throws_ok($$ select public.create_plan_link((select id from t where name = 'plan'), repeat('a', 64)) $$,
  'PT403', 'not_allowed', 'an editor cannot create public links');
select is((select count(*)::int from public.plan_shares), 1, 'an editor sees only their own share, not the others');
reset role;

-- ---- Ana: revoke, duplicate -------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ select public.revoke_plan_share((select id from public.plan_shares where user_id = '00000000-0000-0000-0000-0000000000b2')) $$,
  'the owner can revoke a member''s access');
select results_eq(
  $$ select action from public.plan_activities where plan_id = (select id from t where name = 'plan')
       and action like 'share%' order by action $$,
  $$ values ('share_changed'), ('share_granted'), ('share_granted'), ('share_revoked') $$,
  'sharing changes are recorded');
insert into t values ('copy', public.duplicate_plan((select id from t where name = 'plan')));
select is((select count(*)::int from public.plan_shares where plan_id = (select id from t where name = 'copy')), 0,
  'duplicating a plan does not copy its shares');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select count(*)::int from public.plans), 0, 'after revocation the member no longer sees the plan');
select throws_ok($$ select public.add_plan_item((select id from t where name = 'plan'), '20000000-0000-0000-0000-000000000001') $$,
  'PT404', 'plan_not_found', 'after revocation the member cannot edit');
select throws_ok($$ select public.revoke_plan_share((select id from public.plan_shares limit 1)) $$,
  'PT404', 'share_not_found', 'a non-owner cannot revoke shares');
reset role;

-- ---- Public links -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into t values ('link', public.create_plan_link((select id from t where name = 'plan'), encode(sha256('token-1'), 'hex')));
select throws_ok($$ select public.create_plan_link((select id from t where name = 'plan'), encode(sha256('token-x'), 'hex'), now() - interval '1 minute') $$,
  'PT422', 'invalid_expiry', 'a link cannot expire in the past');
select is((select count(*)::int from public.plan_links), 1, 'the owner sees their links');
select throws_ok($$ select token_hash from public.plan_links $$, '42501', null, 'the token hash is never readable');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select is((select count(*)::int from public.plan_links), 0, 'a viewer cannot see the plan''s links');
select throws_ok($$ select public.get_shared_plan(encode(sha256('token-1'), 'hex')) $$,
  '42501', null, 'signed-in users cannot call link resolution');
reset role;

set local role anon;
select throws_ok($$ select * from public.plan_shares $$, '42501', null, 'anonymous users cannot read shares');
select throws_ok($$ select id from public.plan_links $$, '42501', null, 'anonymous users cannot read links');
select throws_ok($$ select public.get_shared_plan(encode(sha256('token-1'), 'hex')) $$,
  '42501', null, 'anonymous users cannot call link resolution');
reset role;

-- The server resolves links with the secret key (service_role).
set local role service_role;
select results_eq(
  $$ select x->>'title', jsonb_array_length(x->'items'), x ? 'owner_id'
       from public.get_shared_plan(encode(sha256('token-1'), 'hex')) x $$,
  $$ values ('Sunday Service (edited)', 2, false) $$,
  'a valid link returns the plan and its songs, without people''s ids');
select is((select storage_path from public.shared_plan_sheet(encode(sha256('token-1'), 'hex'), '20000000-0000-0000-0000-000000000001')),
  '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/a.pdf',
  'a valid link opens a sheet the plan uses');
select is(public.get_shared_plan(encode(sha256('wrong-token'), 'hex')), null, 'an unknown token returns nothing');
reset role;

-- Remove the second song: its sheet is no longer reachable through the link.
delete from public.plan_items where arrangement_id = '20000000-0000-0000-0000-000000000002';
set local role service_role;
select is((select count(*)::int from public.shared_plan_sheet(encode(sha256('token-1'), 'hex'), '20000000-0000-0000-0000-000000000002')), 0,
  'a link cannot open sheets the plan does not use');
reset role;

-- Expired, revoked, archived and inactive-owner links all fail.
insert into public.plan_links (plan_id, token_hash, expires_at, created_by)
values ((select id from t where name = 'plan'), encode(sha256('token-expired'), 'hex'), now() - interval '1 second',
        '00000000-0000-0000-0000-0000000000a1');
insert into public.plan_links (plan_id, token_hash, created_by)
values ((select id from t where name = 'other'), encode(sha256('token-other'), 'hex'), '00000000-0000-0000-0000-0000000000a1');

set local role service_role;
select is(public.get_shared_plan(encode(sha256('token-expired'), 'hex')), null, 'an expired link fails');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.revoke_plan_link((select id from t where name = 'link'));
select public.set_plan_status((select id from t where name = 'other'), 'archived');
reset role;

set local role service_role;
select is(public.get_shared_plan(encode(sha256('token-1'), 'hex')), null, 'a revoked link fails');
select is(public.get_shared_plan(encode(sha256('token-other'), 'hex')), null, 'a link to an archived plan fails');
reset role;

update public.plans set status = 'draft' where id = (select id from t where name = 'other');
update public.profiles set status = 'inactive' where id = '00000000-0000-0000-0000-0000000000a1';
set local role service_role;
select is(public.get_shared_plan(encode(sha256('token-other'), 'hex')), null, 'links stop working when the owner is deactivated');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select is((select count(*)::int from public.plans), 1, 'member shares keep working when the owner is deactivated');
reset role;

select * from finish();
rollback;
