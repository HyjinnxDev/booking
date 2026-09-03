import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { getAvailableSlots } from '../../lib/slots';
import { getVariant } from '../../lib/sessions';
import { findOrCreateClient } from '../../lib/accounts';
import { sendConfirmation } from '../../lib/email';

const STAFF = new Set(['coach', 'admin']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, profile } = locals;
  if (!user || !profile || !STAFF.has(profile.role)) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const back = s('back') || '/coach';
  const bounce = (r: string) => redirect(`${back}${back.includes('?') ? '&' : '?'}walkin=${r}`);

  // A coach books with themselves; an admin books with the coach_id they pass.
  const coachId = profile.role === 'admin' && s('coach_id') ? s('coach_id') : user.id;

  const variant = await getVariant(s('variant_id'));
  const date = s('date');
  const startAt = s('start_at');
  const name = s('name').slice(0, 80);
  const email = s('email').toLowerCase();
  if (
    !variant ||
    variant.type.kind !== 'appointment' ||
    variant.type.coach_id !== coachId ||
    !name ||
    !EMAIL_RE.test(email)
  ) {
    return bounce('fail');
  }

  const db = createSupabaseAdmin();
  const { data: coach } = await db.from('profiles').select('name').eq('id', coachId).maybeSingle();
  if (!coach) return bounce('fail');

  const open = (await getAvailableSlots(coachId, date, variant.duration_min)).some((sl) => sl.startAt === startAt);
  if (!open) return bounce('fail');

  const endAt = new Date(new Date(startAt).getTime() + variant.duration_min * 60_000).toISOString();

  let clientId: string;
  let setPasswordUrl: string | undefined;
  try {
    const acct = await findOrCreateClient({ email, name, phone: null });
    clientId = acct.id;
    setPasswordUrl = acct.setPasswordUrl;
  } catch {
    return bounce('fail');
  }

  const { data, error } = await db
    .from('bookings')
    .insert({
      coach_id: coachId,
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
      typeName: variant.type.name,
      locationName: variant.type.location?.name,
      locationAddress: variant.type.location?.address,
      newAccount: setPasswordUrl ? { setPasswordUrl } : undefined,
    });
  } catch (e) {
    console.error('walk-in confirmation email failed', e);
  }

  return bounce('ok');
};
