-- Multi-tenant seam. Every tenant-owned row carries org_id. v1 runs one org
-- (TechniCourt); a column default fills org_id so NO app code changes yet.
-- Going multi-tenant later = drop the defaults, set org_id from the request
-- context at insert time, and scope the RLS policies to current_org_id().

create table public.orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

grant all on public.orgs to anon, authenticated, service_role;
alter table public.orgs enable row level security;
create policy orgs_read on public.orgs for select using (true);

-- The one v1 org. Fixed id so the column defaults below can reference it.
insert into public.orgs (id, name, slug)
  values ('a0000000-0000-4000-8000-000000000001', 'TechniCourt', 'technicourt');

-- org_id everywhere, defaulted to the sole org. Postgres backfills existing rows
-- from the constant default as a metadata-only change, so this is fast and the
-- column is immediately NOT NULL-safe.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'availability', 'blackout_dates', 'bookings',
    'session_types', 'session_variants', 'class_occurrences'
  ]
  loop
    execute format(
      'alter table public.%I add column org_id uuid not null
         default ''a0000000-0000-4000-8000-000000000001''
         references public.orgs (id) on delete restrict',
      t);
    execute format('create index %I on public.%I (org_id)', t || '_org_idx', t);
  end loop;
end $$;

-- The caller's org, for RLS once tenancy is switched on. anon -> null.
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;
revoke all on function public.current_org_id() from public;
grant execute on function public.current_org_id() to anon, authenticated;

-- handle_new_user() is untouched: the profiles.org_id default covers new signups.
-- When signup becomes org-aware, resolve the org here and pass it explicitly.
