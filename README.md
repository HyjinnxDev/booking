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
- Session types: **appointments** (1:1, one option per length/price) and
  **classes** (dated group sessions with a seat count, one-off or weekly)
- Booking page: pick a session type → an appointment option + time, or a class seat
- Client: view + cancel own bookings
- Coach dashboard (role-gated): appointment list, class rosters, mark-paid,
  weekly availability, blackout dates
- Coach: `/coach/services` (session types + options), `/coach/schedule` (class sessions)
- Per-coach read-only ICS feed at `/cal/<token>.ics` (webcal subscription)
- Confirmation + cancellation email, each with an `.ics` attachment
- `/api/cron/reminders` — emails reminders for bookings in the next 24h

## Since v1 (branch `feature/platform-buildout`)

- `org_id` on every table (single-org seam for white-label; RLS not scoped yet)
- **Manage a booking without logging in** (`/m/<id>`) — the booking id is the link
  token; reschedule (appointments) + cancel, from the confirmation email or `/bookings`
- Class cancellation now **emails every attendee**
- **Min notice** (`MIN_NOTICE_MIN`, 120 min) enforced server-side, not just hidden in the UI
- **Multiple locations** — `/coach/locations`, each session type has a location
  (per-location timezone is stored but slot generation still uses `PUBLIC_BUSINESS_TZ`)
- **Class waitlist** — join a full class; a freed seat emails every waitlister
- Second cron `/api/cron/topup` — extends weekly class series to `SERIES_WEEKS` ahead
- `resources` (courts) table + conflict constraints exist but aren't wired to booking yet

See `ROADMAP.md` for what's next and the open flags.

## Environment variables

See `.env.example`. All are required.

| Var | Where | Notes |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key |
| `PUBLIC_SITE_URL` | client + server | `https://bookings.technicourt.com` — used in emails + ICS feed URLs |
| `PUBLIC_BUSINESS_TZ` | client + server | IANA tz, e.g. `Australia/Adelaide`. Slot generation + display. |
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
- Appointment start times step on a fixed `SLOT_STEP_MIN` (30) grid; each
  session option sets its own length. A booked appointment or a scheduled class
  blocks every overlapping grid start.
- Recurring classes are **materialised** `SERIES_WEEKS` (12) ahead when scheduled
  — no RRULE, no auto top-up. The coach re-runs the form to extend.
- Payments are v2: a paid session books immediately at `payment_status = 'unpaid'`
  and the coach ticks "Mark paid" (cash/card in person). Price-0 → `'free'`.
- Class capacity is enforced by a `before insert` trigger that row-locks the
  occurrence; concurrent overfill / a client's second seat get SQLSTATE 23505.
- Cancelling a class (occurrence or series) releases seats **and emails every
  confirmed attendee** (best-effort). Refunds still wait for Stripe.
- Emails and the ICS feed are best-effort: a Resend failure is logged, not
  surfaced to the user, and never blocks a booking.
