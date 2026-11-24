-- Local development seed data. Runs after migrations on `npm run db:reset`.
-- Test accounts only; never put real member data here.
--
-- Local sign-in accounts (password for all: setlist-local-dev):
--   admin@setlist.test    active administrator
--   invited@setlist.test  invited administrator, hasn't finished joining
-- Members don't have accounts (spec v2): each browser becomes an anonymous member device.

create or replace function pg_temp.seed_user(p_email text, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('setlist-local-dev', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  return v_id;
end;
$$;

do $$
declare
  v_admin   uuid := pg_temp.seed_user('admin@setlist.test', 'Local Admin');
  v_invited uuid := pg_temp.seed_user('invited@setlist.test', 'Invited Person');
begin
  update public.profiles set role = 'admin', status = 'active' where id = v_admin;
  update public.profiles set role = 'admin' where id = v_invited;
end;
$$;
