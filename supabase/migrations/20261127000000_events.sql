-- Milestone 5: events and event-plan associations (spec §4.4, plan §4.3 and P7).
--
-- Rules:
--   * Any active member can see and create events.
--   * Only the creator or an administrator can edit or delete an event.
--   * Deleting an event removes only its associations; plans are never deleted.
--   * A plan's owner or editors attach it to (or detach it from) events.
--   * An event shows only the plans the viewer can already see.
-- event_date is a calendar date interpreted in app_settings.timezone; the app computes "today" there.

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) between 1 and 200),
  description  text check (description is null or length(description) <= 2000),
  event_date   date not null,
  start_time   time,
  created_by   uuid not null references public.profiles (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index events_date on public.events (event_date);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_plans (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  plan_id     uuid not null references public.plans (id) on delete cascade,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (event_id, plan_id)
);
create index event_plans_plan on public.event_plans (plan_id);

alter table public.events enable row level security;
alter table public.event_plans enable row level security;

-- Grants: the client never chooses created_by; it defaults to the session user.
revoke all on public.events, public.event_plans from anon, authenticated;
grant select on public.events to authenticated;
grant insert (title, description, event_date, start_time) on public.events to authenticated;
grant update (title, description, event_date, start_time) on public.events to authenticated;
grant delete on public.events to authenticated;
grant select on public.event_plans to authenticated;
grant insert (event_id, plan_id, position) on public.event_plans to authenticated;
grant delete on public.event_plans to authenticated;
grant all on public.events, public.event_plans to service_role;

create policy "events: members read" on public.events for select to authenticated
  using ((select public.is_active_member()));
create policy "events: members create" on public.events for insert to authenticated
  with check ((select public.is_active_member()) and created_by = (select auth.uid()));
create policy "events: creator or admin edits" on public.events for update to authenticated
  using ((select public.is_active_member()) and (created_by = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_member()) and (created_by = (select auth.uid()) or (select public.is_admin())));
create policy "events: creator or admin deletes" on public.events for delete to authenticated
  using ((select public.is_active_member()) and (created_by = (select auth.uid()) or (select public.is_admin())));

create policy "event_plans: read if plan readable" on public.event_plans for select to authenticated
  using ((select public.can_view_plan(plan_id)));
create policy "event_plans: attach if plan editable" on public.event_plans for insert to authenticated
  with check (
    (select public.can_edit_plan(plan_id))
    and exists (select 1 from public.events e where e.id = event_id)
    and exists (select 1 from public.plans p where p.id = plan_id and p.status <> 'archived')
  );
create policy "event_plans: detach if plan editable" on public.event_plans for delete to authenticated
  using ((select public.can_edit_plan(plan_id)));
