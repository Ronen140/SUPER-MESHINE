-- tests/db/auth-stub.sql
-- LOCAL/CI TEST FIXTURE ONLY — never applied to a real Supabase project, never referenced
-- from supabase/migrations/. Reproduces the slice of Supabase's platform-managed setup our
-- migrations/tests depend on but do not themselves create: the `anon` / `authenticated` /
-- `service_role` roles, default table/sequence grants to them (the real Supabase platform
-- does this once per project, outside any migration), the `auth` schema/table, and a
-- behaviorally-faithful `auth.uid()` that reads the same GUC PostgREST sets per-request on
-- real Supabase (`request.jwt.claim.sub` / `request.jwt.claims`) — so
-- `set local request.jwt.claim.sub = '<uuid>'` inside a transaction faithfully simulates
-- "this session is authenticated as user X", both for local `pnpm test` runs against a
-- throwaway Postgres and for the `postgres:16` services container used in CI (B13).
--
-- Deliberately does NOT include a `grant usage on schema app to authenticated` — ADR-INV-001
-- §D3/§D3.3/Amendment B-3 is explicit that this must never appear anywhere, including test
-- fixtures: every test in this suite exercises `app.*` internals only indirectly, through the
-- `public.*` RPC contract (`issue_document`, `create_business`, `set_start_number`, ...), the
-- same path a real client uses.

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

-- `anon`/`authenticated`/`service_role` and the `db_owner`-to-them membership grants are
-- created by the superuser admin connection in tests/db/harness.ts, not here — creating a
-- role with `BYPASSRLS` (`service_role`) itself requires `BYPASSRLS`, which `db_owner` (the
-- role this script and every migration run as — deliberately a non-superuser, see
-- harness.ts's `OWNER_ROLE` comment) does not and must not have.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
