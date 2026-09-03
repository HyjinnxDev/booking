import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase';
import { isEmbed } from './lib/embed';
import { safeNext } from './lib/url';

const STAFF = new Set(['coach', 'admin']);

// Pages that are legitimately embeddable in a third-party site (the booking flow).
// Everything else (/admin, /coach, /login, /bookings) must stay same-origin only.
const EMBEDDABLE = /^\/(s\/|g\/|book|m\/|$)/;

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
      .select('id, role, name, email, phone, active')
      .eq('id', user.id)
      .maybeSingle();
    ctx.locals.profile = (data as App.Locals['profile']) ?? null;
  }

  const path = ctx.url.pathname;
  const role = ctx.locals.profile?.role ?? '';

  // §3.12: a deactivated coach can't reach the console.
  if (
    ctx.locals.profile &&
    ctx.locals.profile.active === false &&
    role === 'coach' &&
    (path.startsWith('/coach') || path.startsWith('/admin'))
  ) {
    await supabase.auth.signOut();
    return ctx.redirect('/login?inactive=1');
  }

  if (path.startsWith('/coach')) {
    if (!user) return ctx.redirect(`/login?next=${encodeURIComponent(path)}`);
    if (!STAFF.has(role)) return new Response('Forbidden', { status: 403 });
  }

  if (path.startsWith('/admin')) {
    if (!user) return ctx.redirect(`/login?next=${encodeURIComponent(path)}`);
    if (role !== 'admin') return new Response('Forbidden', { status: 403 });
  }

  if ((path === '/bookings' || path.startsWith('/account')) && !user) {
    return ctx.redirect(`/login?next=${encodeURIComponent(safeNext(path))}`);
  }

  const res = await next();

  // §1.7: baseline headers on every response.
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Only the booking flow may be framed by other origins; lock everything else
  // to same-origin. (X-Frame-Options is never set elsewhere, so the old delete
  // was a no-op and non-embed pages were framable.)
  const framable = ctx.locals.embed && EMBEDDABLE.test(path);
  res.headers.set('Content-Security-Policy', `frame-ancestors ${framable ? '*' : "'self'"}`);
  if (!framable) res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  else res.headers.delete('X-Frame-Options');

  return res;
});
