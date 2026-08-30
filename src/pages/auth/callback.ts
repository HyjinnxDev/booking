import type { APIRoute } from 'astro';

// Handles the email-confirmation / magic-link redirect from Supabase.
// Not needed if "Confirm email" is disabled in Supabase Auth settings.
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const code = url.searchParams.get('code');
  if (code) {
    await locals.supabase.auth.exchangeCodeForSession(code);
  }
  return redirect(url.searchParams.get('next') || '/');
};
