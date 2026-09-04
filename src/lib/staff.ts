import { createSupabaseAdmin } from './supabase';

export interface Coach {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: 'coach' | 'admin';
}

/**
 * Everyone who can take bookings, coaches, plus admins who also coach (§3.6).
 * `active` is the "takes bookings" flag; `activeOnly` filters to it.
 */
export async function listCoaches(opts: { activeOnly?: boolean } = {}): Promise<Coach[]> {
  const db = createSupabaseAdmin();
  let q = db
    .from('profiles')
    .select('id, name, email, active, role')
    .in('role', ['coach', 'admin'])
    .order('role')
    .order('created_at');
  if (opts.activeOnly) q = q.eq('active', true);
  const { data } = await q;
  return (data ?? []) as Coach[];
}

/** staff_id -> location_id[] for every coach. */
export async function staffLocationMap(): Promise<Map<string, string[]>> {
  const db = createSupabaseAdmin();
  const { data } = await db.from('staff_locations').select('staff_id, location_id');
  const map = new Map<string, string[]>();
  for (const r of data ?? []) {
    const list = map.get(r.staff_id) ?? [];
    list.push(r.location_id);
    map.set(r.staff_id, list);
  }
  return map;
}

export async function coachLocationIds(coachId: string): Promise<string[]> {
  const db = createSupabaseAdmin();
  const { data } = await db.from('staff_locations').select('location_id').eq('staff_id', coachId);
  return (data ?? []).map((r) => r.location_id as string);
}

export interface StaffScope {
  /** null only when an admin lands on a coach page without ?coach= */
  coachId: string | null;
  /** the scoped coach is the logged-in user */
  isSelf: boolean;
  coachName: string;
  /** admin needs to pick a coach before the page has anything to show */
  needsPick: boolean;
}

/**
 * Resolve which coach a `/coach/*` page operates on.
 *  - a coach → always themselves
 *  - an admin with `?coach=<id>` → that coach
 *  - an admin without it → `needsPick`, render a chooser
 */
export async function getStaffScope(Astro: { locals: App.Locals; url: URL }): Promise<StaffScope> {
  const { user, profile } = Astro.locals;
  if (profile?.role !== 'admin') {
    return { coachId: user!.id, isSelf: true, coachName: profile?.name ?? '', needsPick: false };
  }
  const target = Astro.url.searchParams.get('coach');
  // §3.6: an admin who also coaches (active=true) manages their own setup by
  // default; one who only administers still gets the chooser.
  if (!target) {
    if (profile.active) {
      return { coachId: user!.id, isSelf: true, coachName: profile.name ?? '', needsPick: false };
    }
    return { coachId: null, isSelf: false, coachName: '', needsPick: true };
  }
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('profiles')
    .select('name')
    .eq('id', target)
    .in('role', ['coach', 'admin'])
    .maybeSingle();
  return {
    coachId: target,
    isSelf: target === user!.id,
    coachName: data?.name ?? 'Unknown coach',
    needsPick: false,
  };
}
