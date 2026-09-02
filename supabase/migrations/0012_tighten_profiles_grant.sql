-- Round 2 #10 (partial): close the profiles self-edit hole. `authenticated` had a
-- blanket UPDATE grant on profiles, so a client could rewrite their own org_id /
-- cal_token / etc. RLS still restricted them to their own row, but not which
-- columns. Scope it to the two fields the account page actually edits.
--
-- Full org-scoping (every policy → current_org_id(), org resolved from request
-- host, column defaults dropped) is the multi-tenant activation step — do it when
-- there's a real second tenant, not before.

revoke update on public.profiles from anon, authenticated;
grant update (name, phone) on public.profiles to authenticated;
