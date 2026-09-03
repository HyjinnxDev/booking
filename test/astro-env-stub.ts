// Stand-in for Astro's `astro:env/*` virtual modules under vitest, so pure-logic
// modules that transitively import them (sessions.ts -> supabase.ts) can be
// unit-tested without the Astro build pipeline.
export const PUBLIC_SUPABASE_URL = 'http://localhost';
export const PUBLIC_SUPABASE_ANON_KEY = 'anon';
export const PUBLIC_SITE_URL = 'http://localhost';
export const PUBLIC_BUSINESS_TZ = 'Australia/Adelaide';
export const SUPABASE_SERVICE_ROLE_KEY = 'service';
export const RESEND_API_KEY = 're_test';
export const EMAIL_FROM = '';
export const CRON_SECRET = 'test';
