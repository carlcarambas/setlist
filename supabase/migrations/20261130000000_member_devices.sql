-- Milestone 10: administrators can see member devices and block misbehaving ones (spec 2.1 ACC-09).
-- Blocking itself is set_member_status(device, 'inactive') from Milestone 6.

-- Member devices with recent plan activity, most recent first. Administrators only.
create or replace function public.list_member_devices()
returns table (
  id uuid,
  display_name text,
  status public.member_status,
  created_at timestamptz,
  last_change_at timestamptz,
  change_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.status, p.created_at, max(a.created_at), count(a.id)
    from public.profiles p
    left join public.plan_activities a on a.user_id = p.id
   where public.is_admin() and p.is_anonymous
   group by p.id
  having count(a.id) > 0 or p.status = 'inactive'
   order by max(a.created_at) desc nulls last
   limit 200;
$$;
revoke execute on function public.list_member_devices() from public, anon;
grant execute on function public.list_member_devices() to authenticated;
