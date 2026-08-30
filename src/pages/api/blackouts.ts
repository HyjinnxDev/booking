import type { APIRoute } from 'astro';

const STAFF = new Set(['coach', 'admin']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, profile, supabase } = locals;
  if (!user || !STAFF.has(profile?.role ?? '')) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const back = '/coach/availability';

  if (form.get('action') === 'delete') {
    await supabase.from('blackout_dates').delete().eq('id', String(form.get('id'))).eq('coach_id', user.id);
    return redirect(back);
  }

  const date = String(form.get('date') ?? '');
  const reason = String(form.get('reason') ?? '').trim().slice(0, 120) || null;

  if (!DATE.test(date)) return redirect(`${back}?error=${encodeURIComponent('Invalid date.')}`);

  const { error } = await supabase
    .from('blackout_dates')
    .upsert({ coach_id: user.id, date, reason }, { onConflict: 'coach_id,date' });
  if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  return redirect(back);
};
