// Business config. All timestamps in the DB are UTC; these only affect display
// and slot generation.

export const BUSINESS_TZ = import.meta.env.PUBLIC_BUSINESS_TZ || 'Australia/Sydney';
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL || 'https://bookings.technicourt.com').replace(/\/$/, '');

// ponytail: single slot length for the whole business. Per-coach / per-service
// durations are a v2 concern — add a `duration_minutes` column then.
export const SLOT_MINUTES = 60;

// How far ahead clients may book.
export const BOOKING_WINDOW_DAYS = 60;

export const ICS_DOMAIN = 'technicourt.com';
export const BRAND = 'TechniCourt';
