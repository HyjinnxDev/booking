-- Class waitlist. Join a full class occurrence; when a seat frees (an attendee
-- cancels), every unnotified waitlister is emailed a booking link. First to book
-- wins — the capacity trigger settles the race. No hold / claim window yet.

create table public.waitlist (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null default 'a0000000-0000-4000-8000-000000000001'
                     references public.orgs (id) on delete restrict,
  class_occurrence_id uuid not null references public.class_occurrences (id) on delete cascade,
  client_id          uuid not null references public.profiles (id) on delete cascade,
  created_at         timestamptz not null default now(),
  notified_at        timestamptz
);
create unique index waitlist_one_per_client on public.waitlist (class_occurrence_id, client_id);
create index waitlist_occ_idx on public.waitlist (class_occurrence_id);

grant all on public.waitlist to anon, authenticated, service_role;
alter table public.waitlist enable row level security;

create policy waitlist_own on public.waitlist
  for all using (client_id = auth.uid() or public.is_admin())
  with check (client_id = auth.uid() or public.is_admin());

create policy waitlist_coach_read on public.waitlist
  for select using (exists (
    select 1 from public.class_occurrences o
    where o.id = class_occurrence_id and o.coach_id = auth.uid()));
