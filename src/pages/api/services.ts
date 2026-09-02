import type { APIRoute } from 'astro';
import { parsePrice } from '../../lib/format';

const STAFF = new Set(['coach', 'admin']);
const BACK = '/coach/services';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, profile, supabase } = locals;
  if (!user || !STAFF.has(profile?.role ?? '')) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const fail = (msg: string) => redirect(`${BACK}?error=${encodeURIComponent(msg)}`);

  switch (action) {
    case 'type.create': {
      const name = s('name').slice(0, 80);
      const kind = s('kind');
      if (!name || (kind !== 'appointment' && kind !== 'class')) return fail('Name and kind are required.');
      const { data, error } = await supabase
        .from('session_types')
        .insert({ coach_id: user.id, name, blurb: s('blurb').slice(0, 300) || null, kind })
        .select('id')
        .single();
      if (error) return fail(error.message);
      // A class always has exactly one variant — seed it so the coach just edits.
      if (kind === 'class') {
        await supabase.from('session_variants').insert({
          session_type_id: data.id,
          name: 'Session',
          duration_min: 60,
          price_cents: 0,
          capacity: 8,
        });
      }
      return redirect(BACK);
    }

    case 'type.update': {
      const { error } = await supabase
        .from('session_types')
        .update({
          name: s('name').slice(0, 80) || 'Untitled',
          blurb: s('blurb').slice(0, 300) || null,
          active: form.get('active') === 'on',
        })
        .eq('id', s('id'));
      if (error) return fail(error.message);
      return redirect(BACK);
    }

    case 'type.delete': {
      await supabase.from('session_types').delete().eq('id', s('id'));
      return redirect(BACK);
    }

    case 'variant.add': {
      const typeId = s('session_type_id');
      const name = s('name').slice(0, 60);
      const duration = Number(form.get('duration_min'));
      const capacity = Number(form.get('capacity') || 1);
      const price = parsePrice(s('price'));
      if (!name || !Number.isInteger(duration) || duration < 5 || duration > 480) {
        return fail('Option needs a name and a duration between 5 and 480 minutes.');
      }
      if (!Number.isInteger(capacity) || capacity < 1) return fail('Capacity must be at least 1.');
      const { error } = await supabase.from('session_variants').insert({
        session_type_id: typeId,
        name,
        duration_min: duration,
        price_cents: price,
        capacity,
      });
      if (error) return fail(error.message);
      return redirect(BACK);
    }

    case 'variant.update': {
      const name = s('name').slice(0, 60);
      const duration = Number(form.get('duration_min'));
      const capacity = Number(form.get('capacity') || 1);
      const price = parsePrice(s('price'));
      if (!name || !Number.isInteger(duration) || duration < 5 || duration > 480) {
        return fail('Option needs a name and a duration between 5 and 480 minutes.');
      }
      if (!Number.isInteger(capacity) || capacity < 1) return fail('Capacity must be at least 1.');
      const { error } = await supabase
        .from('session_variants')
        .update({ name, duration_min: duration, price_cents: price, capacity })
        .eq('id', s('id'));
      if (error) return fail(error.message);
      return redirect(BACK);
    }

    case 'variant.delete': {
      await supabase.from('session_variants').delete().eq('id', s('id'));
      return redirect(BACK);
    }

    default:
      return redirect(BACK);
  }
};
