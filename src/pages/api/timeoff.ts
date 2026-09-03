import type { APIRoute } from 'astro';
import { fromZonedTime } from 'date-fns-tz';
import { BUSINESS_TZ } from '../../lib/config';
import { addDaysStr } from '../../lib/format';

const STAFF = new Set(['coach', 'admin']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

// §3.3: time off is any [start, end) interval. "All day" is midnight -> next
// midnight in the business timezone.
export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const { user, profile, supabase } = locals;
  if (!user || !profile || !STAFF.has(profile.role)) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const c = (k: string) => String(form.get(k) ?? '').trim();
  const coachParam = url.searchParams.get('coach') || c('coach');
  const targetCoach = profile.role === 'admin' && coachParam ? coachParam : user.id;
  const back = targetCoach === user.id ? '/coach/availability' : `/coach/availability?coach=${targetCoach}`;
  const sep = back.includes('?') ? '&' : '?';
  const fail = (m: string) => redirect(`${back}${sep}error=${encodeURIComponent(m)}`);

  if (form.get('action') === 'delete') {
    let q = supabase.from('time_off').delete().eq('id', c('id'));
    if (profile.role !== 'admin') q = q.eq('coach_id', user.id);
    await q;
    return redirect(back);
  }

  const reason = c('reason').slice(0, 120) || null;
  let startUtc: Date;
  let endUtc: Date;

  if (form.get('all_day')) {
    const date = c('date');
    if (!DATE.test(date)) return fail('Pick a valid date.');
    startUtc = fromZonedTime(`${date}T00:00:00`, BUSINESS_TZ);
    endUtc = fromZonedTime(`${addDaysStr(date, 1)}T00:00:00`, BUSINESS_TZ);
  } else {
    const s = c('start_at');
    const e = c('end_at');
    if (!LOCAL_DT.test(s) || !LOCAL_DT.test(e)) return fail('Pick a valid start and end.');
    startUtc = fromZonedTime(`${s}:00`, BUSINESS_TZ);
    endUtc = fromZonedTime(`${e}:00`, BUSINESS_TZ);
    if (endUtc <= startUtc) return fail('End must be after start.');
  }

  const { error } = await supabase.from('time_off').insert({
    coach_id: targetCoach,
    start_at: startUtc.toISOString(),
    end_at: endUtc.toISOString(),
    reason,
  });
  if (error) return fail(error.message);
  return redirect(back);
};
