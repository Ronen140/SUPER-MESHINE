-- 0016_log_event_and_fixes.sql
-- code-quality review fixes on Batch 3 (vault/Reviews/quality/2026-08-30-invoicing-phase0-batch3.md):
--
-- 1. (🔴) `public.log_event()` (ADR-INV-001 §D11, Amendment B-4) was never implemented —
--    `api/keygen.py`'s INSERT into `business_signing_keys` wrote no audit_log row at all,
--    a direct violation of CLAUDE.md invariant #2. Implemented here in full per §D11,
--    verbatim action list and grants, PLUS one necessary extension (documented below):
--    `api/keygen.py` calls it via the `service_role` key (it is not, and must not be, an
--    `authenticated`-user request — ADR-INV-001 §D5 already requires
--    `business_signing_keys` writes to go through `service_role`), and §D11's literal body
--    forces `actor_id` from `auth.uid()` and requires `app.has_role()` membership, neither
--    of which resolves for a service_role-authenticated PostgREST call (no `sub` claim to
--    check membership against). Extension: when the request's own JWT claims identify the
--    caller as `service_role` (`current_setting('request.jwt.claims', true)`, the exact GUC
--    `app.audit_trigger()` already reads for `actor_email` — not a new mechanism), the
--    membership check is skipped and the row is written with `actor_type='service'`,
--    `actor_id=null` — the same `actor_type` distinction `app.audit_trigger()` already makes
--    for non-user-initiated writes (0006_audit.sql: "case when auth.uid() is not null then
--    'user' else 'service' end"). The `authenticated`-user path (`p_action` from a real
--    logged-in user — `download`, `view_public`, `export`, `consent_grant`,
--    `consent_revoke`, `key_revoke`) is completely unchanged from §D11's literal text.
--    Flagged for architect confirmation — this is an extension the ADR's text does not
--    literally cover, not a silent reinterpretation.
--
-- 2. (🟡 TOCTOU) `public.create_business()`'s 10-business limit (`0011_create_business.sql`)
--    read `count(*)` then `insert` with no lock in between — reproduced empirically per the
--    review (5 concurrent calls at count=9 → 12 businesses). Fixed with
--    `pg_advisory_xact_lock(hashtext(v_uid::text))` — a transaction-scoped advisory lock
--    keyed by the calling user, taken immediately after the profile check and before the
--    count, serializing concurrent `create_business()` calls from the *same* user (different
--    users use different lock keys and never contend with each other). Released
--    automatically at COMMIT/ROLLBACK — no explicit unlock needed, and safe against the
--    function raising partway through.
--
-- (issue 3 — route.ts leaking raw Postgres error text — and issue 4 — KEK read as hex
-- instead of ADR-INV-003 §D4's base64 — are TypeScript/Python fixes, not SQL; see
-- src/app/api/businesses/route.ts and api/_keygen_core.py in this same round.)
--
-- 0007-0015 are NOT edited — this is a `create or replace` migration.

-- ============================================================================
-- public.log_event() — ADR-INV-001 §D11, verbatim, plus the service_role extension above.
-- ============================================================================

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
declare
  v_is_service_role boolean;
begin
  v_is_service_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''
  ) = 'service_role';

  if p_action not in ('download', 'view_public', 'export',
                      'consent_grant', 'consent_revoke', 'key_create', 'key_revoke')
    then raise exception 'INV_BAD_EVENT: % is not a loggable event', p_action
      using errcode = 'P0001';
  end if;

  if v_is_service_role then
    -- Server-side caller holding the service_role key (e.g. api/keygen.py, right after
    -- writing business_signing_keys) — already the most-trusted role in this system
    -- (ADR-INV-001 §D5); there is no auth.uid() to check membership against for a request
    -- that never carried an end-user session.
    insert into public.audit_log (business_id, actor_type, actor_id, action,
                                  table_name, record_id, after_data)
    values (p_business_id, 'service', null, p_action, p_table_name, p_record_id, p_meta);
    return;
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

revoke execute on function public.log_event(uuid, text, text, uuid, jsonb) from public, anon;
grant  execute on function public.log_event(uuid, text, text, uuid, jsonb) to authenticated, service_role;

-- ============================================================================
-- public.create_business() — TOCTOU fix. Only change vs. 0011_create_business.sql is the
-- advisory lock inserted between the profile check and the count check; everything else is
-- byte-for-byte identical.
-- ============================================================================

create or replace function public.create_business(
  p_legal_name  text,
  p_entity_type public.entity_type,
  p_tax_id      text,
  p_tax_id_type text default 'vat',
  p_display_name text default null
) returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.businesses%rowtype;
  v_count int;
begin
  if v_uid is null then
    raise exception 'INV_UNAUTHENTICATED: no authenticated user'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.users where id = v_uid) then
    raise exception 'INV_NO_PROFILE: no public.users row for the current user'
      using errcode = 'P0001';
  end if;

  -- TOCTOU fix (code-quality review, Batch 3): serializes concurrent create_business() calls
  -- from the same user so the count-then-insert below can never race across two of that
  -- user's own transactions. Transaction-scoped (`_xact_`) — released automatically at
  -- COMMIT/ROLLBACK, including if a later check in this function raises.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select count(*) into v_count from public.businesses where created_by = v_uid;
  if v_count >= 10 then
    raise exception 'INV_BUSINESS_LIMIT: a user may own at most 10 businesses'
      using errcode = 'P0001';
  end if;

  if p_tax_id !~ '^[0-9]{9}$' then
    raise exception 'INV_BAD_TAX_ID: tax_id must be exactly 9 digits'
      using errcode = 'P0001';
  end if;

  begin
    insert into public.businesses (legal_name, display_name, entity_type, tax_id, tax_id_type, created_by)
    values (p_legal_name, coalesce(p_display_name, p_legal_name),
            p_entity_type, p_tax_id, p_tax_id_type, v_uid)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'INV_TAX_ID_EXISTS: a business with this tax_id already exists'
      using errcode = 'P0001';
  end;

  insert into public.business_members (business_id, user_id, role)
  values (v_row.id, v_uid, 'owner');

  insert into public.audit_log (business_id, actor_type, actor_id, action,
                                table_name, record_id, after_data)
  values (v_row.id, 'user', v_uid, 'business_create', 'businesses', v_row.id, to_jsonb(v_row));

  return v_row;
end;
$$;

revoke execute on function public.create_business(text, public.entity_type, text, text, text)
  from public, anon;
grant  execute on function public.create_business(text, public.entity_type, text, text, text)
  to authenticated;
