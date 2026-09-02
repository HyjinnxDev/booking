# TechniCourt Bookings — Roadmap

Ranked most-needed → least. We work top-down. Check items off in place.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **WL** = only matters for white-label resale

---

## → Next 10 (current working set)

Stripe/online payments deferred — parked in Tier 0, not in this set.

1. [x] **`org_id` seam** — `orgs` table + `org_id` on all 7 domain tables, defaulted
   to the sole TechniCourt org, `current_org_id()` helper. Migration `0005_orgs.sql`,
   applied local + remote. Zero behaviour change.
2. [ ] **Vercel deploy green** — set env vars (Production + Preview), confirm
   `bookings.technicourt.com` serves. Region pinned to `syd1` (done in `vercel.json`).
3. [ ] **Reschedule flow** — move a booking to a new time in place; re-check
   conflict/capacity; email an `.ics` UPDATE (not CANCEL+REQUEST).
4. [ ] **Class cancellation → notify + refund-free** — coach cancels an occurrence,
   every confirmed seat gets an email; mark bookings cancelled. (Refunds wait for Stripe.)
5. [ ] **Recurring class top-up cron** — daily job extends each active series back to
   `SERIES_WEEKS` ahead.
6. [ ] **Min-notice + cutoff enforced server-side** — reject appointment/seat bookings
   inside a configurable notice window and past `BOOKING_WINDOW_DAYS`, in the API.
7. [ ] **Multiple locations** — `locations` table (name, address, timezone), session
   types + availability scope to one, client sees/filters by location.
8. [ ] **Bookable resources (courts)** — `resources` table; a booking holds a resource
   for its window; move the double-booking guard to a `tstzrange` exclusion constraint.
9. [ ] **Multi-staff booking** — staff picker on the booking page, per-staff service
   lists, "any available" fallback; retire `getPrimaryCoach()`.
10. [ ] **Waitlist** — join a full slot/class, auto-offer on a cancellation with a
    claim window.

Items 7–9 share the exclusion-constraint refactor — do them as one block.

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
- [ ] **Reschedule flow** — move a booking to a new slot without cancel+rebook
      (keeps the row, re-checks conflicts/capacity, re-sends .ics as UPDATE not CANCEL).
- [ ] **Class cancellation notifies attendees** — coach cancels an occurrence →
      email every confirmed seat + auto-refund. Currently silent (README known gap).
- [ ] **Recurring class top-up cron** — series are materialised 12wk ahead once and
      never extended. Daily cron tops each active series back to `SERIES_WEEKS`.
- [ ] **Booking cutoff + min-notice enforcement server-side** — `BOOKING_WINDOW_DAYS`
      exists for the far edge; add a min-notice (e.g. no booking <2h out) and enforce
      both in the API, not just the UI.

## Tier 1 — Core booking-platform completeness

- [ ] **Multiple locations / venues** — `locations` (name, address, timezone, hours).
      Session types and availability scope to a location; client picks or filters by it.
      Per-location timezone (today it's one global `BUSINESS_TZ`).
- [ ] **Bookable resources (courts / rooms / lanes / seats)** — `resources` table,
      a booking consumes a resource for its window, double-book guard moves from
      `(coach_id, start_at)` to `(resource_id, time-range)` via an exclusion constraint.
      This is the "seats" concept generalised beyond class capacity.
- [ ] **Multi-staff** — staff selector on the booking page, per-staff service lists,
      "any available" + round-robin assignment, per-staff availability already exists.
      Retire `getPrimaryCoach()`.
- [ ] **Cancellation / no-show policy engine** — per-service: cancel cutoff, cancel fee
      %, no-show fee, "no online cancel inside X hours". Coach marks no-show → fee.
- [ ] **SMS notifications (Twilio/MessageBird)** — confirm, reminder, cancel, waitlist.
      Reminder timing configurable (24h / 2h / both) instead of the fixed daily cron.
- [ ] **Waitlist** — join when a slot/class is full, auto-offer on cancellation with a
      claim window, then fall through to the next person.
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
