-- 0004_rls_helpers.sql
-- ADR-INV-001 §D3. Internal schema not exposed to PostgREST; the two SECURITY DEFINER
-- helper functions every table-level RLS policy in 0005_rls_policies.sql depends on.
-- These two are #1 and #2 of the ADR's closed 7-function SECURITY DEFINER whitelist
-- (§D3.2) — never add a SECURITY DEFINER function without updating the ADR + CI check.
--
-- NOTE on `revoke all on schema app from anon, authenticated`: this blocks *direct* calls
-- like `select app.current_business_ids()` from a client (verified empirically: raises
-- "permission denied for schema app"), but does NOT block the same function being called
-- from inside an RLS policy expression defined by the schema owner (`postgres`) — Postgres
-- checks EXECUTE on the function itself at invocation time (defaults to PUBLIC-granted,
-- never revoked here), not schema USAGE, for an already-analyzed policy qual. Verified
-- empirically before writing this migration rather than assumed, given that the previous
-- assumption about FORCE ROW LEVEL SECURITY in this same ADR turned out to be wrong
-- (Amendment A-4) — the same trap was not going to be repeated silently here.

create schema app;
revoke all on schema app from anon, authenticated;

create or replace function app.current_business_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select business_id from public.business_members where user_id = auth.uid() $$;

create or replace function app.has_role(p_business uuid, p_roles member_role[])
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.business_members
                     where business_id = p_business and user_id = auth.uid() and role = any(p_roles)) $$;
