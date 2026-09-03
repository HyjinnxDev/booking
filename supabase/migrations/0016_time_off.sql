-- Review 2026-09-03 §3.3. Replace whole-day `blackout_dates` with `time_off`,
-- which holds an arbitrary [start, end) interval. A whole day is just
-- 00:00 -> next 00:00 in the business timezone. computeSlots already subtracts
-- arbitrary busy ranges, so slot generation just adds these rows to `busy`.

create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default 'a0000000-0000-4000-8000-000000000001'
             references public.orgs (id) on delete restrict,
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  check (start_at < end_at)
);
create index time_off_coach_start_idx on public.time_off (coach_id, start_at);

grant select, insert, update, delete on public.time_off to authenticated, service_role;
grant select on public.time_off to anon;
alter table public.time_off enable row level security;

create policy time_off_own on public.time_off
  for all using (coach_id = (select auth.uid()) or public.is_admin())
  with check (coach_id = (select auth.uid()) or public.is_admin());

-- Carry existing whole-day blackouts over. Each becomes local-midnight -> +1 day.
insert into public.time_off (org_id, coach_id, start_at, end_at, reason)
select b.org_id,
       b.coach_id,
       (b.date::text || ' 00:00')::timestamp at time zone 'Australia/Adelaide',
       ((b.date + 1)::text || ' 00:00')::timestamp at time zone 'Australia/Adelaide',
       b.reason
from public.blackout_dates b;

drop table public.blackout_dates;
