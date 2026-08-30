-- 0015_amendment_c.sql
-- ADR-INV-001 Amendment C-1 (2026-08-30). The architect reviewed 0010's `compute_line`
-- schema move and confirmed the *bug* (Amendment C-1: layer 1 of ADR-INV-002 §D8 never
-- worked for a real `authenticated` client editing a draft directly, only as a side effect
-- of `issue_document()`) but reversed the *fix*: `compute_line` moves back to `app`, and
-- `grant usage on schema app to authenticated` (previously forbidden by this project's own
-- Amendment B-3) is now the sanctioned mechanism instead. §D3 was rewritten accordingly — see
-- that section for the architect's full reasoning for reversing their own prior ban. C-2 and
-- C-3 (this round's `business_has_signing_key` fix and the `0014` EXECUTE-hardening fix) were
-- both confirmed as implemented and are NOT touched here.
--
-- Why USAGE is safe here (ADR-INV-001 §D3, verbatim reasoning): it does not hide names
-- (`pg_catalog` is world-readable regardless), it does not open an HTTP path (`app` is never
-- a PostgREST-exposed schema — that boundary is §D3.3, untouched by this migration), and
-- `authenticated` has no free-form SQL path into Supabase anyway. The real control is
-- `EXECUTE`, enforced by CI check (ז) (scripts/ci-schema-checks.sql, updated below in the
-- same spirit as this migration — see that script's own header comment).
--
-- 0007/0008/.../0014 are NOT edited — this is a `create or replace` / `alter` migration.

-- ============================================================================
-- Move app.compute_line() back from public (C-1). ALTER FUNCTION ... SET SCHEMA preserves
-- the function's OID and body untouched; its ACL is fully reset below regardless of whatever
-- grants it held as public.compute_line() (0010_addendum_fixes.sql).
-- ============================================================================

alter function public.compute_line(numeric, numeric, numeric, public.vat_treatment, numeric)
  set schema app;

-- ============================================================================
-- ADR-INV-001 §D3, Amendment C-1's updated grant block — verbatim. Re-establishes both
-- schema-level USAGE (now granted to `authenticated`, revoked from `public`/`anon`) and the
-- narrow three-function EXECUTE whitelist (the two RLS-policy helpers plus `compute_line`,
-- ADR's own words: "אריתמטיקה טהורה ללא גישה לטבלאות וללא נתוני tenant בקלט או בפלט" — safe
-- to expose the same way current_business_ids()/has_role() already were). The blanket
-- `revoke execute on all functions in schema app` re-applies to every function currently in
-- `app`, including `app.business_has_signing_key()` (owned by `service_role`, 0013) — `db_owner`
-- can administer its ACL because `db_owner` is a member of `service_role` (granted for
-- `SET ROLE` purposes by every test/CI harness; verified empirically, not assumed, that this
-- extends to ACL administration too, not just runtime role-switching). It stays unreachable
-- by `authenticated`/`anon` exactly as before — it is not one of the three functions
-- re-granted below.
-- ============================================================================

grant usage on schema app to authenticated;
revoke all  on schema app from public, anon;

revoke execute on all functions in schema app from public, anon, authenticated;
grant  execute on function app.current_business_ids()                        to authenticated;
grant  execute on function app.has_role(uuid, public.member_role[])          to authenticated;
grant  execute on function app.compute_line(numeric, numeric, numeric,
                                            public.vat_treatment, numeric)   to authenticated;

-- Anti-drift (C-3, generalized): every future function created in `app` by the role running
-- migrations (`db_owner`) starts with EXECUTE revoked from PUBLIC by default, instead of
-- relying on someone remembering to add an explicit revoke in that function's own migration
-- (exactly the gap `0014_app_execute_hardening.sql` had to fix after the fact for 11
-- functions).
alter default privileges in schema app revoke execute on functions from public;

-- ============================================================================
-- app.document_lines_compute() (0009/0010) — only change is the call site:
-- app.compute_line() instead of public.compute_line(). Logic is otherwise identical to
-- 0010_addendum_fixes.sql's version (issue_date-derived VAT rate, A′-1/A′-3).
-- ============================================================================

create or replace function app.document_lines_compute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entity_type public.entity_type;
  v_issue_date  date;
  v_as_of       date;
  v_vat_rate    numeric(5, 2);
  v_computed    record;
begin
  select business_entity_type, issue_date into v_entity_type, v_issue_date
    from public.documents
   where id = new.document_id;

  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: document % does not exist', new.document_id
      using errcode = 'P0001';
  end if;

  v_as_of := coalesce(nullif(current_setting('app.issuing_as_of', true), '')::date, v_issue_date, current_date);

  select rate into v_vat_rate
    from public.vat_rates
   where valid_from <= v_as_of and (valid_to is null or valid_to >= v_as_of)
   order by valid_from desc
   limit 1;

  if v_entity_type = 'patur' then
    v_vat_rate := 0;
  elsif v_vat_rate is null then
    raise exception 'INV_NO_VAT_RATE: no vat_rates row covers %', v_as_of
      using errcode = 'P0001';
  end if;

  select * into v_computed
    from app.compute_line(new.quantity, new.unit_price, new.discount_percent, new.vat_treatment, v_vat_rate);

  new.discount_amount := v_computed.discount_amount;
  new.line_net         := v_computed.line_net;
  new.line_vat          := v_computed.line_vat;
  new.line_total        := v_computed.line_total;

  return new;
end;
$$;
