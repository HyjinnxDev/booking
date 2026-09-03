import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  // §5: bulk-email cron / class-series cancel can run long; lift the 10s default.
  adapter: vercel({ maxDuration: 60 }),
  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_SITE_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_BUSINESS_TZ: envField.string({ context: 'client', access: 'public', optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret' }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      EMAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
