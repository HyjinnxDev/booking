-- Org-level booking behaviour, editable by an admin instead of code constants.
-- One row per org. src/lib/settings.ts falls back to src/lib/config.ts defaults.

create table public.settings (
  org_id              uuid primary key default 'a0000000-0000-4000-8000-000000000001'
                      references public.orgs (id) on delete cascade,
  brand               text,
  booking_window_days int not null default 60  check (booking_window_days between 1 and 365),
  min_notice_min      int not null default 120 check (min_notice_min between 0 and 10080),
  slot_step_min       int not null default 30  check (slot_step_min between 5 and 120),
  series_weeks        int not null default 12  check (series_weeks between 1 and 52),
  updated_at          timestamptz not null default now()
);

grant all on public.settings to anon, authenticated, service_role;
alter table public.settings enable row level security;
create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.settings (org_id) values ('a0000000-0000-4000-8000-000000000001');
