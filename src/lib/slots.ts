import { fromZonedTime } from 'date-fns-tz';
import { SLOT_MINUTES, BUSINESS_TZ } from './config';

export interface AvailabilityRule {
  weekday: number; // 0 = Sunday .. 6 = Saturday
  start_time: string; // "HH:MM" or "HH:MM:SS", business-local wall time
  end_time: string;
}

export interface Slot {
  startAt: string; // UTC ISO
  endAt: string; // UTC ISO
}

/** Day of week (0=Sun) for a YYYY-MM-DD date, independent of timezone. */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Available slots for one coach on one calendar date, computed server-side.
 * available = availability rules − existing confirmed bookings − blackout dates
 *
 * DST-safe: local wall times are converted to UTC instants via the business
 * timezone, so a 9am slot is always 9am local regardless of offset changes.
 */
export function computeSlots(opts: {
  dateStr: string; // YYYY-MM-DD in business TZ
  tz: string;
  rules: AvailabilityRule[];
  bookedStartsUtc: string[]; // ISO start_at of existing confirmed bookings
  isBlackout: boolean;
  now?: Date;
}): Slot[] {
  const { dateStr, tz, rules, bookedStartsUtc, isBlackout, now = new Date() } = opts;
  if (isBlackout) return [];

  const wd = weekdayOf(dateStr);
  const booked = new Set(bookedStartsUtc.map((s) => new Date(s).getTime()));
  const out: Slot[] = [];

  for (const rule of rules) {
    if (rule.weekday !== wd) continue;
    const startM = toMinutes(rule.start_time);
    const endM = toMinutes(rule.end_time);
    for (let m = startM; m + SLOT_MINUTES <= endM; m += SLOT_MINUTES) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const startUtc = fromZonedTime(`${dateStr}T${hh}:${mm}:00`, tz);
      if (Number.isNaN(startUtc.getTime())) continue;
      if (startUtc.getTime() <= now.getTime()) continue;
      if (booked.has(startUtc.getTime())) continue;
      out.push({
        startAt: startUtc.toISOString(),
        endAt: new Date(startUtc.getTime() + SLOT_MINUTES * 60_000).toISOString(),
      });
    }
  }

  out.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return out.filter((s, i) => i === 0 || s.startAt !== out[i - 1].startAt);
}

/** Fetch inputs from the DB (service role) and compute slots for coach + date. */
export async function getAvailableSlots(coachId: string, dateStr: string): Promise<Slot[]> {
  // Dynamic import keeps `astro:env/server` out of the pure-logic module so it
  // stays unit-testable without the Astro build pipeline.
  const { createSupabaseAdmin } = await import('./supabase');
  const db = createSupabaseAdmin();

  const dayStart = fromZonedTime(`${dateStr}T00:00:00`, BUSINESS_TZ);
  const dayEnd = new Date(dayStart.getTime() + 36 * 3600_000); // wide enough to cover any TZ day

  const [rules, bookings, blackout] = await Promise.all([
    db.from('availability').select('weekday, start_time, end_time').eq('coach_id', coachId),
    db
      .from('bookings')
      .select('start_at')
      .eq('coach_id', coachId)
      .eq('status', 'confirmed')
      .gte('start_at', dayStart.toISOString())
      .lt('start_at', dayEnd.toISOString()),
    db.from('blackout_dates').select('id').eq('coach_id', coachId).eq('date', dateStr),
  ]);

  return computeSlots({
    dateStr,
    tz: BUSINESS_TZ,
    rules: rules.data ?? [],
    bookedStartsUtc: (bookings.data ?? []).map((b) => b.start_at as string),
    isBlackout: (blackout.data ?? []).length > 0,
  });
}
