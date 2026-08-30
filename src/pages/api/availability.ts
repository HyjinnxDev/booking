import type { APIRoute } from 'astro';

const STAFF = new Set(['coach', 'admin']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, profile, supabase } = locals;
  if (!user || !STAFF.has(profile?.role ?? '')) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const back = '/coach/availability';

  if (form.get('action') === 'delete') {
    await supabase.from('availability').delete().eq('id', String(form.get('id'))).eq('coach_id', user.id);
    return redirect(back);
  }

  const weekday = Number(form.get('weekday'));
  const start = String(form.get('start_time') ?? '');
  const end = String(form.get('end_time') ?? '');

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !TIME.test(start) || !TIME.test(end) || start >= end) {
    return redirect(`${back}?error=${encodeURIComponent('Invalid times — start must be before end.')}`);
  }

  const { error } = await supabase.from('availability').insert({
    coach_id: user.id,
    weekday,
    start_time: start,
    end_time: end,
  });
  if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  return redirect(back);
};
