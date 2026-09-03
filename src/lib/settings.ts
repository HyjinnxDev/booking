import { createSupabaseAdmin } from './supabase';
import { BRAND, BOOKING_WINDOW_DAYS, MIN_NOTICE_MIN, SLOT_STEP_MIN, SERIES_WEEKS } from './config';

export interface Settings {
  brand: string;
  bookingWindowDays: number;
  minNoticeMin: number;
  slotStepMin: number;
  seriesWeeks: number;
}

const DEFAULTS: Settings = {
  brand: BRAND,
  bookingWindowDays: BOOKING_WINDOW_DAYS,
  minNoticeMin: MIN_NOTICE_MIN,
  slotStepMin: SLOT_STEP_MIN,
  seriesWeeks: SERIES_WEEKS,
};

// Cached for the instance lifetime — settings change rarely and this runs on
// every booking page. An admin's save takes up to a minute to fully propagate.
let cache: { v: Settings; at: number } | null = null;
const TTL_MS = 60_000;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.v;
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('settings')
    .select('brand, booking_window_days, min_notice_min, slot_step_min, series_weeks')
    .maybeSingle();
  const v: Settings = data
    ? {
        brand: data.brand || DEFAULTS.brand,
        bookingWindowDays: data.booking_window_days ?? DEFAULTS.bookingWindowDays,
        minNoticeMin: data.min_notice_min ?? DEFAULTS.minNoticeMin,
        slotStepMin: data.slot_step_min ?? DEFAULTS.slotStepMin,
        seriesWeeks: data.series_weeks ?? DEFAULTS.seriesWeeks,
      }
    : DEFAULTS;
  cache = { v, at: Date.now() };
  return v;
}
