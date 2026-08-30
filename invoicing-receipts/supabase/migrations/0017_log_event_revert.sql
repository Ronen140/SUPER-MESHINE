-- 0017_log_event_revert.sql
--
-- Architect decision: revert the `service_role` extension to `public.log_event()` that
-- `0016_log_event_and_fixes.sql` (issue 1) added so `api/keygen.py` could audit
-- `business_signing_keys` writes.
--
-- Rejected, for two independent reasons:
--   (a) `service_role` already carries `BYPASSRLS` in this project (see
--       `tests/db/harness.ts`'s `create role service_role nologin bypassrls` — a documented,
--       given Supabase platform attribute for the service_role key itself, unlike the
--       `postgres` role's BYPASSRLS status, which Amendment A explicitly refused to assume).
--       It can already INSERT into `public.audit_log` directly with zero policy involvement,
--       exactly as `public.create_business()` already does for `'business_create'` events
--       (`0011_create_business.sql`/`0016_log_event_and_fixes.sql`, unchanged here) — no
--       function, no RPC, no extension of `log_event()`'s surface is needed for this.
--   (b) branching a `SECURITY DEFINER` function's authorization logic on a GUC
--       (`request.jwt.claims->>'role'`) that the caller's own JWT supplies is an
--       audit-forgery attack surface: nothing about that branch verifies the *caller*, only
--       what claim happens to be present on the request. `app.audit_trigger()`'s read of the
--       same GUC (`0006_audit.sql`, for the cosmetic `actor_email` column only) is not a
--       counter-example — it never changes *authorization*, only a display value.
--
-- This migration restores `public.log_event()` to ADR-INV-001 §D11's literal text — the
-- `v_is_service_role` variable and its branch are removed entirely — and revokes EXECUTE from
-- `service_role` (which never needs to call this function: it writes `audit_log` directly),
-- leaving EXECUTE granted to `authenticated` only, per §D11.
--
-- `api/keygen.py` is updated in the same round to INSERT into `audit_log` directly (as
-- `service_role`) instead of calling this RPC — see that file's docstring.
--
-- 0007-0016 are NOT edited — this is a `create or replace` migration.

create or replace function public.log_event(
  p_business_id uuid,
  p_action      text,
  p_table_name  text default null,
  p_record_id   uuid default null,
  p_meta        jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action not in ('download', 'view_public', 'export',
                      'consent_grant', 'consent_revoke', 'key_create', 'key_revoke')
    then raise exception 'INV_BAD_EVENT: % is not a loggable event', p_action
      using errcode = 'P0001';
  end if;

  if not app.has_role(p_business_id, array['owner', 'editor', 'viewer', 'accountant']::public.member_role[])
    then raise exception 'INV_FORBIDDEN: not a member of this business'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (business_id, actor_type, actor_id, action,
                                table_name, record_id, after_data)
  values (p_business_id, 'user', auth.uid(), p_action, p_table_name, p_record_id, p_meta);
end;
$$;

revoke execute on function public.log_event(uuid, text, text, uuid, jsonb) from public, anon, service_role;
grant  execute on function public.log_event(uuid, text, text, uuid, jsonb) to authenticated;
