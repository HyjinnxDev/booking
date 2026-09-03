-- Trigger / constraint smoke test. Run against a Supabase branch (or prod inside
-- an explicit transaction you ROLLBACK). Every block raises on failure.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/smoke.sql
begin;

do $$
declare
  org   uuid := 'a0000000-0000-4000-8000-000000000001';
  loc   uuid;
  coach uuid;
  c1    uuid;
  c2    uuid;
  st    uuid;
  sv    uuid;
  occ   uuid;
  pass  uuid;
  b1    uuid;
begin
  select id into loc from public.locations limit 1;

  insert into auth.users (id, email) values (gen_random_uuid(), 'smoke-coach@example.test') returning id into coach;
  insert into auth.users (id, email) values (gen_random_uuid(), 'smoke-c1@example.test') returning id into c1;
  insert into auth.users (id, email) values (gen_random_uuid(), 'smoke-c2@example.test') returning id into c2;
  update public.profiles set role = 'coach' where id = coach;

  insert into public.session_types (org_id, coach_id, name, kind, location_id)
    values (org, coach, 'Smoke Lesson', 'appointment', loc) returning id into st;
  insert into public.session_variants (org_id, session_type_id, name, duration_min, price_cents, capacity)
    values (org, st, '60', 60, 5000, 1) returning id into sv;

  -- 1. exclusion constraint: overlapping confirmed appointments for one coach
  insert into public.bookings (org_id, coach_id, client_id, start_at, end_at, status, session_variant_id, price_cents)
    values (org, coach, c1, '2099-01-01 09:00+00', '2099-01-01 10:00+00', 'confirmed', sv, 5000) returning id into b1;
  begin
    insert into public.bookings (org_id, coach_id, client_id, start_at, end_at, status, session_variant_id, price_cents)
      values (org, coach, c2, '2099-01-01 09:30+00', '2099-01-01 10:30+00', 'confirmed', sv, 5000);
    raise exception 'FAIL: overlapping appointment was allowed';
  exception when exclusion_violation then null; -- 23P01, expected
  end;

  -- 2. cancelled row frees the slot
  update public.bookings set status = 'cancelled' where id = b1;
  insert into public.bookings (org_id, coach_id, client_id, start_at, end_at, status, session_variant_id, price_cents)
    values (org, coach, c2, '2099-01-01 09:30+00', '2099-01-01 10:30+00', 'confirmed', sv, 5000);

  -- 3. class capacity trigger
  insert into public.class_occurrences (org_id, session_variant_id, coach_id, start_at, end_at, capacity)
    values (org, sv, coach, '2099-02-01 18:00+00', '2099-02-01 19:00+00', 1) returning id into occ;
  insert into public.bookings (org_id, coach_id, client_id, start_at, end_at, status, session_variant_id, class_occurrence_id, price_cents)
    values (org, coach, c1, '2099-02-01 18:00+00', '2099-02-01 19:00+00', 'confirmed', sv, occ, 0);
  begin
    insert into public.bookings (org_id, coach_id, client_id, start_at, end_at, status, session_variant_id, class_occurrence_id, price_cents)
      values (org, coach, c2, '2099-02-01 18:00+00', '2099-02-01 19:00+00', 'confirmed', sv, occ, 0);
    raise exception 'FAIL: class overfill was allowed';
  exception when unique_violation then null; -- 23505, expected
  end;

  -- 4. pass redeem + refund
  insert into public.passes (org_id, client_id, session_type_id, name, total)
    values (org, c1, st, 'Smoke pack', 3) returning id into pass;
  insert into public.bookings (org_id, coach_id, client_id, start_at, end_at, status, session_variant_id, pass_id, price_cents)
    values (org, coach, c1, '2099-03-01 09:00+00', '2099-03-01 10:00+00', 'confirmed', sv, pass, 5000) returning id into b1;
  if (select used from public.passes where id = pass) <> 1 then raise exception 'FAIL: pass not redeemed'; end if;
  if (select price_cents from public.bookings where id = b1) <> 0 then raise exception 'FAIL: pass booking not zeroed'; end if;
  update public.bookings set status = 'cancelled' where id = b1;
  if (select used from public.passes where id = pass) <> 0 then raise exception 'FAIL: pass not refunded on cancel'; end if;

  -- 5. lock_role: a null auth.uid() (service role / SQL editor) may change role
  update public.profiles set role = 'admin' where id = c2;
  if (select role from public.profiles where id = c2) <> 'admin' then raise exception 'FAIL: lock_role blocked the service role'; end if;

  raise notice 'ALL SMOKE CHECKS PASSED';
end $$;

rollback;
