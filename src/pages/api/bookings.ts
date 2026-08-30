import type { APIRoute } from 'astro';
import { getPrimaryCoach } from '../../lib/coach';
import { getAvailableSlots } from '../../lib/slots';
import { SLOT_MINUTES } from '../../lib/config';
import { sendConfirmation, sendCancellation } from '../../lib/email';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/login?next=/');

  const form = await request.formData();

  // --- Cancel -------------------------------------------------------------
  if (form.get('action') === 'cancel') {
    const id = String(form.get('id') ?? '');
    const { data, error } = await locals.supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('client_id', user.id)
      .eq('status', 'confirmed')
      .select('id, start_at, end_at, notes, coach_id')
      .maybeSingle();

    if (!error && data) {
      const coach = await getPrimaryCoach();
      try {
        await sendCancellation({
          to: user.email!,
          clientName: locals.profile?.name ?? '',
          coachName: coach?.name ?? 'your coach',
          bookingId: data.id,
          startAt: data.start_at,
          endAt: data.end_at,
          notes: data.notes,
        });
      } catch (e) {
        console.error('cancellation email failed', e);
      }
    }
    return redirect('/bookings?cancelled=1');
  }

  // --- Create -----------------------------------------------------------
  const startAt = String(form.get('start_at') ?? '');
  const date = String(form.get('date') ?? '');
  const notes = String(form.get('notes') ?? '').trim().slice(0, 500) || null;

  const coach = await getPrimaryCoach();
  if (!coach) return redirect('/?error=unknown');

  // Re-derive availability server-side; never trust the posted slot.
  const slots = await getAvailableSlots(coach.id, date);
  const match = slots.find((s) => s.startAt === startAt);
  if (!match) return redirect(`/?date=${date}&error=slot_taken`);

  const endAt = new Date(new Date(startAt).getTime() + SLOT_MINUTES * 60_000).toISOString();

  // Race safety: rely on the partial unique index (coach_id, start_at) where
  // status = 'confirmed'. Two concurrent inserts -> one gets 23505.
  const { data, error } = await locals.supabase
    .from('bookings')
    .insert({
      coach_id: coach.id,
      client_id: user.id,
      start_at: startAt,
      end_at: endAt,
      status: 'confirmed',
      notes,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return redirect(`/?date=${date}&error=slot_taken`);
    console.error('booking insert failed', error);
    return redirect(`/?date=${date}&error=unknown`);
  }

  try {
    await sendConfirmation({
      to: user.email!,
      clientName: locals.profile?.name ?? '',
      coachName: coach.name,
      bookingId: data.id,
      startAt,
      endAt,
      notes,
    });
  } catch (e) {
    console.error('confirmation email failed', e);
  }

  return redirect('/bookings?booked=1');
};
