import type { APIRoute } from 'astro';

// Join or leave a class waitlist. Members only — we need an address to notify.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  const form = await request.formData();
  const occId = String(form.get('occ') ?? '');
  const action = String(form.get('action') ?? '');
  const typeId = String(form.get('type') ?? '');
  const back = typeId ? `/s/${typeId}` : '/';

  if (!user) return redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!occId) return redirect(back);

  if (action === 'leave') {
    await locals.supabase.from('waitlist').delete().eq('class_occurrence_id', occId).eq('client_id', user.id);
    return redirect(`${back}?waitlist=off`);
  }

  // join — unique index makes a repeat join a no-op
  const { error } = await locals.supabase
    .from('waitlist')
    .insert({ class_occurrence_id: occId, client_id: user.id });
  if (error && error.code !== '23505') return redirect(`${back}?error=waitlist`);
  return redirect(`${back}?waitlist=on`);
};
