import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { createSupabaseAdmin } from '../../lib/supabase';
import { weeklySeries } from '../../lib/sessions';
import { BUSINESS_TZ } from '../../lib/config';
import { getSettings } from '../../lib/settings';
import { addDaysStr, todayStr } from '../../lib/format';
import { sendCancellation } from '../../lib/email';

const STAFF = new Set(['coach', 'admin']);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, locals, redirect, url }) => {
  const { user, profile } = locals;
  if (!user || !profile || !STAFF.has(profile.role)) return new Response('Forbidden', { status: 403 });

  const db = createSupabaseAdmin();
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const s = (k: string) => String(form.get(k) ?? '').trim();

  // An admin may act on another coach via ?coach= / coach field; a coach only on self.
  const isAdmin = profile.role === 'admin';
  const coachParam = url.searchParams.get('coach') || s('coach');
  const targetCoach = isAdmin && coachParam ? coachParam : user.id;
  const BACK = targetCoach === user.id ? '/coach/schedule' : `/coach/schedule?coach=${targetCoach}`;
  const fail = (msg: string) => redirect(`${BACK}${BACK.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);

  // Cancel a class + release its seats, then email every attendee. Email is
  // best-effort: a Resend failure is logged, never blocks the cancellation.
  async function cancelBookingsFor(occIds: string[]) {
    if (occIds.length === 0) return;

    const { data: affected } = await db
      .from('bookings')
      .select('id, notes, client:client_id ( name, email ), occ:class_occurrence_id ( start_at, end_at )')
      .in('class_occurrence_id', occIds)
      .eq('status', 'confirmed');

    await db
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('class_occurrence_id', occIds)
      .eq('status', 'confirmed');

    const coachName = profile?.name || 'your coach';
    for (const b of (affected ?? []) as any[]) {
      if (!b.client?.email || !b.occ) continue;
      try {
        await sendCancellation({
          to: b.client.email,
          clientName: b.client.name ?? '',
          coachName,
          bookingId: b.id,
          startAt: b.occ.start_at,
          endAt: b.occ.end_at,
          notes: b.notes,
        });
      } catch (e) {
        console.error('class cancellation email failed for booking', b.id, e);
      }
    }
  }

  switch (action) {
    case 'occ.create': {
      const date = s('date');
      const time = s('time');
      const capacity = Number(form.get('capacity'));
      if (!DATE.test(date) || !TIME.test(time)) return fail('Pick a valid date and time.');
      if (date < todayStr()) return fail('That date is in the past.');
      if (!Number.isInteger(capacity) || capacity < 1) return fail('Capacity must be at least 1.');

      const { data: type } = await db
        .from('session_types')
        .select('id, kind, session_variants ( id, duration_min, active )')
        .eq('id', s('session_type_id'))
        .eq('coach_id', targetCoach)
        .maybeSingle();
      if (!type || type.kind !== 'class') return fail('Unknown class type.');
      const variant = (type.session_variants as any[]).find((v) => v.active) ?? type.session_variants[0];
      if (!variant) return fail('That class has no option configured.');

      const repeat = form.get('repeat') === 'on';
      let rows: { start_at: string; end_at: string }[];
      if (repeat) {
        const maxUntil = addDaysStr(todayStr(), (await getSettings()).seriesWeeks * 7);
        let until = s('until');
        if (!DATE.test(until) || until > maxUntil) until = maxUntil;
        if (until < date) return fail('"Repeat until" is before the start date.');
        rows = weeklySeries(date, time, variant.duration_min, until);
      } else {
        const start = fromZonedTime(`${date}T${time}:00`, BUSINESS_TZ);
        rows = [
          { start_at: start.toISOString(), end_at: new Date(start.getTime() + variant.duration_min * 60_000).toISOString() },
        ];
      }

      const seriesId = repeat ? randomUUID() : null;
      const { error } = await db.from('class_occurrences').insert(
        rows.map((r) => ({
          session_variant_id: variant.id,
          coach_id: targetCoach,
          start_at: r.start_at,
          end_at: r.end_at,
          capacity,
          series_id: seriesId,
        })),
      );
      if (error) return fail(error.message);
      return redirect(`${BACK}?added=${rows.length}`);
    }

    case 'occ.cancel': {
      const id = s('id');
      const { data } = await db
        .from('class_occurrences')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('coach_id', targetCoach)
        .eq('status', 'scheduled')
        .select('id')
        .maybeSingle();
      if (data) await cancelBookingsFor([data.id]);
      return redirect(BACK);
    }

    case 'series.cancel': {
      const seriesId = s('series_id');
      const { data } = await db
        .from('class_occurrences')
        .update({ status: 'cancelled' })
        .eq('series_id', seriesId)
        .eq('coach_id', targetCoach)
        .eq('status', 'scheduled')
        .gte('start_at', new Date().toISOString())
        .select('id');
      await cancelBookingsFor((data ?? []).map((r) => r.id));
      return redirect(BACK);
    }

    case 'booking.pay': {
      const to = s('to') === 'paid' ? 'paid' : 'unpaid';
      let q = db.from('bookings').update({ payment_status: to }).eq('id', s('id')).neq('payment_status', 'free');
      if (!isAdmin) q = q.eq('coach_id', user.id);
      await q;
      return redirect(s('back') || '/coach');
    }

    case 'booking.noshow': {
      let q = db.from('bookings').update({ status: 'no_show' }).eq('id', s('id')).eq('status', 'confirmed');
      if (!isAdmin) q = q.eq('coach_id', user.id);
      await q;
      return redirect(s('back') || '/coach');
    }

    default:
      return redirect(BACK);
  }
};
