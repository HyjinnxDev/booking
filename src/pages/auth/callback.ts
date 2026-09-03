import type { APIRoute } from 'astro';
import { safeNext } from '../../lib/url';
import type { EmailOtpType } from '@supabase/supabase-js';

// Handles both auth redirect shapes:
//  - PKCE / magic-link:  ?code=...            -> exchangeCodeForSession
//  - recovery / invite:  ?token_hash=&type=   -> verifyOtp   (§3.1)
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const next = safeNext(url.searchParams.get('next'), '/');
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (code) {
    await locals.supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return redirect('/login?next=' + encodeURIComponent(next) + '&expired=1');
  }
  return redirect(next);
};
