-- 0011_create_business.sql
-- B9 (ADR-INV-001 §D10, Amendment A-3). Numbering note: the plan's original "0009" shifted to
-- 0010 after the ADR-INV-002 Amendment A fix round (0009_amendments.sql), and again to 0011
-- after this round's mandatory Addendum A′ fix round (0010_addendum_fixes.sql) — see
-- vault/Meeting Notes/invoicing-receipts-system.md. `public.create_business()`, not
-- `app.create_business()` as the (not-yet-Revision-4'd) engineering plan text still says —
-- ADR-INV-001 Amendment B-2/§D3.3 moved the RPC contract to `public`; the ADR's own §D10 code
-- sample already reflects that (`public.create_business`), only the plan doc is stale on the
-- name (documented in the vault, not this migration's job to fix).
--
-- Verbatim from ADR-INV-001 §D10, with the same hardening already applied to every other
-- `public.*` RPC in this project: `set search_path = ''` + fully-qualified names throughout
-- (the ADR's own code sample is unqualified in a few spots — `users`, `businesses`,
-- `business_members`, `audit_log` — schema-qualified here, consistent with every other
-- function this project has already hardened).

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
    -- Profile is created by public.handle_new_auth_user() on signup (0003a_core_tables.sql)
    -- — reaching here means auth.uid() resolves to a session with no matching profile row,
    -- which should never happen via the normal signup flow.
    raise exception 'INV_NO_PROFILE: no public.users row for the current user'
      using errcode = 'P0001';
  end if;

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
