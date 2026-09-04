import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { fromZonedTime } from 'date-fns-tz';
import { createSupabaseAdmin } from '../../../lib/supabase';
import { sendReminder, sendAgenda } from '../../../lib/email';
import { BUSINESS_TZ } from '../../../lib/config';
import { todayStr, addDaysStr, fmtTime, calFmt } from '../../../lib/format';
import { pool } from '../../../lib/pool';

// Daily Vercel Cron (08:00 ACST). §2.3: the window covers everything up to the
// end of *tomorrow* in business time, so an evening booking gets a full day's
// notice instead of ~30 minutes. Idempotent via `reminded_at`.
export const GET: APIRoute = async ({ request }) => {
  // §1.8: no secret configured => endpoint is closed, not open.
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createSupabaseAdmin();
  const now = new Date();
  const horizon = fromZonedTime(`${addDaysStr(todayStr(), 2)}T00:00:00`, BUSINESS_TZ);

  const { data: rows, error } = await db
    .from('bookings')
    .select('id, start_at, end_at, notes, coach_id, client_id, session_variant_id')
    .eq('status', 'confirmed')
    .is('reminded_at', null)
    .gte('start_at', now.toISOString())
    .lt('start_at', horizon.toISOString());

  if (error) return json({ error: error.message }, 500);
  const bookings = rows ?? [];

  const ids = [...new Set(bookings.flatMap((b) => [b.coach_id, b.client_id]))];
  const { data: people } = ids.length
    ? await db.from('profiles').select('id, name, email').in('id', ids)
    : { data: [] as any[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const variantIds = [...new Set(bookings.map((b) => b.session_variant_id).filter(Boolean))];
  const { data: variants } = variantIds.length
    ? await db.from('session_variants').select('id, session_types ( name, location:location_id ( name, address ) )').in('id', variantIds)
    : { data: [] as any[] };
  const typeByVariant = new Map((variants ?? []).map((v: any) => [v.id, v.session_types]));

  let sent = 0;
  await pool(bookings, 5, async (b) => {
    const client = byId.get(b.client_id);
    const coach = byId.get(b.coach_id);
    if (!client?.email) return;
    const t = typeByVariant.get(b.session_variant_id);
    await sendReminder({
      to: client.email,
      clientName: client.name ?? '',
      coachName: coach?.name ?? 'your coach',
      bookingId: b.id,
      startAt: b.start_at,
      endAt: b.end_at,
      notes: b.notes,
      typeName: t?.name,
      locationName: t?.location?.name,
      locationAddress: t?.location?.address,
    });
    await db.from('bookings').update({ reminded_at: new Date().toISOString() }).eq('id', b.id);
    sent++;
  });

  // §3.2 (optional): each coach gets tomorrow's agenda.
  const tomorrow = addDaysStr(todayStr(), 1);
  const tStart = fromZonedTime(`${tomorrow}T00:00:00`, BUSINESS_TZ).toISOString();
  const tEnd = fromZonedTime(`${addDaysStr(tomorrow, 1)}T00:00:00`, BUSINESS_TZ).toISOString();
  const { data: tomRows } = await db
    .from('bookings')
    .select('start_at, coach_id, client:client_id ( name ), variant:session_variant_id ( session_types ( name ) )')
    .eq('status', 'confirmed')
    .gte('start_at', tStart)
    .lt('start_at', tEnd)
    .order('start_at');
  const agendaByCoach = new Map<string, string[]>();
  for (const r of (tomRows ?? []) as any[]) {
    const line = `${fmtTime(r.start_at)} · ${r.client?.name || 'Client'} (${r.variant?.session_types?.name ?? 'Session'})`;
    (agendaByCoach.get(r.coach_id) ?? agendaByCoach.set(r.coach_id, []).get(r.coach_id)!).push(line);
  }
  let agendas = 0;
  await pool([...agendaByCoach.entries()], 5, async ([coachId, lines]) => {
    const coach = byId.get(coachId) ?? (await db.from('profiles').select('name, email').eq('id', coachId).maybeSingle()).data;
    if (!coach?.email) return;
    await sendAgenda({ to: coach.email, coachName: coach.name ?? '', date: calFmt(tomorrow, 'EEEE d MMMM'), lines });
    agendas++;
  });

  return json({ sent, considered: bookings.length, agendas });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
