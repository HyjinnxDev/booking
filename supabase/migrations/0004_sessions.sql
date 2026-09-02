-- Multiple session types.
--   kind='appointment' -> 1:1, client picks any open time; variant = duration + price
--   kind='class'       -> coach schedules dated occurrences with a seat count
-- All timestamps UTC (timestamptz). Local time is display-only.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.session_types (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  blurb      text,
  kind       text not null check (kind in ('appointment', 'class')),
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index session_types_coach_idx on public.session_types (coach_id);

-- The row that actually gets booked. An appointment type has one row per
-- offered length (30 min, 60 min); a class type has exactly one.
create table public.session_variants (
  id              uuid primary key default gen_random_uuid(),
  session_type_id uuid not null references public.session_types (id) on delete cascade,
  name            text not null,
  duration_min    int  not null check (duration_min between 5 and 480),
  price_cents     int  not null default 0 check (price_cents >= 0),   -- 0 = free
  capacity        int  not null default 1 check (capacity >= 1),      -- 1 for appts
  active          boolean not null default true,
  sort            int not null default 0
);
create index session_variants_type_idx on public.session_variants (session_type_id);

-- Concrete dated class sessions. Recurring = many rows sharing a series_id
-- (materialised up front, topped up by cron). No RRULE engine.
create table public.class_occurrences (
  id                 uuid primary key default gen_random_uuid(),
  session_variant_id uuid not null references public.session_variants (id) on delete cascade,
  coach_id           uuid not null references public.profiles (id) on delete cascade,
  start_at           timestamptz not null,
  end_at             timestamptz not null,
  capacity           int  not null check (capacity >= 1),
  series_id          uuid,
  status             text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at         timestamptz not null default now(),
  check (start_at < end_at)
);
create index class_occ_coach_start_idx on public.class_occurrences (coach_id, start_at);
create index class_occ_series_idx on public.class_occurrences (series_id);

-- ---------------------------------------------------------------------------
-- bookings: what was booked + payment flag
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column session_variant_id  uuid references public.session_variants (id),
  add column class_occurrence_id uuid references public.class_occurrences (id) on delete cascade,
  add column price_cents         int  not null default 0,
  add column payment_status      text not null default 'unpaid'
    check (payment_status in ('free', 'unpaid', 'paid'));
create index bookings_class_occ_idx on public.bookings (class_occurrence_id);

-- The double-booking guard only applies to appointments now (classes are seat-limited).
drop index if exists public.bookings_no_double_booking;
create unique index bookings_no_double_booking
  on public.bookings (coach_id, start_at)
  where status = 'confirmed' and class_occurrence_id is null;

-- One seat per client per class.
create unique index bookings_one_seat_per_class
  on public.bookings (class_occurrence_id, client_id)
  where status = 'confirmed' and class_occurrence_id is not null;

-- Seat limit: lock the occurrence row, count confirmed seats, reject if full.
-- ponytail: row lock is the concurrency ceiling — fine for one club. If this
-- ever contends, move to an advisory lock or a seats-taken counter column.
create or replace function public.check_class_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cap   int;
  taken int;
begin
  if new.class_occurrence_id is null or new.status <> 'confirmed' then
    return new;
  end if;
  select capacity into cap from public.class_occurrences
    where id = new.class_occurrence_id and status = 'scheduled' for update;
  if cap is null then
    raise exception 'class occurrence % is not open', new.class_occurrence_id;
  end if;
  select count(*) into taken from public.bookings
    where class_occurrence_id = new.class_occurrence_id and status = 'confirmed';
  if taken >= cap then
    raise exception 'class is full' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger bookings_class_capacity
  before insert on public.bookings
  for each row execute function public.check_class_capacity();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant all on public.session_types, public.session_variants, public.class_occurrences
  to anon, authenticated, service_role;

alter table public.session_types     enable row level security;
alter table public.session_variants  enable row level security;
alter table public.class_occurrences enable row level security;

-- Catalog is world-readable (prices are public anyway); staff manage their own.
create policy session_types_read on public.session_types
  for select using (active or coach_id = auth.uid() or public.is_admin());
create policy session_types_manage on public.session_types
  for all using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());

create policy session_variants_read on public.session_variants
  for select using (true);
create policy session_variants_manage on public.session_variants
  for all using (exists (
      select 1 from public.session_types t
      where t.id = session_type_id and (t.coach_id = auth.uid() or public.is_admin())))
  with check (exists (
      select 1 from public.session_types t
      where t.id = session_type_id and (t.coach_id = auth.uid() or public.is_admin())));

create policy class_occ_read on public.class_occurrences
  for select using (true);
create policy class_occ_manage on public.class_occurrences
  for all using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());
