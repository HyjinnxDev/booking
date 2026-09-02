import { fromZonedTime } from 'date-fns-tz';
import { createSupabaseAdmin } from './supabase';
import { BUSINESS_TZ } from './config';

export interface Variant {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  capacity: number;
  active: boolean;
  sort: number;
}

export interface SessionType {
  id: string;
  coach_id: string;
  name: string;
  blurb: string | null;
  kind: 'appointment' | 'class';
  active: boolean;
  sort: number;
  location_id: string;
  location: { id: string; name: string; address: string | null } | null;
  intake_fields: unknown;
  cancel_cutoff_hours: number;
  variants: Variant[];
}

export interface Occurrence {
  id: string;
  start_at: string;
  end_at: string;
  capacity: number;
  seats_taken: number;
  waiting: number;
  series_id: string | null;
  variant: Variant;
  type: Pick<SessionType, 'id' | 'name' | 'blurb' | 'location' | 'intake_fields' | 'cancel_cutoff_hours'>;
}

const VARIANT_COLS = 'id, name, duration_min, price_cents, capacity, active, sort';

/** Session types for a coach, variants nested and sorted. */
export async function listSessionTypes(
  coachId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<SessionType[]> {
  const db = createSupabaseAdmin();
  let q = db
    .from('session_types')
    .select(
      `id, coach_id, name, blurb, kind, active, sort, location_id, intake_fields, cancel_cutoff_hours,
       location:location_id ( id, name, address ),
       session_variants ( ${VARIANT_COLS} )`,
    )
    .eq('coach_id', coachId)
    .order('sort')
    .order('created_at');
  if (opts.activeOnly) q = q.eq('active', true);

  const { data } = await q;
  return (data ?? []).map((t: any) => ({
    ...t,
    variants: (t.session_variants ?? [])
      .filter((v: Variant) => !opts.activeOnly || v.active)
      .sort((a: Variant, b: Variant) => a.sort - b.sort || a.duration_min - b.duration_min),
  }));
}

/** One variant with its parent type, or null. */
export async function getVariant(
  id: string,
): Promise<(Variant & { type: SessionType }) | null> {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('session_variants')
    .select(
      `${VARIANT_COLS}, type:session_types ( id, coach_id, name, blurb, kind, active, sort, location_id, intake_fields, cancel_cutoff_hours, location:location_id ( id, name, address ) )`,
    )
    .eq('id', id)
    .maybeSingle();
  return data as any;
}

/** Upcoming scheduled class occurrences with a live seats-taken count. */
export async function upcomingOccurrences(opts: {
  coachId?: string;
  variantId?: string;
  from?: Date;
} = {}): Promise<Occurrence[]> {
  const db = createSupabaseAdmin();
  let q = db
    .from('class_occurrences')
    .select(
      `id, start_at, end_at, capacity, series_id,
       variant:session_variants ( ${VARIANT_COLS}, type:session_types ( id, name, blurb, intake_fields, cancel_cutoff_hours, location:location_id ( id, name, address ) ) )`,
    )
    .eq('status', 'scheduled')
    .gte('start_at', (opts.from ?? new Date()).toISOString())
    .order('start_at');
  if (opts.coachId) q = q.eq('coach_id', opts.coachId);
  if (opts.variantId) q = q.eq('session_variant_id', opts.variantId);

  const { data } = await q;
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const { data: seats } = await db
    .from('bookings')
    .select('class_occurrence_id')
    .in('class_occurrence_id', rows.map((r) => r.id))
    .eq('status', 'confirmed');
  const taken = new Map<string, number>();
  for (const s of seats ?? []) taken.set(s.class_occurrence_id, (taken.get(s.class_occurrence_id) ?? 0) + 1);

  const { data: wl } = await db
    .from('waitlist')
    .select('class_occurrence_id')
    .in('class_occurrence_id', rows.map((r) => r.id));
  const waiting = new Map<string, number>();
  for (const w of wl ?? []) waiting.set(w.class_occurrence_id, (waiting.get(w.class_occurrence_id) ?? 0) + 1);

  return rows.map((r) => ({
    id: r.id,
    start_at: r.start_at,
    end_at: r.end_at,
    capacity: r.capacity,
    seats_taken: taken.get(r.id) ?? 0,
    waiting: waiting.get(r.id) ?? 0,
    series_id: r.series_id,
    variant: r.variant,
    type: r.variant.type,
  }));
}

/** One class occurrence with a live seats-taken count, or null. */
export async function getOccurrence(id: string): Promise<Occurrence | null> {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('class_occurrences')
    .select(
      `id, start_at, end_at, capacity, series_id, status,
       variant:session_variants ( ${VARIANT_COLS}, type:session_types ( id, name, blurb, intake_fields, cancel_cutoff_hours, location:location_id ( id, name, address ) ) )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!data || (data as any).status !== 'scheduled') return null;

  const { count } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('class_occurrence_id', id)
    .eq('status', 'confirmed');

  const r = data as any;
  return {
    id: r.id,
    start_at: r.start_at,
    end_at: r.end_at,
    capacity: r.capacity,
    seats_taken: count ?? 0,
    waiting: 0,
    series_id: r.series_id,
    variant: r.variant,
    type: r.variant.type,
  };
}

/**
 * UTC [start, end] instants for a class repeating weekly on the same local
 * wall time. Generated from the local date so a 6pm class stays 6pm across DST.
 */
export function weeklySeries(
  dateStr: string, // YYYY-MM-DD, business-local, first occurrence
  timeStr: string, // HH:MM, business-local
  durationMin: number,
  untilStr: string, // YYYY-MM-DD inclusive
): { start_at: string; end_at: string }[] {
  const out: { start_at: string; end_at: string }[] = [];
  const d = new Date(`${dateStr}T12:00:00Z`);
  const until = new Date(`${untilStr}T12:00:00Z`);
  for (let i = 0; i < 260 && d.getTime() <= until.getTime(); i++) {
    const day = d.toISOString().slice(0, 10);
    const start = fromZonedTime(`${day}T${timeStr}:00`, BUSINESS_TZ);
    if (!Number.isNaN(start.getTime())) {
      out.push({
        start_at: start.toISOString(),
        end_at: new Date(start.getTime() + durationMin * 60_000).toISOString(),
      });
    }
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}
