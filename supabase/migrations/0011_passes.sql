-- Session passes / class packs. Sold in person (no Stripe yet): the coach issues a
-- pass to a client, the client redeems it at booking time, the pass balance ticks
-- down. Cancelling a pass-covered booking hands the credit back.

create table public.passes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default 'a0000000-0000-4000-8000-000000000001'
                  references public.orgs (id) on delete restrict,
  client_id       uuid not null references public.profiles (id) on delete cascade,
  session_type_id uuid references public.session_types (id) on delete set null, -- null = any session
  name            text not null,
  total           int  not null check (total >= 1),
  used            int  not null default 0 check (used >= 0),
  price_cents     int  not null default 0 check (price_cents >= 0),
  status          text not null default 'active' check (status in ('active', 'void')),
  expires_at      date,
  created_at      timestamptz not null default now(),
  check (used <= total)
);
create index passes_client_idx on public.passes (client_id);

alter table public.bookings
  add column pass_id uuid references public.passes (id) on delete set null;

grant all on public.passes to anon, authenticated, service_role;
alter table public.passes enable row level security;

create policy passes_own on public.passes
  for select using (client_id = auth.uid() or public.is_admin());
create policy passes_manage on public.passes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin')));

-- Redeem: lock the pass, verify it covers this session and has a credit left,
-- tick `used`. Race-safe — the conditional UPDATE is the lock.
create or replace function public.redeem_pass()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  affected int;
  this_type uuid;
begin
  if new.pass_id is null or new.status <> 'confirmed' then
    return new;
  end if;
  select session_type_id into this_type from public.session_variants where id = new.session_variant_id;

  update public.passes
     set used = used + 1
   where id = new.pass_id
     and client_id = new.client_id
     and status = 'active'
     and used < total
     and (expires_at is null or expires_at >= current_date)
     and (session_type_id is null or session_type_id = this_type);
  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'pass % is not valid for this booking', new.pass_id using errcode = '23514';
  end if;

  new.price_cents := 0;
  new.payment_status := 'paid';
  return new;
end;
$$;
revoke all on function public.redeem_pass() from public, anon, authenticated;

create trigger bookings_redeem_pass
  before insert on public.bookings
  for each row execute function public.redeem_pass();

-- Hand the credit back when a pass-covered booking is cancelled (not on no-show).
create or replace function public.refund_pass()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pass_id is not null and old.status = 'confirmed' and new.status = 'cancelled' then
    update public.passes set used = greatest(used - 1, 0) where id = new.pass_id;
  end if;
  return new;
end;
$$;
revoke all on function public.refund_pass() from public, anon, authenticated;

create trigger bookings_refund_pass
  after update on public.bookings
  for each row execute function public.refund_pass();
