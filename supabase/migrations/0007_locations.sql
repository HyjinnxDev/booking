-- Locations / venues. A session type happens at one location. v1 seeds a single
-- location and defaults session_types.location_id to it, so nothing changes
-- until a second location is added.
--
-- locations.timezone exists for later: slot generation still uses the global
-- PUBLIC_BUSINESS_TZ. Wire per-location tz through slots.ts when a location in a
-- different zone actually exists.

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default 'a0000000-0000-4000-8000-000000000001'
             references public.orgs (id) on delete restrict,
  name       text not null,
  address    text,
  timezone   text not null default 'Australia/Adelaide',
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index locations_org_idx on public.locations (org_id);

grant all on public.locations to anon, authenticated, service_role;
alter table public.locations enable row level security;

create policy locations_read on public.locations
  for select using (active or public.is_admin()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')));

create policy locations_manage on public.locations
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')))
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')));

insert into public.locations (id, name)
  values ('b0000000-0000-4000-8000-000000000001', 'TechniCourt');

alter table public.session_types
  add column location_id uuid not null
    default 'b0000000-0000-4000-8000-000000000001'
    references public.locations (id) on delete restrict;
create index session_types_location_idx on public.session_types (location_id);
