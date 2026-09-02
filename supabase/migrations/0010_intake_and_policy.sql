-- Per-service intake questions + a cancel-cutoff policy + a no-show status.

alter table public.session_types
  add column intake_fields jsonb not null default '[]',
  add column cancel_cutoff_hours int not null default 0 check (cancel_cutoff_hours >= 0);

-- intake_fields shape: [{ "label": text, "type": "text"|"textarea"|"checkbox", "required": bool }]
-- bookings.intake shape: { "<label>": "<answer>" | true }
alter table public.bookings add column intake jsonb;

-- No-show is a third booking state, set by staff from the roster.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check check (status in ('confirmed', 'cancelled', 'no_show'));
