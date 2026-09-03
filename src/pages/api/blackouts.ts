import type { APIRoute } from 'astro';

const STAFF = new Set(['coach', 'admin']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const { user, profile, supabase } = locals;
  if (!user || !profile || !STAFF.has(profile.role)) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const c = (k: string) => String(form.get(k) ?? '').trim();
  const coachParam = url.searchParams.get('coach') || c('coach');
  const targetCoach = profile.role === 'admin' && coachParam ? coachParam : user.id;
  const back = targetCoach === user.id ? '/coach/availability' : `/coach/availability?coach=${targetCoach}`;
  const sep = back.includes('?') ? '&' : '?';

  if (form.get('action') === 'delete') {
    let q = supabase.from('blackout_dates').delete().eq('id', String(form.get('id')));
    if (profile.role !== 'admin') q = q.eq('coach_id', user.id);
    await q;
    return redirect(back);
  }

  const date = String(form.get('date') ?? '');
  const reason = String(form.get('reason') ?? '').trim().slice(0, 120) || null;

  if (!DATE.test(date)) return redirect(`${back}${sep}error=${encodeURIComponent('Invalid date.')}`);

  const { error } = await supabase
    .from('blackout_dates')
    .upsert({ coach_id: targetCoach, date, reason }, { onConflict: 'coach_id,date' });
  if (error) return redirect(`${back}${sep}error=${encodeURIComponent(error.message)}`);
  return redirect(back);
};
