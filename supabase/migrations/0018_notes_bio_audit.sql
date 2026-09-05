-- Three independent additions, bundled because they're all small:
--  1. client_notes  — a shared, chronological note thread staff keep on a
--     client (skill level, injuries, preferences). Not scoped to "their own"
--     clients, since a client often sees more than one coach.
--  2. profiles.bio   — a coach's own short bio, self-edited.
--  3. audit_log      — who did what, for the admin-only actions that matter
--     (staff changes, settings, locations, broadcasts). Not every write path;
--     add more call sites if this proves useful.

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'));
$$;

-- ---------------------------------------------------------------------------
create table public.client_notes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default 'a0000000-0000-4000-8000-000000000001'
             references public.orgs (id) on delete restrict,
  client_id  uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

grant select, insert, delete on public.client_notes to authenticated, service_role;
alter table public.client_notes enable row level security;

create policy client_notes_staff_read on public.client_notes
  for select using ((select public.is_staff()));
create policy client_notes_staff_insert on public.client_notes
  for insert with check ((select public.is_staff()));
create policy client_notes_admin_delete on public.client_notes
  for delete using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
alter table public.profiles add column bio text;
grant update (bio) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default 'a0000000-0000-4000-8000-000000000001'
             references public.orgs (id) on delete restrict,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

grant select, insert on public.audit_log to authenticated, service_role;
alter table public.audit_log enable row level security;

create policy audit_log_admin_read on public.audit_log
  for select using ((select public.is_admin()));
create policy audit_log_admin_insert on public.audit_log
  for insert with check ((select public.is_admin()));
