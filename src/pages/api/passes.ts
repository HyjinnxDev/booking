import type { APIRoute } from 'astro';
import { parsePrice } from '../../lib/format';
import { findOrCreateClient } from '../../lib/accounts';

const BACK = '/admin/passes';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { profile, supabase } = locals;
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const fail = (msg: string) => redirect(`${BACK}?error=${encodeURIComponent(msg)}`);

  if (action === 'pass.void') {
    await supabase.from('passes').update({ status: 'void' }).eq('id', s('id'));
    return redirect(BACK);
  }

  if (action === 'pass.issue') {
    const email = s('client_email').toLowerCase();
    const clientName = s('client_name').slice(0, 80);
    const name = s('name').slice(0, 80);
    const total = Number(form.get('total'));
    if (!EMAIL_RE.test(email) || !clientName) return fail('Client name and a valid email are required.');
    if (!name) return fail('Give the pass a name (e.g. "10-class pack").');
    if (!Number.isInteger(total) || total < 1 || total > 100) return fail('Sessions must be 1–100.');

    let clientId: string;
    try {
      const acct = await findOrCreateClient({ email, name: clientName, phone: null });
      clientId = acct.id;
    } catch {
      return fail('Could not find or create that client.');
    }

    const { error } = await supabase.from('passes').insert({
      client_id: clientId,
      session_type_id: s('session_type_id') || null,
      name,
      total,
      price_cents: parsePrice(s('price')),
      expires_at: s('expires_at') || null,
    });
    if (error) return fail(error.message);
    return redirect(`${BACK}?issued=1`);
  }

  return redirect(BACK);
};
