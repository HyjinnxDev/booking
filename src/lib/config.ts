// Business config. All timestamps in the DB are UTC; these only affect display
// and slot generation.

export const BUSINESS_TZ = import.meta.env.PUBLIC_BUSINESS_TZ || 'Australia/Sydney';
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL || 'https://bookings.technicourt.com').replace(/\/$/, '');

// Grid granularity for appointment slots. A booked variant of duration D
// consumes ceil(D / SLOT_STEP_MIN) cells. Keep this the GCD of your offered
// appointment durations (30 covers 30/60/90).
export const SLOT_STEP_MIN = 30;

// ponytail: recurring classes are materialised this many weeks ahead when the
// coach schedules them — no RRULE, no auto top-up. They re-run the form to
// extend. Add a top-up cron only if long-running series become the norm.
export const SERIES_WEEKS = 12;

// How far ahead clients may book.
export const BOOKING_WINDOW_DAYS = 60;

export const ICS_DOMAIN = 'technicourt.com';
export const BRAND = 'TechniCourt';
