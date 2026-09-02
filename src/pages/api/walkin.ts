import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { getAvailableSlots } from '../../lib/slots';
import { getVariant } from '../../lib/sessions';
import { getPrimaryCoach } from '../../lib/coach';
import { findOrCreateClient } from '../../lib/accounts';
import { sendConfirmation } from '../../lib/email';

const STAFF = new Set(['coach', 'admin']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, profile } = locals;
  if (!user || !STAFF.has(profile?.role ?? '')) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const back = s('back') || '/coach/calendar';
  const bounce = (r: string) => redirect(`${back}${back.includes('?') ? '&' : '?'}walkin=${r}`);

  const variant = await getVariant(s('variant_id'));
  const date = s('date');
  const startAt = s('start_at');
  const name = s('name').slice(0, 80);
  const email = s('email').toLowerCase();
  if (!variant || variant.type.kind !== 'appointment' || !name || !EMAIL_RE.test(email)) return bounce('fail');

  const coach = await getPrimaryCoach();
  if (!coach) return bounce('fail');

  const open = (await getAvailableSlots(coach.id, date, variant.duration_min)).some((sl) => sl.startAt === startAt);
  if (!open) return bounce('fail');

  const endAt = new Date(new Date(startAt).getTime() + variant.duration_min * 60_000).toISOString();

  let clientId: string;
  let tempPassword: string | undefined;
  try {
    const acct = await findOrCreateClient({ email, name, phone: null });
    clientId = acct.id;
    tempPassword = acct.tempPassword;
  } catch {
    return bounce('fail');
  }

  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from('bookings')
    .insert({
      coach_id: coach.id,
      client_id: clientId,
      start_at: startAt,
      end_at: endAt,
      status: 'confirmed',
      session_variant_id: variant.id,
      price_cents: variant.price_cents,
      payment_status: variant.price_cents === 0 ? 'free' : 'unpaid',
    })
    .select('id')
    .single();
  if (error) return bounce('fail');

  try {
    await sendConfirmation({
      to: email,
      clientName: name,
      coachName: coach.name,
      bookingId: data.id,
      startAt,
      endAt,
      newAccount: tempPassword ? { tempPassword } : undefined,
    });
  } catch (e) {
    console.error('walk-in confirmation email failed', e);
  }

  return bounce('ok');
};
