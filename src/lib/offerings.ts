import { createSupabaseAdmin } from './supabase';
import { upcomingOccurrences } from './sessions';
import { getSettings } from './settings';
import { slugify, assignOfferingSlugs } from './slug';

export { slugify };

export interface OfferingCoach {
  id: string;
  name: string;
  typeId: string;
  variants: { id: string; name: string; duration_min: number; price_cents: number }[];
}

export interface Offering {
  slug: string;
  name: string;
  kind: 'appointment' | 'class';
  blurb: string | null;
  locationId: string;
  location: { name: string; address: string | null } | null;
  coaches: OfferingCoach[];
  priceFromCents: number;
  durations: number[]; // appointments: distinct variant lengths
  classCount: number; // classes: upcoming occurrences
}

/**
 * Every active session type from every active coach, grouped into "offerings" —
 * same name + kind + location = one bookable service that one or more coaches
 * deliver.
 */
export async function listOfferings(): Promise<Offering[]> {
  const db = createSupabaseAdmin();
  const settings = await getSettings();
  // §5: bound the occurrence scan to the booking window instead of pulling every
  // future row on every home / offering / embed page.
  const windowEnd = new Date(Date.now() + settings.bookingWindowDays * 864e5);
  const [{ data: typeRows }, occ] = await Promise.all([
    db
      .from('session_types')
      .select(
        `id, name, blurb, kind, location_id,
         location:location_id ( name, address ),
         coach:coach_id ( id, name, active ),
         session_variants ( id, name, duration_min, price_cents, active )`,
      )
      .eq('active', true),
    upcomingOccurrences({ to: windowEnd }),
  ]);

  const classCountByType = new Map<string, number>();
  for (const o of occ) classCountByType.set(o.type.id, (classCountByType.get(o.type.id) ?? 0) + 1);

  const groups = new Map<string, Offering>();
  for (const t of (typeRows ?? []) as any[]) {
    if (!t.coach?.active) continue;
    const variants = (t.session_variants ?? [])
      .filter((v: any) => v.active)
      .sort((a: any, b: any) => a.duration_min - b.duration_min)
      .map((v: any) => ({ id: v.id, name: v.name, duration_min: v.duration_min, price_cents: v.price_cents }));
    if (variants.length === 0) continue;
    if (t.kind === 'class' && (classCountByType.get(t.id) ?? 0) === 0) continue;

    const key = `${t.name.trim().toLowerCase()}|${t.kind}|${t.location_id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        slug: slugify(t.name),
        name: t.name,
        kind: t.kind,
        blurb: t.blurb || null,
        locationId: t.location_id,
        location: t.location ?? null,
        coaches: [],
        priceFromCents: Infinity,
        durations: [],
        classCount: 0,
      };
      groups.set(key, g);
    }
    if (!g.blurb && t.blurb) g.blurb = t.blurb;
    g.coaches.push({ id: t.coach.id, name: t.coach.name, typeId: t.id, variants });
    g.classCount += classCountByType.get(t.id) ?? 0;
    for (const v of variants) {
      g.priceFromCents = Math.min(g.priceFromCents, v.price_cents);
      if (!g.durations.includes(v.duration_min)) g.durations.push(v.duration_min);
    }
  }

  const out = [...groups.values()];
  for (const g of out) {
    g.durations.sort((a, b) => a - b);
    if (g.priceFromCents === Infinity) g.priceFromCents = 0;
  }
  return assignOfferingSlugs(out);
}

export async function getOffering(slug: string): Promise<Offering | null> {
  return (await listOfferings()).find((o) => o.slug === slug) ?? null;
}
