import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { createSupabaseAdmin } from '../../../lib/supabase';
import { sendReminder } from '../../../lib/email';

// Daily Vercel Cron -> emails reminders for confirmed bookings in the next 24h.
// Idempotent: `reminded_at` guards against duplicate sends across retries.
export const GET: APIRoute = async ({ request }) => {
  if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createSupabaseAdmin();
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3600_000);

  const { data: rows, error } = await db
    .from('bookings')
    .select('id, start_at, end_at, notes, coach_id, client_id')
    .eq('status', 'confirmed')
    .is('reminded_at', null)
    .gte('start_at', now.toISOString())
    .lt('start_at', horizon.toISOString());

  if (error) return json({ error: error.message }, 500);
  const bookings = rows ?? [];
  if (bookings.length === 0) return json({ sent: 0 });

  const ids = [...new Set(bookings.flatMap((b) => [b.coach_id, b.client_id]))];
  const { data: people } = await db.from('profiles').select('id, name, email').in('id', ids);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  let sent = 0;
  for (const b of bookings) {
    const client = byId.get(b.client_id);
    const coach = byId.get(b.coach_id);
    if (!client?.email) continue;
    try {
      await sendReminder({
        to: client.email,
        clientName: client.name ?? '',
        coachName: coach?.name ?? 'your coach',
        bookingId: b.id,
        startAt: b.start_at,
        endAt: b.end_at,
        notes: b.notes,
      });
      await db.from('bookings').update({ reminded_at: new Date().toISOString() }).eq('id', b.id);
      sent++;
    } catch (e) {
      console.error('reminder failed for booking', b.id, e);
    }
  }

  return json({ sent, considered: bookings.length });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
