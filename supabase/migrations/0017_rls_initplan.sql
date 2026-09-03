-- Review 2026-09-03 §4.10 (initplan half). Wrap auth.uid() / is_admin() in a
-- scalar subquery so Postgres evaluates them once per statement instead of once
-- per row. Pure performance — every policy's logic is byte-for-byte the same.
--
-- The duplicate-permissive-policy merge (the other half of §4.10) is deferred:
-- it's a large rewrite for a perf-only advisor and correctness is unaffected.
-- ponytail: revisit if a table ever grows past a few thousand rows.

-- availability
drop policy availability_own on public.availability;
create policy availability_own on public.availability
  for all using (coach_id = (select auth.uid()) or (select public.is_admin()))
  with check (coach_id = (select auth.uid()) or (select public.is_admin()));

-- bookings
drop policy bookings_select_client on public.bookings;
create policy bookings_select_client on public.bookings
  for select using (client_id = (select auth.uid()));
drop policy bookings_select_coach on public.bookings;
create policy bookings_select_coach on public.bookings
  for select using (coach_id = (select auth.uid()));
drop policy bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings
  for select using ((select public.is_admin()));
drop policy bookings_update_admin on public.bookings;
create policy bookings_update_admin on public.bookings
  for update using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy bookings_delete_admin on public.bookings;
create policy bookings_delete_admin on public.bookings
  for delete using ((select public.is_admin()));

-- class_occurrences
drop policy class_occ_manage on public.class_occurrences;
create policy class_occ_manage on public.class_occurrences
  for all using (coach_id = (select auth.uid()) or (select public.is_admin()))
  with check (coach_id = (select auth.uid()) or (select public.is_admin()));

-- locations
drop policy locations_read on public.locations;
create policy locations_read on public.locations
  for select using (
    active or (select public.is_admin())
    or exists (select 1 from public.profiles
               where id = (select auth.uid()) and role in ('coach', 'admin')));
drop policy locations_manage on public.locations;
create policy locations_manage on public.locations
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- passes
drop policy passes_own on public.passes;
create policy passes_own on public.passes
  for select using (client_id = (select auth.uid()) or (select public.is_admin()));
drop policy passes_manage on public.passes;
create policy passes_manage on public.passes
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- profiles
drop policy profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));
drop policy profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using ((select public.is_admin()));
drop policy profiles_select_coach_clients on public.profiles;
create policy profiles_select_coach_clients on public.profiles
  for select using (exists (
    select 1 from public.bookings b
    where b.client_id = profiles.id and b.coach_id = (select auth.uid())));
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using ((select public.is_admin())) with check ((select public.is_admin()));

-- resources
drop policy resources_manage on public.resources;
create policy resources_manage on public.resources
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- session_types
drop policy session_types_read on public.session_types;
create policy session_types_read on public.session_types
  for select using (active or coach_id = (select auth.uid()) or (select public.is_admin()));
drop policy session_types_manage on public.session_types;
create policy session_types_manage on public.session_types
  for all using (coach_id = (select auth.uid()) or (select public.is_admin()))
  with check (coach_id = (select auth.uid()) or (select public.is_admin()));

-- session_variants
drop policy session_variants_manage on public.session_variants;
create policy session_variants_manage on public.session_variants
  for all using (exists (
      select 1 from public.session_types t
      where t.id = session_variants.session_type_id
        and (t.coach_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (
      select 1 from public.session_types t
      where t.id = session_variants.session_type_id
        and (t.coach_id = (select auth.uid()) or (select public.is_admin()))));

-- settings
drop policy settings_admin on public.settings;
create policy settings_admin on public.settings
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- staff_locations
drop policy staff_locations_admin on public.staff_locations;
create policy staff_locations_admin on public.staff_locations
  for all using ((select public.is_admin())) with check ((select public.is_admin()));

-- waitlist
drop policy waitlist_own on public.waitlist;
create policy waitlist_own on public.waitlist
  for all using (client_id = (select auth.uid()) or (select public.is_admin()))
  with check (client_id = (select auth.uid()) or (select public.is_admin()));
drop policy waitlist_coach_read on public.waitlist;
create policy waitlist_coach_read on public.waitlist
  for select using (exists (
    select 1 from public.class_occurrences o
    where o.id = waitlist.class_occurrence_id and o.coach_id = (select auth.uid())));
