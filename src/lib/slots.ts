import { fromZonedTime } from 'date-fns-tz';
import { SLOT_STEP_MIN, BUSINESS_TZ, MIN_NOTICE_MIN } from './config';

export interface AvailabilityRule {
  weekday: number; // 0 = Sunday .. 6 = Saturday
  start_time: string; // "HH:MM" or "HH:MM:SS", business-local wall time
  end_time: string;
}

export interface Slot {
  startAt: string; // UTC ISO
  endAt: string; // UTC ISO
}

/** A busy interval to subtract — an existing booking or a scheduled class. */
export interface BusyRange {
  start: string; // UTC ISO
  end: string; // UTC ISO
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
 * Open start times for an appointment of `durationMin` on one date, walking a
 * `stepMin` grid inside the coach's availability and skipping anything that
 * overlaps a busy range.
 *
 * DST-safe: local wall times are converted to UTC instants via the business
 * timezone, so a 9am slot is always 9am local regardless of offset changes.
 */
export function computeSlots(opts: {
  dateStr: string; // YYYY-MM-DD in business TZ
  tz: string;
  durationMin: number;
  stepMin?: number;
  rules: AvailabilityRule[];
  busy: BusyRange[];
  isBlackout: boolean;
  now?: Date;
}): Slot[] {
  const {
    dateStr,
    tz,
    durationMin,
    stepMin = SLOT_STEP_MIN,
    rules,
    busy,
    isBlackout,
    now = new Date(),
  } = opts;
  if (isBlackout) return [];

  const wd = weekdayOf(dateStr);
  const spans = busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const);
  const overlaps = (s: number, e: number) => spans.some(([bs, be]) => s < be && e > bs);

  const seen = new Set<number>();
  const out: Slot[] = [];
  const earliest = now.getTime() + MIN_NOTICE_MIN * 60_000;

  for (const rule of rules) {
    if (rule.weekday !== wd) continue;
    const startM = toMinutes(rule.start_time);
    const endM = toMinutes(rule.end_time);
    for (let m = startM; m + durationMin <= endM; m += stepMin) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const startUtc = fromZonedTime(`${dateStr}T${hh}:${mm}:00`, tz);
      const t = startUtc.getTime();
      if (Number.isNaN(t) || seen.has(t)) continue;
      const endT = t + durationMin * 60_000;
      if (t < earliest) continue;
      if (overlaps(t, endT)) continue;
      seen.add(t);
      out.push({ startAt: startUtc.toISOString(), endAt: new Date(endT).toISOString() });
    }
  }

  out.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return out;
}

/** Fetch inputs from the DB (service role) and compute slots for coach + date + duration. */
export async function getAvailableSlots(
  coachId: string,
  dateStr: string,
  durationMin: number,
): Promise<Slot[]> {
  // Dynamic import keeps `astro:env/server` out of the pure-logic module so it
  // stays unit-testable without the Astro build pipeline.
  const { createSupabaseAdmin } = await import('./supabase');
  const db = createSupabaseAdmin();

  const dayStart = fromZonedTime(`${dateStr}T00:00:00`, BUSINESS_TZ);
  const winStart = new Date(dayStart.getTime() - 12 * 3600_000); // catch a class that started before midnight
  const winEnd = new Date(dayStart.getTime() + 36 * 3600_000);

  const [rules, bookings, classes, blackout] = await Promise.all([
    db.from('availability').select('weekday, start_time, end_time').eq('coach_id', coachId),
    db
      .from('bookings')
      .select('start_at, end_at')
      .eq('coach_id', coachId)
      .eq('status', 'confirmed')
      .gte('start_at', winStart.toISOString())
      .lt('start_at', winEnd.toISOString()),
    db
      .from('class_occurrences')
      .select('start_at, end_at')
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gte('start_at', winStart.toISOString())
      .lt('start_at', winEnd.toISOString()),
    db.from('blackout_dates').select('id').eq('coach_id', coachId).eq('date', dateStr),
  ]);

  const busy: BusyRange[] = [
    ...(bookings.data ?? []).map((b) => ({ start: b.start_at as string, end: b.end_at as string })),
    ...(classes.data ?? []).map((c) => ({ start: c.start_at as string, end: c.end_at as string })),
  ];

  return computeSlots({
    dateStr,
    tz: BUSINESS_TZ,
    durationMin,
    rules: rules.data ?? [],
    busy,
    isBlackout: (blackout.data ?? []).length > 0,
  });
}

export interface MergedSlot {
  startAt: string;
  coachIds: string[]; // coaches free at this time
}

/** Union of several coaches' open slots for a date + duration. */
export async function mergeAvailability(
  coachIds: string[],
  dateStr: string,
  durationMin: number,
): Promise<MergedSlot[]> {
  const per = await Promise.all(
    coachIds.map((id) => getAvailableSlots(id, dateStr, durationMin).then((slots) => ({ id, slots }))),
  );
  const map = new Map<string, string[]>();
  for (const { id, slots } of per) {
    for (const s of slots) {
      const list = map.get(s.startAt) ?? [];
      list.push(id);
      map.set(s.startAt, list);
    }
  }
  return [...map.entries()]
    .map(([startAt, ids]) => ({ startAt, coachIds: ids }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Round-robin: the coach with the fewest confirmed bookings on that date. */
export async function pickCoach(coachIds: string[], startAt: string): Promise<string> {
  if (coachIds.length === 1) return coachIds[0];
  const { createSupabaseAdmin } = await import('./supabase');
  const db = createSupabaseAdmin();
  const day = startAt.slice(0, 10);
  const counts = await Promise.all(
    coachIds.map(async (id) => {
      const { count } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', id)
        .eq('status', 'confirmed')
        .gte('start_at', `${day}T00:00:00Z`)
        .lte('start_at', `${day}T23:59:59Z`);
      return { id, count: count ?? 0 };
    }),
  );
  counts.sort((a, b) => a.count - b.count || a.id.localeCompare(b.id));
  return counts[0].id;
}
