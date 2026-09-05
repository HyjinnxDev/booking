import type { APIRoute } from 'astro';
import { logAudit } from '../../lib/audit';

const BACK = '/admin/settings';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { profile, supabase, user } = locals;
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const fail = (msg: string) => redirect(`${BACK}?error=${encodeURIComponent(msg)}`);

  switch (action) {
    case 'location.create': {
      const name = s('name').slice(0, 80);
      if (!name) return fail('Name is required.');
      const { error } = await supabase.from('locations').insert({
        name,
        address: s('address').slice(0, 300) || null,
        timezone: s('timezone') || 'Australia/Adelaide',
      });
      if (error) return fail(error.message);
      await logAudit(user!.id, 'location.create', { name });
      return redirect(BACK);
    }

    case 'location.update': {
      const { error } = await supabase
        .from('locations')
        .update({
          name: s('name').slice(0, 80) || 'Untitled',
          address: s('address').slice(0, 300) || null,
          timezone: s('timezone') || 'Australia/Adelaide',
          active: form.get('active') === 'on',
        })
        .eq('id', s('id'));
      if (error) return fail(error.message);
      await logAudit(user!.id, 'location.update', { id: s('id') });
      return redirect(BACK);
    }

    case 'location.delete': {
      const { error } = await supabase.from('locations').delete().eq('id', s('id'));
      if (error) return fail('That location is still used by a session type. Move those first.');
      await logAudit(user!.id, 'location.delete', { id: s('id') });
      return redirect(BACK);
    }

    default:
      return redirect(BACK);
  }
};
