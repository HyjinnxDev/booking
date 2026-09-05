import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';

const STAFF = new Set(['coach', 'admin']);

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const role = locals.profile?.role ?? '';
  if (!STAFF.has(role)) return new Response('Forbidden', { status: 403 });
  const me = locals.user!.id;

  const form = await request.formData();
  const coachId = String(form.get('coach_id') ?? me);
  // A coach may only edit themselves; an admin may edit any coach.
  if (coachId !== me && role !== 'admin') return new Response('Forbidden', { status: 403 });

  const back = coachId === me ? '/coach/profile' : `/coach/profile?coach=${coachId}`;
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const phone = String(form.get('phone') ?? '').trim().slice(0, 40);
  const bio = String(form.get('bio') ?? '').trim().slice(0, 600);
  if (!name) return redirect(`${back}?error=${encodeURIComponent('Name is required.')}`);

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from('profiles')
    .update({ name, phone: phone || null, bio: bio || null })
    .eq('id', coachId);
  if (error) return redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  return redirect(`${back}?saved=1`);
};
