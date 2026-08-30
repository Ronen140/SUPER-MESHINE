-- Down for 0015_amendment_c.sql — restores the exact 0014-era state: compute_line back in
-- `public` (0010_addendum_fixes.sql's version, same REVOKE/GRANT pattern every other
-- `public.*` RPC gets), document_lines_compute() calling public.compute_line() again, and
-- schema `app` USAGE revoked from `authenticated` (Amendment B-3's original, since-reversed
-- position). This deliberately reintroduces the C-1 bug — correct behavior for a down
-- migration (exact prior state), not a recommendation to run it.

-- ----------------------------------------------------------------------------
-- Restore app.document_lines_compute() to call public.compute_line() (its 0010 form).
-- ----------------------------------------------------------------------------

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
    from public.compute_line(new.quantity, new.unit_price, new.discount_percent, new.vat_treatment, v_vat_rate);

  new.discount_amount := v_computed.discount_amount;
  new.line_net         := v_computed.line_net;
  new.line_vat          := v_computed.line_vat;
  new.line_total        := v_computed.line_total;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Reverse the schema/default-privilege grants (Amendment C-1's §D3 block).
-- ----------------------------------------------------------------------------

alter default privileges in schema app grant execute on functions to public;

revoke execute on function app.current_business_ids()                        from authenticated;
revoke execute on function app.has_role(uuid, public.member_role[])          from authenticated;
grant  execute on function app.current_business_ids()                        to authenticated;
grant  execute on function app.has_role(uuid, public.member_role[])          to authenticated;

revoke usage on schema app from authenticated;

-- ----------------------------------------------------------------------------
-- Move app.compute_line() back to public, restoring 0010_addendum_fixes.sql's grants.
-- ----------------------------------------------------------------------------

alter function app.compute_line(numeric, numeric, numeric, public.vat_treatment, numeric)
  set schema public;

revoke execute on function public.compute_line(numeric, numeric, numeric, public.vat_treatment, numeric)
  from public, anon;
grant  execute on function public.compute_line(numeric, numeric, numeric, public.vat_treatment, numeric)
  to authenticated;
