import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { createSupabaseAdmin } from '../../lib/supabase';
import { weeklySeries } from '../../lib/sessions';
import { BUSINESS_TZ, SERIES_WEEKS } from '../../lib/config';
import { addDaysStr, todayStr } from '../../lib/format';

const STAFF = new Set(['coach', 'admin']);
const BACK = '/coach/schedule';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, profile } = locals;
  if (!user || !STAFF.has(profile?.role ?? '')) return new Response('Forbidden', { status: 403 });

  const db = createSupabaseAdmin();
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const fail = (msg: string) => redirect(`${BACK}?error=${encodeURIComponent(msg)}`);

  // Cancel a class + release its seats. ponytail: no attendee email yet — the
  // coach works the roster manually. Wire class-aware email when it stings.
  async function cancelBookingsFor(occIds: string[]) {
    if (occIds.length === 0) return;
    await db
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('class_occurrence_id', occIds)
      .eq('status', 'confirmed');
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
        .eq('coach_id', user.id)
        .maybeSingle();
      if (!type || type.kind !== 'class') return fail('Unknown class type.');
      const variant = (type.session_variants as any[]).find((v) => v.active) ?? type.session_variants[0];
      if (!variant) return fail('That class has no option configured.');

      const repeat = form.get('repeat') === 'on';
      let rows: { start_at: string; end_at: string }[];
      if (repeat) {
        const maxUntil = addDaysStr(todayStr(), SERIES_WEEKS * 7);
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
          coach_id: user.id,
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
        .eq('coach_id', user.id)
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
        .eq('coach_id', user.id)
        .eq('status', 'scheduled')
        .gte('start_at', new Date().toISOString())
        .select('id');
      await cancelBookingsFor((data ?? []).map((r) => r.id));
      return redirect(BACK);
    }

    case 'booking.pay': {
      const to = s('to') === 'paid' ? 'paid' : 'unpaid';
      await db
        .from('bookings')
        .update({ payment_status: to })
        .eq('id', s('id'))
        .eq('coach_id', user.id)
        .neq('payment_status', 'free');
      return redirect(s('back') || '/coach');
    }

    default:
      return redirect(BACK);
  }
};
