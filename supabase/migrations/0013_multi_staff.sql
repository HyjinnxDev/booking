-- Multi-staff: an org has several coaches, an admin manages them all.
-- Roles already exist (profiles.role admin|coach|client) and RLS already lets
-- is_admin() write every coach-owned table — this adds the two missing pieces.

-- Deactivate a coach without deleting their history / bookings.
alter table public.profiles add column active boolean not null default true;

-- Which locations a coach works at. Admin-assigned.
create table public.staff_locations (
  staff_id    uuid not null references public.profiles (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  org_id      uuid not null default 'a0000000-0000-4000-8000-000000000001'
              references public.orgs (id) on delete restrict,
  primary key (staff_id, location_id)
);
create index staff_locations_location_idx on public.staff_locations (location_id);

grant all on public.staff_locations to anon, authenticated, service_role;
alter table public.staff_locations enable row level security;

create policy staff_locations_read on public.staff_locations
  for select using (true);
create policy staff_locations_admin on public.staff_locations
  for all using (public.is_admin()) with check (public.is_admin());

-- Admins promote clients to coaches. Migration 0012 locked the profiles UPDATE
-- grant to (name, phone); re-open `role` so the admin session can change it.
-- lock_role() still reverts any change made by a non-admin, and
-- profiles_update_admin RLS still requires is_admin(), so a coach can't
-- self-promote. `active` toggles run through the service role (no trigger).
grant update (role) on public.profiles to authenticated;

-- Session-type "sameness" across coaches (for "any available coach") is matched
-- at read time on lower(trim(name)) + kind — no column yet.
