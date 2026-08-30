import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { coachFeedIcs, type IcsEvent } from '../../lib/ics';

// Read-only calendar subscription feed. The token in the URL is the only
// credential — treat it like a password.
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
    .eq('role', 'coach')
    .maybeSingle();

  if (!coach) return new Response('Not found', { status: 404 });

  const since = new Date(Date.now() - 14 * 864e5).toISOString(); // keep 2 weeks of history
  const { data: rows } = await db
    .from('bookings')
    .select('id, start_at, end_at, notes, client_id')
    .eq('coach_id', coach.id)
    .eq('status', 'confirmed')
    .gte('start_at', since)
    .order('start_at', { ascending: true });

  const bookings = rows ?? [];
  const clientIds = [...new Set(bookings.map((b) => b.client_id))];
  const { data: clients } = clientIds.length
    ? await db.from('profiles').select('id, name').in('id', clientIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const events: IcsEvent[] = bookings.map((b) => ({
    id: b.id,
    startAt: b.start_at,
    endAt: b.end_at,
    summary: `Tennis — ${nameById.get(b.client_id) || 'Client'}`,
    description: b.notes || undefined,
  }));

  return new Response(coachFeedIcs(coach.name, events), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="technicourt.ics"',
      'cache-control': 'public, max-age=300',
    },
  });
};
