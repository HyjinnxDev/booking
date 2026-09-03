-- Review 2026-09-03 §1.1–1.3, §1.10–1.11, §2.2, §4.9, §4.11.
-- Close the gap between "rules enforced in app code" and "what RLS actually allows".
-- Every booking / catalog write the app makes goes through the service role;
-- the client-facing write policies below only ever served as a bypass.

-- ---------------------------------------------------------------------------
-- §1.1  Clients can't write bookings through the REST API
-- ---------------------------------------------------------------------------
drop policy if exists bookings_insert_client on public.bookings;
drop policy if exists bookings_cancel_own    on public.bookings;

revoke insert, update, delete on public.bookings from anon, authenticated;
revoke update (status)        on public.bookings from anon, authenticated;
-- SELECT policies (bookings_select_client / _coach / _admin) stay — /bookings reads via RLS.

-- ---------------------------------------------------------------------------
-- §1.2  locations / resources / passes are admin-only writes now
-- ---------------------------------------------------------------------------
drop policy if exists locations_manage on public.locations;
create policy locations_manage on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists resources_manage on public.resources;
create policy resources_manage on public.resources
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists passes_manage on public.passes;
create policy passes_manage on public.passes
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- §1.3  anon never writes anything; new tables inherit the revoke
-- ---------------------------------------------------------------------------
revoke insert, update, delete on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete on tables from anon;

-- ---------------------------------------------------------------------------
-- §1.10  check_class_capacity() is a trigger body, not an RPC
-- ---------------------------------------------------------------------------
revoke all on function public.check_class_capacity() from public, anon, authenticated;
-- rls_auto_enable() is a Supabase-managed event-trigger safety net (auto-enables
-- RLS on new public tables). It can't be reproduced in a migration (event
-- triggers need superuser); just stop exposing it as an RPC.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- §1.11  lock_role(): a null auth.uid() is the service role / SQL editor = trusted
-- ---------------------------------------------------------------------------
create or replace function public.lock_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;
revoke all on function public.lock_role() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- §2.2  Real overlap guard for coach appointments (per-variant durations mean
--       (coach_id, start_at) uniqueness is not enough).
-- ---------------------------------------------------------------------------
alter table public.bookings
  add constraint bookings_coach_no_overlap
  exclude using gist (
    coach_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status = 'confirmed' and class_occurrence_id is null);

drop index if exists public.bookings_no_double_booking;
-- Exclusion violations raise SQLSTATE 23P01 (not 23505) — app error handling updated to match.

-- ---------------------------------------------------------------------------
-- §4.11  Deleting a profile must not silently erase booking history
-- ---------------------------------------------------------------------------
alter table public.bookings
  drop constraint bookings_client_id_fkey,
  add  constraint bookings_client_id_fkey
       foreign key (client_id) references public.profiles (id) on delete restrict;
alter table public.bookings
  drop constraint bookings_coach_id_fkey,
  add  constraint bookings_coach_id_fkey
       foreign key (coach_id) references public.profiles (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- §3.11  Cancellation record — who / when / why
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column cancelled_at  timestamptz,
  add column cancelled_by  text check (cancelled_by in ('client', 'staff', 'system')),
  add column cancel_reason text;

-- ---------------------------------------------------------------------------
-- §4.9  Covering indexes the advisor flags for unindexed FKs
-- ---------------------------------------------------------------------------
create index if not exists bookings_pass_id_idx            on public.bookings (pass_id);
create index if not exists bookings_session_variant_id_idx on public.bookings (session_variant_id);
create index if not exists class_occ_variant_idx           on public.class_occurrences (session_variant_id);
create index if not exists passes_session_type_idx         on public.passes (session_type_id);
create index if not exists waitlist_client_idx             on public.waitlist (client_id);
