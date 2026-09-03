# TechniCourt Bookings — Roadmap

One ranked list. Work top-down. `[ ]` todo · `[~]` partial · `[x]` done.

## Next

1. [ ] **Stripe / online payment** — deferred by request. Biggest single gap:
   pay at booking, auto mark-paid, refund on cancel. Touches `book.astro`,
   `/m/[id]`, `passes`, the pay flows in `/api/schedule`.
2. [ ] **Occurrence edit — notify attendees** — `occ.update` currently refuses a
   time change when a class has bookings. Add a "move + email everyone" path
   reusing `sendReschedule` per attendee.
3. [ ] **Per-location timezone** — `locations.timezone` is stored but slot
   generation still uses the single `PUBLIC_BUSINESS_TZ`. Thread it through
   `getAvailableSlots` / `weeklySeries` / display when a second zone exists.
4. [ ] **Courts / resources** — `resources` table + exclusion constraints exist
   (migration 0008) but nothing assigns `resource_id` and slots don't treat
   "every court busy" as closed. Do it with, not before, real parallel demand.
5. [ ] **Generated DB types everywhere** — `src/lib/database.types.ts` exists;
   switch `createSupabaseAdmin()` to `SupabaseClient<Database>` and delete the
   `any` casts, file by file, next schema round.
6. [ ] **RLS duplicate-permissive-policy merge** — the other half of review
   §4.10 (initplan half shipped in migration 0017). Perf-only; wait until a
   table has real row counts.
7. [ ] **Asymmetric JWT + `getClaims()`** — verify locally, read `role` from
   `app_metadata`, drop the middleware profile query on public pages.
8. [ ] **SMS reminders**, **memberships**, **reviews**, **RRULE**,
   **multi-tenant RLS switch-on** — not needed for one club; don't start ahead
   of 1–4.

## Ops / one-offs

- [ ] Vercel Preview env: set `PUBLIC_SUPABASE_*` if branch previews are wanted.
- [ ] Resend: move Auth → SMTP to Resend (avoids 2/hr Supabase limit).
- [ ] `.env` production `EMAIL_FROM` → `bookings@technicourt.com`, SPF/DKIM.
- [ ] Turn on Supabase "Leaked password protection".
- [ ] Fill in real `/terms` and `/privacy` copy.
- [ ] `btree_gist` still in `public` schema — move to `extensions` on a branch,
  insert-test the exclusion constraints, then merge (advisor `0014`).
- [ ] `astro` pinned to `~7.2.10` — `7.3.0` has a broken internal import
  (`_internal/logger`) that fails the build under rolldown. Revisit on 7.3.1+.

## Done (v1 + review 2026-09-03)

- Multi-coach booking, offerings, round-robin · guest `/m/<id>` manage ·
  reschedule with `.ics` UPDATE · class waitlist (+ guest) · recurring classes
  + top-up cron · multiple locations · intake questions · passes · cancel
  cutoff + no-show · multi-staff admin console · embeddable widgets.
- **Review 2026-09-03**: migrations 0015–0017 (locked-down writes, exclusion
  constraint, `time_off`, RLS initplan); app-side security (email lookup,
  `safeNext`, httpOnly cookies, scoped `frame-ancestors`, required
  `CRON_SECRET`, escaped emails); scheduling correctness (dead-series top-up,
  reminder window, stable slugs, business-local day math, notice-window
  classes); password set/reset flow; coach notifications; admin-who-coaches;
  client search; unpaid list + CSV; `time_off`; guest waitlist; favicon /
  404 / 500 / noindex; CI; more unit tests.
