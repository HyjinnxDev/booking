import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';

const STAFF = new Set(['coach', 'admin']);

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const role = locals.profile?.role ?? '';
  if (!STAFF.has(role)) return new Response('Forbidden', { status: 403 });
  const me = locals.user!.id;

  const admin = createSupabaseAdmin();
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const back = String(form.get('back') ?? '/');

  switch (action) {
    case 'note.add': {
      const clientId = String(form.get('client_id') ?? '');
      const body = String(form.get('body') ?? '').trim().slice(0, 2000);
      if (clientId && body) {
        await admin.from('client_notes').insert({ client_id: clientId, author_id: me, body });
      }
      return redirect(back);
    }

    case 'note.delete': {
      if (role === 'admin') {
        await admin.from('client_notes').delete().eq('id', String(form.get('id') ?? ''));
      }
      return redirect(back);
    }

    default:
      return redirect(back);
  }
};
