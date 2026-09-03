import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { tempPassword } from '../../lib/accounts';
import { sendStaffWelcome } from '../../lib/email';

const BACK = '/admin/staff';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (locals.profile?.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const admin = createSupabaseAdmin();
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const fail = (msg: string) => redirect(`${BACK}?error=${encodeURIComponent(msg)}`);

  switch (action) {
    case 'staff.create': {
      const name = s('name').slice(0, 80);
      const email = s('email').toLowerCase();
      if (!name || !EMAIL_RE.test(email)) return fail('A name and a valid email are required.');

      // Reuse an existing account (e.g. a past guest booker) or make a new one.
      const { data: existing } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle();
      let id = existing?.id as string | undefined;
      let tempPass: string | undefined;
      if (!id) {
        tempPass = tempPassword();
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: tempPass,
          email_confirm: true,
          user_metadata: { name },
        });
        if (error || !data.user) return fail(error?.message ?? 'Could not create the account.');
        id = data.user.id;
      }

      // Promote to coach through the admin's own session so lock_role() allows it.
      const { error: roleErr } = await locals.supabase
        .from('profiles')
        .update({ role: 'coach' })
        .eq('id', id);
      if (roleErr) return fail(roleErr.message);
      await admin.from('profiles').update({ name, active: true }).eq('id', id);

      const locs = form.getAll('location_id').map(String).filter(Boolean);
      if (locs.length) {
        await admin.from('staff_locations').insert(locs.map((location_id) => ({ staff_id: id, location_id })));
      }

      if (tempPass) {
        try {
          await sendStaffWelcome({ to: email, name, tempPassword: tempPass });
        } catch (e) {
          console.error('staff welcome email failed', e);
        }
      }
      return redirect(`${BACK}?created=1`);
    }

    case 'staff.locations': {
      const staffId = s('staff_id');
      const locs = form.getAll('location_id').map(String).filter(Boolean);
      await admin.from('staff_locations').delete().eq('staff_id', staffId);
      if (locs.length) {
        await admin.from('staff_locations').insert(locs.map((location_id) => ({ staff_id: staffId, location_id })));
      }
      return redirect(BACK);
    }

    case 'staff.active': {
      await admin
        .from('profiles')
        .update({ active: form.get('to') === 'true' })
        .eq('id', s('staff_id'))
        .eq('role', 'coach');
      return redirect(BACK);
    }

    default:
      return redirect(BACK);
  }
};
