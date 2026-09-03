import type { APIRoute } from 'astro';

const BACK = '/admin/settings';
const ORG = 'a0000000-0000-4000-8000-000000000001';

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (locals.profile?.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const { error } = await locals.supabase
    .from('settings')
    .update({
      brand: String(form.get('brand') ?? '').trim().slice(0, 60) || null,
      booking_window_days: clamp(form.get('booking_window_days'), 1, 365, 60),
      min_notice_min: clamp(form.get('min_notice_min'), 0, 10080, 120),
      slot_step_min: clamp(form.get('slot_step_min'), 5, 120, 30),
      series_weeks: clamp(form.get('series_weeks'), 1, 52, 12),
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', ORG);

  if (error) return redirect(`${BACK}?error=${encodeURIComponent(error.message)}`);
  return redirect(`${BACK}?saved=1`);
};
