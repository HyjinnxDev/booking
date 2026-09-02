# TechniCourt Bookings — Roadmap

Ranked most-needed → least. We work top-down. Check items off in place.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **WL** = only matters for white-label resale

---

## → Round 1 (done — see git log on `feature/platform-buildout`)

Stripe/online payments deferred by request — still parked in Tier 0.

1. [x] **`org_id` seam** — migration `0005`. Zero behaviour change.
2. [~] **Vercel deploy green** — region pinned to `syd1`, second cron registered.
   **BLOCKED:** env vars must be set in the Vercel dashboard (no MCP/API path). See flags below.
3. [x] **Reschedule flow** — `/reschedule` (appointments), migration `0006` adds
   `ics_sequence`, emails an `.ics` UPDATE. Verified end-to-end in the browser.
4. [x] **Class cancellation → notify** — `occ.cancel` / `series.cancel` now email every
   confirmed attendee (best-effort). Refunds wait for Stripe.
5. [x] **Recurring class top-up cron** — `/api/cron/topup`, daily `30 8 * * *`.
6. [x] **Min-notice + cutoff server-side** — `MIN_NOTICE_MIN` (120) filters slots and
   is enforced in the booking + reschedule APIs; `BOOKING_WINDOW_DAYS` checked too.
7. [x] **Multiple locations** — migration `0007`, `/coach/locations`, per-type location,
   client display. Per-location **timezone stored but not wired** into slot generation — flag.
8. [~] **Bookable resources** — migration `0008`: `resources` table + GiST `tstzrange`
   exclusion constraints (inert until `resource_id` is set). No assignment logic / slot
   integration — coupled to multi-staff, deferred. See flags.
9. [ ] **Multi-staff booking** — **NOT STARTED (YAGNI for one coach).** Schema is fully
   ready (`coach_id` + per-coach `availability` everywhere). Build the picker when a
   second coach is hired. See flags.
10. [x] **Waitlist** — migration `0009`, join/leave on a full class, `notifyWaitlist()`
    on attendee cancel, coach sees waiting counts. Verified in the browser.

## → Round 2 (next working set)

1. [ ] **Vercel env vars + first green deploy** — the one true blocker. Values are in
   local `.env`; set them Production+Preview, redeploy, confirm `bookings.technicourt.com`.
2. [ ] **Guest reschedule + magic link** — right now only logged-in clients can reschedule;
   guests (the common case) can't. Token link in the confirmation email → a no-login
   manage page (reschedule + cancel).
3. [ ] **Coach/admin reschedule + move any booking** — staff can only cancel from the
   dashboard today. Let them drag/edit a booking's time, and reschedule on a client's behalf.
4. [ ] **Customer account area** — real profile edit, full history, one-click rebook,
   receipts. `/bookings` is thin.
5. [ ] **Intake forms / booking questions** — per-service custom fields captured at
   booking, shown on the roster (injuries, level, waiver tick).
6. [ ] **Packages / class passes** — buy N sessions, redeem at booking, balance on the
   account. First real revenue feature for a coaching business.
7. [ ] **Cancellation policy + no-show** — per-service cancel cutoff, no-show flag on the
   roster, (fees once Stripe lands).
8. [ ] **SMS notifications (Twilio)** — confirm / reminder / waitlist-opening. Reminder
   timing configurable (24h + 2h) instead of the single daily cron.
9. [ ] **Admin calendar view** — one day/week agenda across all bookings + classes +
   blackouts, with create/edit/cancel and walk-in booking.
10. [ ] **RLS org-scoping** — scope every policy to `current_org_id()`, resolve org from
    request host, drop the column defaults. Finishes the multi-tenant seam (WL).

## ⚠ Flags / roadblocks from round 1

- **Vercel deploy (item 2/R1, item 1/R2)** — cannot be done from here. There is no
  Vercel MCP tool or API path in this environment to set project env vars. The deploy
  will keep failing on missing `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` until
  someone sets all of `.env`'s vars in the Vercel dashboard (Production **and** Preview),
  plus `CRON_SECRET`. `vercel.json` now also pins `regions: ["syd1"]` and adds the
  `topup` cron — both take effect on the next successful deploy.
- **Per-location timezone (item 7)** — `locations.timezone` is stored and editable but
  `slots.ts` / `format.ts` still use the single global `PUBLIC_BUSINESS_TZ`. Fine while
  every venue is in Adelaide. Threading a per-location tz through slot generation and
  every `fmt*` call is a real piece of work — do it when a venue in another zone exists.
- **Resources / courts (item 8)** — schema and the conflict constraints are in and inert.
  Still needed to make it real: (a) coach UI to define courts per location, (b) assign a
  free court at booking time, (c) slot generation that treats "every court busy" as
  "closed". (b) and (c) only matter once multiple staff run parallel sessions, so this is
  **coupled to multi-staff (item 9)** — tackle them together.
