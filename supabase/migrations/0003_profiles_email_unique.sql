-- Guest booking looks a client up by email before creating an account.
create unique index profiles_email_lower_idx on public.profiles (lower(email)) where email <> '';
