-- Bookable resources (courts / rooms). Schema + conflict constraint only.
--
-- NOT YET WIRED: nothing assigns resource_id, and slot generation does not yet
-- treat "every court busy" as "slot closed". That work is coupled to multi-staff
-- (parallel sessions are the case where courts actually contend) — do them
-- together. Until a booking carries a resource_id the exclusion constraint is
-- inert, so this migration changes no behaviour.

create extension if not exists btree_gist;

create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null default 'a0000000-0000-4000-8000-000000000001'
              references public.orgs (id) on delete restrict,
  location_id uuid not null references public.locations (id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index resources_location_idx on public.resources (location_id);

grant all on public.resources to anon, authenticated, service_role;
alter table public.resources enable row level security;
create policy resources_read on public.resources for select using (true);
create policy resources_manage on public.resources
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')));

alter table public.bookings
  add column resource_id uuid references public.resources (id) on delete set null;
alter table public.class_occurrences
  add column resource_id uuid references public.resources (id) on delete set null;

-- One confirmed thing per court per overlapping interval. Inert while
-- resource_id is null.
alter table public.bookings
  add constraint bookings_resource_no_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status = 'confirmed' and resource_id is not null);

alter table public.class_occurrences
  add constraint class_occ_resource_no_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status = 'scheduled' and resource_id is not null);
