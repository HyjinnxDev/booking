-- Reschedule: a booking can move to a new time in place (appointments only).
-- ics_sequence bumps on every move so calendar clients treat the re-sent .ics
-- as an update, not a duplicate.
alter table public.bookings add column ics_sequence int not null default 0;

-- The move itself runs through the service role after an ownership check
-- (same as booking creation), so no new client-facing grant or policy is needed.
