import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase';
import { isEmbed } from './lib/embed';

const STAFF = new Set(['coach', 'admin']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const supabase = createSupabaseServer(ctx);
  ctx.locals.supabase = supabase;
  ctx.locals.embed = isEmbed(ctx.request, ctx.url);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  ctx.locals.user = user ?? null;
  ctx.locals.profile = null;

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, name, email, phone')
      .eq('id', user.id)
      .maybeSingle();
    ctx.locals.profile = (data as App.Locals['profile']) ?? null;
  }

  const path = ctx.url.pathname;
  const role = ctx.locals.profile?.role ?? '';

  if (path.startsWith('/coach')) {
    if (!user) return ctx.redirect(`/login?next=${encodeURIComponent(path)}`);
    if (!STAFF.has(role)) return new Response('Forbidden', { status: 403 });
  }

  if (path.startsWith('/admin')) {
    if (!user) return ctx.redirect(`/login?next=${encodeURIComponent(path)}`);
    if (role !== 'admin') return new Response('Forbidden', { status: 403 });
  }

  if (path === '/bookings' && !user) {
    return ctx.redirect('/login?next=/bookings');
  }

  const res = await next();
  // Public widget pages must be framable by any site. ponytail: open to all
  // origins — scope frame-ancestors per tenant if white-label needs it.
  if (ctx.locals.embed) {
    res.headers.delete('X-Frame-Options');
    res.headers.set('Content-Security-Policy', 'frame-ancestors *');
  }
  return res;
});
