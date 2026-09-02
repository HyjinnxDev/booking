import type { APIRoute } from 'astro';
import { getPrimaryCoach } from '../../lib/coach';
import { sendCancellation } from '../../lib/email';

// Booking creation lives in /book (guest + member flow). This endpoint only
// handles a member cancelling their own booking.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/login?next=/bookings');

  const form = await request.formData();
  if (form.get('action') !== 'cancel') return redirect('/bookings');

  const id = String(form.get('id') ?? '');
  const { data, error } = await locals.supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('client_id', user.id)
    .eq('status', 'confirmed')
    .select('id, start_at, end_at, notes, ics_sequence')
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
        sequence: data.ics_sequence ?? 0,
      });
    } catch (e) {
      console.error('cancellation email failed', e);
    }
  }

  return redirect('/bookings?cancelled=1');
};
