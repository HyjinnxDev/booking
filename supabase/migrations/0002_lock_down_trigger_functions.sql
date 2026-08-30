-- Trigger functions are only ever invoked by their triggers; nobody should be
-- able to call them over the REST RPC surface.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.lock_role() from public, anon, authenticated;

-- is_admin() stays executable by anon/authenticated: RLS policy expressions
-- call it as the querying role. It returns false with no session, leaks nothing.
