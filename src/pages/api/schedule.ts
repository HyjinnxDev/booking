import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { createSupabaseAdmin } from '../../lib/supabase';
import { weeklySeries } from '../../lib/sessions';
import { BUSINESS_TZ } from '../../lib/config';
import { getSettings } from '../../lib/settings';
import { addDaysStr, todayStr } from '../../lib/format';
import { sendCancellation } from '../../lib/email';
import { pool } from '../../lib/pool';

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
      .select(
        'id, notes, client:client_id ( name, email ), occ:class_occurrence_id ( start_at, end_at, variant:session_variant_id ( type:session_types ( name, location:location_id ( name, address ) ) ) )',
      )
      .in('class_occurrence_id', occIds)
      .eq('status', 'confirmed');

    await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'staff',
      })
      .in('class_occurrence_id', occIds)
      .eq('status', 'confirmed');
    // §2.8: a cancelled occurrence has no seats to wait for.
    await db.from('waitlist').delete().in('class_occurrence_id', occIds);

    const coachName = profile?.name || 'your coach';
    // §5: send with limited concurrency instead of one-at-a-time.
    await pool((affected ?? []) as any[], 5, async (b) => {
      if (!b.client?.email || !b.occ) return;
      const t = b.occ.variant?.type;
      await sendCancellation({
        to: b.client.email,
        clientName: b.client.name ?? '',
        coachName,
        bookingId: b.id,
        startAt: b.occ.start_at,
        endAt: b.occ.end_at,
        notes: b.notes,
        typeName: t?.name,
        locationName: t?.location?.name,
        locationAddress: t?.location?.address,
      });
    });
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

    case 'occ.update': {
      // §3.9: edit a scheduled occurrence. Capacity any time; time only when no
      // confirmed bookings (moving people is a cancel-and-rebook problem).
      const id = s('id');
      const { data: occ } = await db
        .from('class_occurrences')
        .select('id, start_at, session_variant_id, variant:session_variant_id ( duration_min )')
        .eq('id', id)
        .eq('coach_id', targetCoach)
        .eq('status', 'scheduled')
        .maybeSingle();
      if (!occ) return fail('That class is no longer scheduled.');

      const capacity = Number(form.get('capacity'));
      if (!Number.isInteger(capacity) || capacity < 1) return fail('Capacity must be at least 1.');

      const { count: taken } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('class_occurrence_id', id)
        .eq('status', 'confirmed');
      if (capacity < (taken ?? 0)) return fail(`${taken} seats are already booked. Set capacity to ${taken} or more.`);

      const patch: Record<string, unknown> = { capacity };
      const date = s('date');
      const time = s('time');
      if (date && time) {
        if (!DATE.test(date) || !TIME.test(time)) return fail('Pick a valid date and time.');
        if ((taken ?? 0) > 0) return fail('This class has bookings. Cancel it and reschedule instead of moving it.');
        const dur = (occ as any).variant?.duration_min ?? 60;
        const start = fromZonedTime(`${date}T${time}:00`, BUSINESS_TZ);
        patch.start_at = start.toISOString();
        patch.end_at = new Date(start.getTime() + dur * 60_000).toISOString();
      }
      const { error } = await db.from('class_occurrences').update(patch).eq('id', id);
      if (error) return fail(error.message);
      return redirect(`${BACK}?updated=1`);
    }

    case 'cal.rotate': {
      // §3.13: revoke a leaked calendar-feed link.
      await db.from('profiles').update({ cal_token: randomUUID() }).eq('id', targetCoach);
      const q = new URLSearchParams({ calrotated: '1' });
      if (targetCoach !== user.id) q.set('coach', targetCoach);
      return redirect(`/coach?${q.toString()}`);
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
      // §2.12: can't be a no-show before the session has started.
      let q = db
        .from('bookings')
        .update({ status: 'no_show' })
        .eq('id', s('id'))
        .eq('status', 'confirmed')
        .lte('start_at', new Date().toISOString());
      if (!isAdmin) q = q.eq('coach_id', user.id);
      await q;
      return redirect(s('back') || '/coach');
    }

    default:
      return redirect(BACK);
  }
};