- **Multi-staff (item 9)** — deliberately not built. A staff picker, per-staff service
  lists, and "any available" routing are speculative for a one-coach business and would
  touch every booking-flow file. The schema already carries `coach_id` throughout, so
  this stays cheap to add later. Trigger: coach #2 is hired.

Current state (v1 shipped): auth, roles (admin/coach/client), weekly availability +
blackouts, session types (appointment/class) → variants → class occurrences,
bookings with manual mark-paid, 30-min slot grid, client book/view/cancel, coach
dashboard, per-coach ICS feed + per-booking .ics, confirm/cancel email, daily
reminder cron. Single coach, single location, no online payment.

---

## Tier 0 — Blockers (the platform is not usable/complete without these)

- [ ] **Vercel deploy green** — set `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`
      + all other env vars (Production + Preview). Build has never succeeded.
- [ ] **Online payments (Stripe)** — Checkout for paid sessions, deposit vs pay-in-full,
      webhook → `payment_status`, refund on cancel. Replaces "coach ticks Mark paid".
      Tables: `payments` (intent id, amount, status, refunded_at), keep manual mark-paid
      as a fallback for cash.
- [x] **Reschedule flow** — `/reschedule`, appointments only, migration `0006`.
- [x] **Class cancellation notifies attendees** — email every confirmed seat. Auto-refund
      waits for Stripe.
- [x] **Recurring class top-up cron** — `/api/cron/topup`.
- [x] **Booking cutoff + min-notice enforcement server-side** — `MIN_NOTICE_MIN` +
      `BOOKING_WINDOW_DAYS`, enforced in the booking + reschedule APIs.

## Tier 1 — Core booking-platform completeness

- [~] **Multiple locations / venues** — `locations` table + per-type location + client
      display shipped (migration `0007`). Left: per-location timezone in slot generation,
      per-location availability. See flags.
- [~] **Bookable resources (courts / rooms / lanes / seats)** — `resources` table +
      `tstzrange` exclusion constraints shipped (migration `0008`), inert. Left: coach UI,
      booking-time assignment, slot generation. Coupled to multi-staff. See flags.
- [ ] **Multi-staff** — staff selector on the booking page, per-staff service lists,
      "any available" + round-robin assignment, per-staff availability already exists.
      Retire `getPrimaryCoach()`. **Deferred — YAGNI for one coach; schema ready.**
- [ ] **Cancellation / no-show policy engine** — per-service: cancel cutoff, cancel fee
      %, no-show fee, "no online cancel inside X hours". Coach marks no-show → fee.
- [ ] **SMS notifications (Twilio/MessageBird)** — confirm, reminder, cancel, waitlist.
      Reminder timing configurable (24h / 2h / both) instead of the fixed daily cron.
- [~] **Waitlist** — join/leave a full class + notify-all on a freed seat shipped
      (migration `0009`). Left: appointment waitlists, a claim/hold window, fall-through.
- [ ] **Buffers + prep/cleanup time** — per-service buffer before/after that blocks the
      grid without being bookable.
- [ ] **Guest checkout** — book with name/email/phone, no account; auto-create a light
      profile, magic-link to manage.
- [ ] **Customer-facing account area** — edit profile, full booking history, upcoming
      + past, rebook-in-one-click, download receipts/invoices.
- [ ] **Two-way Google / Microsoft calendar sync** — push bookings to staff calendars,
      read busy blocks back so external events hold the slot. (Apple stays ICS.)
- [ ] **Proper admin console** — one calendar/day/week/agenda view across all
      staff + resources + locations, create/edit/cancel any booking, walk-in booking,
      block time, drag to reschedule.
- [ ] **Intake forms / booking questions** — per-service custom fields (text, choice,
      waiver checkbox) captured at booking, shown on the roster.

## Tier 2 — Revenue & retention

- [ ] **Packages / class passes / punch cards** — buy N sessions, redeem against
      bookings, expiry, balance on the account.
- [ ] **Memberships / subscriptions** — recurring Stripe billing, member-only pricing,
      included credits per cycle.
- [ ] **Coupons / discount codes / gift cards** — percent/fixed, per-service, usage caps,
      expiry.
- [ ] **Group bookings** — book multiple seats/people in one checkout (bring-a-friend,
      a parent booking 3 kids).
- [ ] **Recurring client appointments** — standing weekly 4pm slot for a regular,
      auto-created, client can skip one.
- [ ] **Multi-session courses / programs** — enrol once into an 8-week term, one price,
      roster spans all sessions.
