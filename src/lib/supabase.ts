import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from 'astro:env/client';
import { SUPABASE_SERVICE_ROLE_KEY } from 'astro:env/server';
import type { AstroCookies } from 'astro';

/** Request-scoped client bound to the user's auth cookies. Subject to RLS. */
export function createSupabaseServer(ctx: { request: Request; cookies: AstroCookies }): SupabaseClient {
  return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(ctx.request.headers.get('Cookie') ?? '').map((c) => ({
          name: c.name,
          value: c.value ?? '',
        }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => ctx.cookies.set(name, value, options));
      },
    },
  });
}

/** Service-role client. Bypasses RLS — server only, never expose to the browser. */
export function createSupabaseAdmin(): SupabaseClient {
  return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
