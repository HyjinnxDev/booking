# TechniCourt Bookings

Tennis coaching booking system. Astro (SSR) + Supabase + Resend, deployed to
Vercel at `bookings.technicourt.com`.

## Stack

- Astro `output: 'server'` with `@astrojs/vercel`
- Supabase — Postgres, Auth (email + password), RLS
- Resend — transactional email with per-booking `.ics`
- Tailwind v4 via `@tailwindcss/vite`
- Vercel Cron — daily 24h reminders

## v1 features

- Client sign-up / login
- Booking page: pick a date, see one coach's open slots, book one
- Client: view + cancel own bookings
- Coach dashboard (role-gated): upcoming bookings, weekly availability, blackout dates
- Per-coach read-only ICS feed at `/cal/<token>.ics` (webcal subscription)
- Confirmation + cancellation email, each with an `.ics` attachment
- `/api/cron/reminders` — emails reminders for bookings in the next 24h

## Environment variables

See `.env.example`. All are required.

| Var | Where | Notes |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key |
| `PUBLIC_SITE_URL` | client + server | `https://bookings.technicourt.com` — used in emails + ICS feed URLs |
| `PUBLIC_BUSINESS_TZ` | client + server | IANA tz, e.g. `Australia/Sydney`. Slot generation + display. |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Bypasses RLS. Slot computation, ICS feed, cron. |
| `RESEND_API_KEY` | server | Resend API key |
| `EMAIL_FROM` | server | `TechniCourt <bookings@technicourt.com>` — domain must be verified in Resend |
| `CRON_SECRET` | server + Vercel | Random string. Vercel Cron sends it as a Bearer token. |

## Setup

1. **Supabase project** → run the files in `supabase/migrations/` in order (SQL
   editor, or `supabase db push`).
2. **Supabase Auth** → Providers → Email: enable. For the fastest v1, turn
   **Confirm email** OFF. (If left on, `/auth/callback` handles the link and you
   must add `https://bookings.technicourt.com/auth/callback` to
   Auth → URL Configuration → Redirect URLs.)
3. **Create the coach**: have them sign up in the app, then edit
   `supabase/seed.sql` with their email and run it (promotes to `coach`, adds
   default availability).
4. **Resend** → verify the `technicourt.com` sending domain, create an API key.
5. **Vercel** → set all env vars, set `CRON_SECRET`, deploy. `vercel.json`
   registers the daily cron (`0 8 * * *` UTC).
6. Point `bookings.technicourt.com` at the Vercel project.

## Local dev

```bash
cp .env.example .env    # fill in real values
npm install
npm run dev
npm test                # slot / DST logic
```

Node ≥ 22.19 (Astro engine requirement).

## Notes / deviations

- `bookings` uses a **partial** unique index `(coach_id, start_at) WHERE status =
  'confirmed'` instead of a plain `UNIQUE`, so a cancelled slot can be re-booked.
  Race safety is unchanged — concurrent confirmed inserts still collide (23505).
- Clients can update only `bookings.status` (column grant), and RLS only lets
  them set it to `cancelled`. No reschedule in v1 (cancel + rebook).
- One coach in v1. `getPrimaryCoach()` = earliest coach profile. Multi-coach
  selection UI is v2; the schema already carries `coach_id` throughout.
- Slot length is a fixed 60 min (`SLOT_MINUTES`).
- Emails and the ICS feed are best-effort: a Resend failure is logged, not
  surfaced to the user, and never blocks a booking.
