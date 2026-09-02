-- Run AFTER the coach has signed up through the app (so auth.users + profile exist).
-- Replace the email, then run in the Supabase SQL editor.

-- 1. Promote the coach
update public.profiles
set role = 'coach',
    name = 'Head Coach',
    phone = null
where email = 'coach@technicourt.com';

-- 2. Weekly availability — Mon–Fri 09:00–17:00, Sat 08:00–12:00 (business-local)
insert into public.availability (coach_id, weekday, start_time, end_time)
select p.id, wd, '09:00', '17:00'
from public.profiles p, generate_series(1, 5) as wd
where p.role = 'coach'
on conflict do nothing;

insert into public.availability (coach_id, weekday, start_time, end_time)
select p.id, 6, '08:00', '12:00'
from public.profiles p
where p.role = 'coach'
on conflict do nothing;

-- 3. Example session types (safe to skip / edit in /coach/services)
with c as (select id from public.profiles where role = 'coach' order by created_at limit 1),
priv as (
  insert into public.session_types (coach_id, name, blurb, kind, sort)
  select id, 'Private lesson', 'One-on-one coaching.', 'appointment', 0 from c
  returning id
),
cardio as (
  insert into public.session_types (coach_id, name, blurb, kind, sort)
  select id, 'Cardio Tennis', 'High-energy group workout, all levels.', 'class', 1 from c
  returning id
)
insert into public.session_variants (session_type_id, name, duration_min, price_cents, capacity, sort)
select id, '30 min', 30, 4000, 1, 0 from priv
union all select id, '60 min', 60, 7000, 1, 1 from priv
union all select id, 'Session', 60, 2200, 8, 0 from cardio;
