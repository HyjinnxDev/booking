import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase';

const STAFF = new Set(['coach', 'admin']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const supabase = createSupabaseServer(ctx);
  ctx.locals.supabase = supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  ctx.locals.user = user ?? null;
  ctx.locals.profile = null;

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, name, email')
      .eq('id', user.id)
      .maybeSingle();
    ctx.locals.profile = (data as App.Locals['profile']) ?? null;
  }

  const path = ctx.url.pathname;

  if (path.startsWith('/coach')) {
    if (!user) return ctx.redirect(`/login?next=${encodeURIComponent(path)}`);
    if (!STAFF.has(ctx.locals.profile?.role ?? '')) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  if (path === '/bookings' && !user) {
    return ctx.redirect('/login?next=/bookings');
  }

  return next();
});
