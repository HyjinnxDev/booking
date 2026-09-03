import type { APIRoute } from 'astro';
import { formatInTimeZone } from 'date-fns-tz';
import { CRON_SECRET } from 'astro:env/server';
import { createSupabaseAdmin } from '../../../lib/supabase';
import { weeklySeries, latestPerLiveSeries } from '../../../lib/sessions';
import { BUSINESS_TZ } from '../../../lib/config';
import { getSettings } from '../../../lib/settings';
import { todayStr, addDaysStr } from '../../../lib/format';

// Daily Vercel Cron -> extends each active weekly class series back out to
// SERIES_WEEKS ahead. Series are materialised, not RRULE-driven, so without this
// they'd stop dead at whatever horizon they were created with.
// Idempotent: each run starts one week past the current latest occurrence, so a
// second run the same day generates nothing.
export const GET: APIRoute = async ({ request }) => {
  // §1.8: no secret configured => endpoint is closed, not open.
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createSupabaseAdmin();
  const targetDate = addDaysStr(todayStr(), (await getSettings()).seriesWeeks * 7);

  // §2.1: only look at occurrences from today on. A series whose last scheduled
  // occurrence is in the past was cancelled (series.cancel only touches future
  // rows) — without this filter the cron regenerates it from that old date.
  const { data: rows, error } = await db
    .from('class_occurrences')
    .select('series_id, session_variant_id, coach_id, capacity, start_at, end_at')
    .eq('status', 'scheduled')
    .not('series_id', 'is', null)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);

  let added = 0;
  for (const r of latestPerLiveSeries(rows ?? [])) {
    const latestDate = formatInTimeZone(r.start_at, BUSINESS_TZ, 'yyyy-MM-dd');
    const time = formatInTimeZone(r.start_at, BUSINESS_TZ, 'HH:mm');
    const durationMin = Math.round((new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 60_000);
    const from = addDaysStr(latestDate, 7);
    if (from > targetDate) continue;

    const newRows = weeklySeries(from, time, durationMin, targetDate);
    if (newRows.length === 0) continue;

    const { error: insErr } = await db.from('class_occurrences').insert(
      newRows.map((n) => ({
        session_variant_id: r.session_variant_id,
        coach_id: r.coach_id,
        start_at: n.start_at,
        end_at: n.end_at,
        capacity: r.capacity,
        series_id: r.series_id,
      })),
    );
    if (insErr) {
      console.error('series top-up failed for', r.series_id, insErr);
      continue;
    }
    added += newRows.length;
  }

  return json({ added });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