- [ ] **Reviews / post-session feedback** — request after completion, rating + comment,
      optional public display.
- [ ] **Automated lifecycle email/SMS** — rebook nudge after N days idle, win-back,
      birthday, "you have 2 passes left".
- [ ] **Reports & analytics** — revenue (by service/staff/location/period), utilisation
      %, no-show rate, new vs returning, top services, staff hours.

## Tier 3 — White-label / multi-tenant SaaS (**WL**)

- [~] **Tenant model** — `orgs` + `org_id` on all domain tables landed (migration
      0005, defaulted to one org). Still to do: resolve org from request host/context,
      scope every RLS policy to `current_org_id()`, drop the column defaults.
- [ ] **Custom domain + subdomain per tenant** — `book.acme.com` / `acme.platform.com`,
      cert automation, tenant resolved from host.
- [ ] **Branding** — logo, colour, font, email from-address/domain, favicon, remove
      "powered by", custom terms & privacy URLs. `config.ts` constants become per-org rows.
- [ ] **Tenant self-serve onboarding** — sign up an org, guided setup (staff, services,
      hours, Stripe Connect), trial.
- [ ] **Platform billing** — charge tenants (Stripe Billing), plan tiers, feature gates,
      usage limits (staff count, bookings/mo), dunning.
- [ ] **Stripe Connect** — each tenant's payments land in *their* Stripe account,
      platform takes application fee.
- [ ] **Granular roles & permissions** — owner / manager / front-desk / staff /
      read-only, per-location scoping.
- [ ] **Embeddable booking widget + public API + webhooks** — iframe/script embed for
      a tenant's own site, REST API, webhooks (booking.created/cancelled/paid).
- [ ] **Super-admin console** — list/suspend/impersonate tenants, platform metrics,
      per-tenant support.
- [ ] **Per-tenant locale / currency / tax** — currency, number/date locale, tax rate
      + tax-inclusive vs exclusive, invoice numbering.

## Tier 4 — Operational depth

- [ ] **In-person POS / front desk checkout** — take payment on arrival, tips, split,
      partial, cash drawer reconcile.
- [ ] **Retail add-ons** — sell grips/balls/drinks at checkout, basic inventory count.
- [ ] **Staff scheduling** — shifts, time-off requests + approval, availability derived
      from shifts, clock in/out.
- [ ] **Check-in / attendance** — mark attended, QR or kiosk check-in, attendance in
      reports and against passes.
- [ ] **Waivers / contracts / e-signature** — one-time waiver per client, versioned,
      block booking until signed.
- [ ] **Invoicing + accounting sync** — proper invoices/receipts, Xero / QuickBooks export.
- [ ] **Resource conflict rules** — a court needs 15-min drying, a room seats 12 but
      only 8 for this class type, equipment that can't overlap.
- [ ] **GDPR / privacy** — data export, hard delete + anonymise, consent log, audit
      trail of admin actions.
- [ ] **Notifications preference centre** — per-customer channel opt-in/out, unsubscribe
      that actually suppresses.

## Tier 5 — Polish / later

- [ ] PWA / installable, offline roster for coaches
- [ ] Native staff calendar apps (or just rely on synced Google/Apple)
- [ ] i18n / multi-language customer UI
- [ ] Peak / off-peak & dynamic pricing, last-minute discounts
- [ ] Referral program ("give a session, get a session")
- [ ] Zapier / Make connector
- [ ] Cohort retention / LTV dashboards
- [ ] WCAG 2.2 AA audit + fixes
- [ ] Public status page / uptime monitoring
- [ ] AI booking assistant (chat/NL "book me in Tuesday evening")

---

## Sequencing recommendation

1. **Tier 0 in order** — deploy, then payments, then reschedule, then the two class gaps.
2. **Add `org_id` now** (Tier 3 first item) even though resale is later — retrofitting a
   tenant column across a mature schema is the expensive path. One org row, everything
   defaults to it, zero behaviour change today.
3. **Tier 1: locations + resources together** — they share the double-booking
   refactor (move the guard to a `tstzrange` exclusion constraint). Do multi-staff
   right after, on the same conflict model.
4. Then Tier 2 driven by what TechniCourt actually asks for (passes and memberships
   are usually the first revenue ask for a coaching business).
5. Tier 3 as a block when there's a real second customer — not before.

## Don't build yet (YAGNI until asked)

- Native mobile apps — synced calendars + PWA cover it.
- Dynamic pricing, referral program, AI assistant — no signal these move the needle
  for a single tennis club.
- Full RRULE engine — the materialise + top-up cron is enough until multi-year series
  or complex patterns are a real requirement.
- Super-admin console / platform billing — only meaningful once Tier 3 tenancy exists.
