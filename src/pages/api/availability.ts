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

  const weekday = Number(form.get('weekday'));
  const start = String(form.get('start_time') ?? '');
  const end = String(form.get('end_time') ?? '');

  const sep = back.includes('?') ? '&' : '?';
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !TIME.test(start) || !TIME.test(end) || start >= end) {
    return redirect(`${back}${sep}error=${encodeURIComponent('Invalid times — start must be before end.')}`);
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
