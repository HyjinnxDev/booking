import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { coachFeedIcs, type IcsEvent } from '../../lib/ics';

// Read-only calendar subscription feed. The token in the URL is the only
// credential, treat it like a password.
export const GET: APIRoute = async ({ params }) => {
  const token = params.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response('Not found', { status: 404 });
  }

  const db = createSupabaseAdmin();

  const { data: coach } = await db
    .from('profiles')
    .select('id, name')
    .eq('cal_token', token)
    .in('role', ['coach', 'admin'])
    .maybeSingle();

  if (!coach) return new Response('Not found', { status: 404 });

  const since = new Date(Date.now() - 14 * 864e5).toISOString(); // keep 2 weeks of history

  // §2.4: one VEVENT per appointment, and one per class occurrence (not per
  // attendee). A class with 0 bookings still shows; a class with 6 doesn't show 6×.
  const [{ data: apptRows }, { data: occRows }] = await Promise.all([
    db
      .from('bookings')
      .select('id, start_at, end_at, notes, client_id')
      .eq('coach_id', coach.id)
      .eq('status', 'confirmed')
      .is('class_occurrence_id', null)
      .gte('start_at', since)
      .order('start_at', { ascending: true }),
    db
      .from('class_occurrences')
      .select('id, start_at, end_at, capacity, session_variant_id')
      .eq('coach_id', coach.id)
      .eq('status', 'scheduled')
      .gte('start_at', since)
      .order('start_at', { ascending: true }),
  ]);

  const appts = apptRows ?? [];
  const occ = occRows ?? [];

  const clientIds = [...new Set(appts.map((b) => b.client_id))];
  const { data: clients } = clientIds.length
    ? await db.from('profiles').select('id, name').in('id', clientIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  // Class names + rosters
  const variantIds = [...new Set(occ.map((o) => o.session_variant_id))];
  const { data: variants } = variantIds.length
    ? await db
        .from('session_variants')
        .select('id, session_types ( name )')
        .in('id', variantIds)
    : { data: [] as any[] };
  const classNameByVariant = new Map(
    (variants ?? []).map((v: any) => [v.id, v.session_types?.name ?? 'Class']),
  );

  const { data: rosterRows } = occ.length
    ? await db
        .from('bookings')
        .select('class_occurrence_id, client:client_id ( name )')
        .in('class_occurrence_id', occ.map((o) => o.id))
        .eq('status', 'confirmed')
    : { data: [] as any[] };
  const roster = new Map<string, string[]>();
  for (const r of (rosterRows ?? []) as any[]) {
    const list = roster.get(r.class_occurrence_id) ?? [];
    if (r.client?.name) list.push(r.client.name);
    roster.set(r.class_occurrence_id, list);
  }

  const events: IcsEvent[] = [
    ...appts.map((b) => ({
      id: b.id,
      startAt: b.start_at,
      endAt: b.end_at,
      summary: `Tennis with ${nameById.get(b.client_id) || 'Client'}`,
      description: b.notes || undefined,
    })),
    ...occ.map((o) => {
      const names = roster.get(o.id) ?? [];
      return {
        id: o.id,
        startAt: o.start_at,
        endAt: o.end_at,
        summary: `${classNameByVariant.get(o.session_variant_id) ?? 'Class'} (${names.length}/${o.capacity})`,
        description: names.join(', ') || undefined,
      };
    }),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));

  return new Response(coachFeedIcs(coach.name, events), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="technicourt.ics"',
      // §3.13: the token is a personal credential, don't let shared caches keep it.
      'cache-control': 'private, max-age=300',
    },
  });
};
