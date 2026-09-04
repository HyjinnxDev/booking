import type { APIRoute } from 'astro';

const STAFF = new Set(['coach', 'admin']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const { user, profile, supabase } = locals;
  if (!user || !profile || !STAFF.has(profile.role)) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const c = (k: string) => String(form.get(k) ?? '').trim();
  const coachParam = url.searchParams.get('coach') || c('coach');
  const targetCoach = profile.role === 'admin' && coachParam ? coachParam : user.id;
  const back = targetCoach === user.id ? '/coach/availability' : `/coach/availability?coach=${targetCoach}`;

  if (form.get('action') === 'delete') {
    let q = supabase.from('availability').delete().eq('id', String(form.get('id')));
    if (profile.role !== 'admin') q = q.eq('coach_id', user.id);
    await q;
    return redirect(back);
  }

  // §6: copy Monday's windows to Tue–Fri (skips days that already have any).
  if (form.get('action') === 'copy_week') {
    const { data: mon } = await supabase
      .from('availability')
      .select('start_time, end_time')
      .eq('coach_id', targetCoach)
      .eq('weekday', 1);
    if (!mon || mon.length === 0) {
      return redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent('Set Monday first.')}`);
    }
    const { data: existing } = await supabase
      .from('availability')
      .select('weekday')
      .eq('coach_id', targetCoach)
      .in('weekday', [2, 3, 4, 5]);
    const has = new Set((existing ?? []).map((r) => r.weekday));
    const rows = [2, 3, 4, 5]
      .filter((wd) => !has.has(wd))
      .flatMap((wd) => mon.map((m) => ({ coach_id: targetCoach, weekday: wd, start_time: m.start_time, end_time: m.end_time })));
    if (rows.length) await supabase.from('availability').insert(rows);
    return redirect(back);
  }

  const weekday = Number(form.get('weekday'));
  const start = String(form.get('start_time') ?? '');
  const end = String(form.get('end_time') ?? '');

  const sep = back.includes('?') ? '&' : '?';
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !TIME.test(start) || !TIME.test(end) || start >= end) {
    return redirect(`${back}${sep}error=${encodeURIComponent('Invalid times. Start must be before end.')}`);
  }

  const { error } = await supabase.from('availability').insert({
    coach_id: targetCoach,
    weekday,
    start_time: start,
    end_time: end,
  });
  if (error) return redirect(`${back}${sep}error=${encodeURIComponent(error.message)}`);
  return redirect(back);
};
