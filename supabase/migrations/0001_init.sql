-- TechniCourt bookings — initial schema, RLS, triggers.
-- All timestamps are UTC (timestamptz). Local time is display-only.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'client' check (role in ('admin', 'coach', 'client')),
  name       text not null default '',
  email      text not null default '',
  phone      text,
  cal_token  uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create unique index profiles_cal_token_idx on public.profiles (cal_token);

create table public.availability (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles (id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  check (start_time < end_time)
);
create index availability_coach_idx on public.availability (coach_id);

create table public.blackout_dates (
  id       uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  date     date not null,
  reason   text,
  unique (coach_id, date)
);
create index blackout_coach_idx on public.blackout_dates (coach_id);

create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles (id) on delete cascade,
  client_id   uuid not null references public.profiles (id) on delete cascade,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  status      text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  notes       text,
  reminded_at timestamptz,
  created_at  timestamptz not null default now()
);
create index bookings_coach_start_idx on public.bookings (coach_id, start_at);
create index bookings_client_idx on public.bookings (client_id);

-- Race-safe double-booking guard. Partial so a cancelled slot can be re-booked.
-- (Spec asked for UNIQUE(coach_id, start_at); scoped to confirmed rows so
-- cancellations don't permanently burn the slot. Concurrent confirmed inserts
-- still collide -> one gets SQLSTATE 23505.)
create unique index bookings_no_double_booking
  on public.bookings (coach_id, start_at)
  where status = 'confirmed';

-- ---------------------------------------------------------------------------
-- Helpers (security definer -> bypass RLS, avoid recursion in profile policies)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, email)
  values (new.id, 'client', coalesce(new.raw_user_meta_data ->> 'name', ''), coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only an admin may change a role. Non-admins silently keep their existing role.
create or replace function public.lock_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_lock_role
  before update on public.profiles
  for each row execute function public.lock_role();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter table public.profiles       enable row level security;
alter table public.availability   enable row level security;
alter table public.blackout_dates enable row level security;
alter table public.bookings       enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

-- a coach may read the profile of any client who has a booking with them
create policy profiles_select_coach_clients on public.profiles
  for select using (
    exists (
      select 1 from public.bookings b
      where b.client_id = profiles.id and b.coach_id = auth.uid()
    )
  );

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- availability ------------------------------------------------------------
-- Slot computation reads this via the service role; RLS only needs to cover
-- a coach managing their own rules.
create policy availability_own on public.availability
  for all using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());

-- blackout_dates ---------------------------------------------------------
create policy blackout_own on public.blackout_dates
  for all using (coach_id = auth.uid() or public.is_admin())
  with check (coach_id = auth.uid() or public.is_admin());

-- bookings --------------------------------------------------------------
create policy bookings_select_client on public.bookings
  for select using (client_id = auth.uid());

create policy bookings_select_coach on public.bookings
  for select using (coach_id = auth.uid());

create policy bookings_select_admin on public.bookings
  for select using (public.is_admin());

create policy bookings_insert_client on public.bookings
  for insert with check (client_id = auth.uid() and status = 'confirmed');

-- a client may only move their own booking to 'cancelled'
create policy bookings_cancel_own on public.bookings
  for update using (client_id = auth.uid() and status = 'confirmed')
  with check (client_id = auth.uid() and status = 'cancelled');

create policy bookings_update_admin on public.bookings
  for update using (public.is_admin()) with check (public.is_admin());

create policy bookings_delete_admin on public.bookings
  for delete using (public.is_admin());

-- Clients can touch only the status column (so they can't move start_at etc.)
revoke update on public.bookings from anon, authenticated;
grant update (status) on public.bookings to authenticated;
