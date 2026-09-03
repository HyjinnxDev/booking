import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { findOrCreateClient } from '../../lib/accounts';
import { sendSetPassword } from '../../lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Join or leave a class waitlist. §3.10: guests can join with just name + email,
// same shape as a guest booking.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  const form = await request.formData();
  const occId = String(form.get('occ') ?? '');
  const action = String(form.get('action') ?? '');
  const typeId = String(form.get('type') ?? '');
  const back = typeId ? `/s/${typeId}` : '/';

  if (!occId) return redirect(back);
  const db = createSupabaseAdmin();

  if (action === 'leave') {
    if (user) {
      await db.from('waitlist').delete().eq('class_occurrence_id', occId).eq('client_id', user.id);
    }
    return redirect(`${back}?waitlist=off`);
  }

  let clientId: string;
  if (user) {
    clientId = user.id;
  } else {
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const name = String(form.get('name') ?? '').trim().slice(0, 80);
    if (!name || !EMAIL_RE.test(email)) return redirect(`${back}?error=waitlist`);
    try {
      const acct = await findOrCreateClient({ email, name, phone: null });
      clientId = acct.id;
      if (acct.setPasswordUrl) {
        try {
          await sendSetPassword({ to: email, name, link: acct.setPasswordUrl, kind: 'welcome' });
        } catch (e) {
          console.error('waitlist welcome email failed', e);
        }
      }
    } catch {
      return redirect(`${back}?error=waitlist`);
    }
  }

  // unique index makes a repeat join a no-op
  const { error } = await db.from('waitlist').insert({ class_occurrence_id: occId, client_id: clientId });
  if (error && error.code !== '23505') return redirect(`${back}?error=waitlist`);
  return redirect(`${back}?waitlist=on`);
};
