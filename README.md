# TechniCourt Bookings

Tennis-coaching booking system. Astro (SSR) + Supabase + Resend, on Vercel at
`bookings.technicourt.com`.

## Stack

- Astro `output: 'server'` with `@astrojs/vercel` (region `syd1`)
- Supabase — Postgres, Auth (email + password), RLS
- Resend — transactional email; per-booking `.ics` + Google Calendar links
- Tailwind v4 via `@tailwindcss/vite`
- Vercel Cron — daily reminders + weekly-series top-up (Hobby: 2 crons max)
- Zero client-side JS framework. Full-page loads; a tiny inline script does
  press feedback and iframe resize.

## What it does

- **Public booking** (`/`): appointments (1:1, an option per length/price) and
  classes (dated group sessions, one-off or weekly). Multi-coach services group
  into one offering at `/g/<slug>` — pick a coach or take the first opening
  (round-robin).
- **Manage without logging in** (`/m/<id>`): the booking id is the capability
  token. Reschedule (appointments) + cancel, gated by one lock =
  `max(min-notice, cancel-cutoff)`. Guests land here after booking.
- **Accounts**: guests get one automatically; a "set a password" link (our own
  Resend email, not Supabase SMTP) covers welcome, `/forgot`, and
  `/account/password`.
- **Client area** (`/bookings`): upcoming/past, passes, edit name/phone,
  set password.
- **Coach console** (`/coach`): agenda, class rosters, mark-paid, no-show
  (only after start), walk-in booking, weekly hours + "copy Monday",
  time off (any interval), session types + options + intake questions,
  class scheduling + edit, embeddable widgets, ICS feed (rotatable token).
- **Admin console** (`/admin`): all-coach agenda, client search, unpaid chase
  list + CSV export, staff (add coaches, "I also coach" for admins,
  deactivate), locations, passes, org settings, embed builder.
- **Email**: confirmation / reschedule / reassignment / cancellation /
  reminder to the client (HTML + text, escaped, `.ics` with a 1h alarm,
  Google Calendar link, maps link); **coach notice** on every booking event;
  a daily "tomorrow's agenda" to each coach.
- **Waitlist**: join a full class (guests too); a freed seat emails everyone
  still waiting; booking a seat leaves the list.

## Environment variables

See `.env.example`. All required.

| Var | Where | Notes |
|---|---|---|
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` | client + server | project + anon key |
| `PUBLIC_SITE_URL` | client + server | used in emails, ICS, recovery links |
| `PUBLIC_BUSINESS_TZ` | client + server | IANA tz; slot generation + display |
| `SUPABASE_SERVICE_ROLE_KEY` | server | bypasses RLS; all booking/catalog writes go through it |
| `RESEND_API_KEY` | server | Resend API key |
| `EMAIL_FROM` | server | `TechniCourt <bookings@technicourt.com>` — domain verified in Resend |
| `CRON_SECRET` | server + Vercel | Vercel Cron sends it as a Bearer token. If unset, `/api/cron/*` return 401 (closed, not open). |

## Setup

1. **Supabase** → run `supabase/migrations/*` in order (`supabase db push` or
   the SQL editor).
2. **Auth** → enable Email provider. "Confirm email" can stay off (guest
   accounts are pre-confirmed). If on, add `<PUBLIC_SITE_URL>/auth/callback`
   to Auth → URL Configuration → Redirect URLs. Point Auth → SMTP at Resend so
   any Supabase-originated mail isn't rate-limited. Turn on
   **Leaked password protection** (Auth → Policies).
3. **First admin** (after they've signed up in the app):
   ```sql
   update public.profiles set role = 'admin', active = false
   where email = 'you@example.com';
   ```
   `active = false` = "administers but doesn't take bookings"; flip it with the
   "I also coach" button on `/admin/staff`. Admins then add coaches from that
   page (each gets a set-password email).
4. **Resend** → verify the sending domain, create an API key.
5. **Vercel** → set every env var incl. `CRON_SECRET`, deploy. `vercel.json`
   registers the crons and a 60s function timeout.

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
npm run check   # astro check (types)
npm test        # vitest — slots/DST, intake, embed, offering slugs, series top-up
```

Node ≥ 22.19.

## Notes

- `bookings` has a GiST exclusion constraint
  `(coach_id, tstzrange(start_at, end_at)) WHERE status='confirmed' AND class_occurrence_id IS NULL`
  — real overlap protection. Violations are **23P01** (handled alongside 23505).
- Class capacity is a `before insert` trigger that row-locks the occurrence;
  overfill / a second seat raise 23505.
- Payments in person: a paid session books at `payment_status='unpaid'` and the
  coach ticks "Mark paid" (Stripe deferred).
- All timestamps are UTC; `PUBLIC_BUSINESS_TZ` is display + slot generation only.
- RLS lets clients *read* their own data and edit only `profiles(name, phone)`.
  No client writes to `bookings` — the REST surface can't bypass booking rules.

See `ROADMAP.md`.
