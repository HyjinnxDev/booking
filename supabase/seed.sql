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
