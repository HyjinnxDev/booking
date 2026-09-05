import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { sendBroadcast } from '../../lib/email';
import { logAudit } from '../../lib/audit';

const BACK = '/admin/broadcast';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (locals.profile?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const me = locals.user!.id;

  const form = await request.formData();
  const audience = String(form.get('audience') ?? '') === 'coaches' ? 'coaches' : 'clients';
  const subject = String(form.get('subject') ?? '').trim().slice(0, 120);
  const body = String(form.get('body') ?? '').trim().slice(0, 5000);
  if (!subject || !body) return redirect(`${BACK}?error=${encodeURIComponent('Subject and message are required.')}`);

  const admin = createSupabaseAdmin();
  const { data: rows } = await admin
    .from('profiles')
    .select('email')
    .in('role', audience === 'coaches' ? ['coach', 'admin'] : ['client']);
  const emails = [...new Set((rows ?? []).map((r) => r.email).filter(Boolean))];

  // ponytail: sequential, no batching/queue. Fine at club scale; move to
  // Resend's batch send if the list grows into the hundreds.
  let ok = 0;
  for (const to of emails) {
    try {
      await sendBroadcast({ to, subject, body });
      ok++;
    } catch (e) {
      console.error('broadcast send failed', to, e);
    }
  }

  await logAudit(me, 'broadcast.send', { audience, subject, recipients: ok });
  return redirect(`${BACK}?sent=${ok}`);
};
