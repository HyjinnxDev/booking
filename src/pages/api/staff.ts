import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { createSupabaseAdmin } from '../../lib/supabase';
import { recoveryLink } from '../../lib/accounts';
import { sendSetPassword } from '../../lib/email';

const BACK = '/admin/staff';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (locals.profile?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const me = locals.user!.id;

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
      const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
      let id = existing?.id as string | undefined;
      let isNew = false;
      if (!id) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: randomBytes(24).toString('hex'), // discarded, coach sets their own
          email_confirm: true,
          user_metadata: { name },
        });
        if (error || !data.user) return fail(error?.message ?? 'Could not create the account.');
        id = data.user.id;
        isNew = true;
      }

      // §1.11: lock_role() now allows a null auth.uid() (service role), so the
      // admin client can promote directly like every other staff write.
      // §3.6: don't demote an existing admin to coach. Just make them bookable.
      const { data: cur } = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
      const patch: Record<string, unknown> = { name, active: true };
      if (cur?.role !== 'admin') patch.role = 'coach';
      const { error: roleErr } = await admin.from('profiles').update(patch).eq('id', id);
      if (roleErr) return fail(roleErr.message);

      const locs = form.getAll('location_id').map(String).filter(Boolean);
      if (locs.length) {
        await admin.from('staff_locations').insert(locs.map((location_id) => ({ staff_id: id, location_id })));
      }

      if (isNew) {
        try {
          const link = await recoveryLink(email, '/coach');
          if (link) await sendSetPassword({ to: email, name, link, kind: 'coach' });
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
      // For a coach this is "deactivate"; for an admin it's the "I also coach" toggle (§3.6).
      await admin
        .from('profiles')
        .update({ active: form.get('to') === 'true' })
        .eq('id', s('staff_id'))
        .in('role', ['coach', 'admin']);
      return redirect(BACK);
    }

    case 'staff.delete': {
      const staffId = s('staff_id');
      if (!staffId || staffId === me) return fail("Can't delete your own account.");
      // profiles.id references auth.users on delete cascade, so this also drops
      // their session types, availability, staff_locations, etc. bookings stays
      // on delete restrict (§4.11), so anyone with booking history, past or
      // upcoming, can't be deleted here; deactivate them instead.
      const { error } = await admin.auth.admin.deleteUser(staffId);
      if (error) {
        const hasHistory = /foreign key|violat/i.test(error.message);
        return fail(hasHistory ? "Has booking history and can't be deleted. Deactivate them instead." : error.message);
      }
      return redirect(`${BACK}?deleted=1`);
    }

    default:
      return redirect(BACK);
  }
};
