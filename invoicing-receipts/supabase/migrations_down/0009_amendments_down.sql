-- Down for 0009_amendments.sql — restores the exact state 0008_issue_function.sql left
-- behind (app.issue_document / app.set_start_number back in `app`, verbatim bodies copied
-- from 0008), then removes everything else 0009 added.

drop function public.set_start_number(uuid, public.document_type, int, bigint);
drop function public.issue_document(uuid, date);
drop function app.recompute_draft_lines(uuid, date);

-- ----------------------------------------------------------------------------
-- Restore app.issue_document exactly as defined in 0008_issue_function.sql.
-- ----------------------------------------------------------------------------

create or replace function app.issue_document(p_document_id uuid, p_issue_date date default null)
returns documents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc                documents%rowtype;
  v_business            businesses%rowtype;
  v_parent              documents%rowtype;
  v_issue_date          date := coalesce(p_issue_date, current_date);
  v_tax_year            int;
  v_vat_rate            numeric(5, 2);
  v_subtotal            numeric(14, 2) := 0;
  v_discount            numeric(14, 2) := 0;
  v_net                 numeric(14, 2) := 0;
  v_vat                 numeric(14, 2) := 0;
  v_total               numeric(14, 2) := 0;
  v_payable             numeric(14, 2) := 0;
  v_line_count          int;
  v_payments_sum        numeric(14, 2);
  v_number              bigint;
  v_prefix              text;
  v_display_number      text;
  v_customer_snapshot   jsonb;
  v_business_snapshot   jsonb;
  v_signing_key_count   int;
begin
  select * into v_doc from documents where id = p_document_id for update;
  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: document % does not exist', p_document_id
      using errcode = 'P0001';
  end if;

  if not app.has_role(v_doc.business_id, array['owner', 'editor']::member_role[]) then
    raise exception 'INV_FORBIDDEN: not an owner/editor of this business'
      using errcode = 'P0001';
  end if;

  if v_doc.status <> 'draft' then
    raise exception 'INV_ALREADY_ISSUED: document % is already %', coalesce(v_doc.display_number, v_doc.id::text), v_doc.status
      using errcode = 'P0001';
  end if;

  select * into v_business from businesses where id = v_doc.business_id;
  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: business % does not exist', v_doc.business_id
      using errcode = 'P0001';
  end if;

  select count(*) into v_line_count from document_lines where document_id = v_doc.id;
  if v_line_count = 0 then
    raise exception 'INV_NO_LINES: document % has no line items', v_doc.id
      using errcode = 'P0001';
  end if;

  if v_doc.customer_id is null then
    raise exception 'INV_CUSTOMER_REQUIRED: document % has no customer', v_doc.id
      using errcode = 'P0001';
  end if;

  if v_business.entity_type = 'patur' and v_doc.type in ('tax_invoice', 'tax_invoice_receipt') then
    raise exception 'INV_TYPE_NOT_ALLOWED: % is not allowed for a patur business', v_doc.type
      using errcode = 'P0001';
  end if;

  if v_doc.type = 'credit_note' then
    if v_doc.parent_document_id is null or v_doc.credit_reason is null then
      raise exception 'INV_CREDIT_NEEDS_PARENT: credit_note requires parent_document_id and credit_reason'
        using errcode = 'P0001';
    end if;

    select * into v_parent from documents where id = v_doc.parent_document_id for update;
    if not found or v_parent.business_id <> v_doc.business_id then
      raise exception 'INV_CREDIT_NEEDS_PARENT: parent document not found in this business'
        using errcode = 'P0001';
    end if;
    if v_parent.status <> 'issued' then
      raise exception 'INV_CREDIT_NEEDS_PARENT: parent document is not issued'
        using errcode = 'P0001';
    end if;
    if v_parent.type = 'credit_note' then
      raise exception 'INV_CREDIT_OF_CREDIT: cannot issue a credit_note against another credit_note'
        using errcode = 'P0001';
    end if;
  end if;

  select rate into v_vat_rate
    from vat_rates
   where valid_from <= v_issue_date and (valid_to is null or valid_to >= v_issue_date)
   order by valid_from desc
   limit 1;

  if v_vat_rate is null then
    raise exception 'INV_NO_VAT_RATE: no vat_rates row covers %', v_issue_date
      using errcode = 'P0001';
  end if;

  if v_business.entity_type = 'patur' then
    v_vat_rate := 0;
  end if;

  select
    coalesce(sum(round(dl.quantity * dl.unit_price, 2)), 0),
    coalesce(sum(round(round(dl.quantity * dl.unit_price, 2) * dl.discount_percent / 100.0, 2)), 0)
    into v_subtotal, v_discount
    from document_lines dl
   where dl.document_id = v_doc.id;

  v_net := v_subtotal - v_discount;

  if v_business.entity_type = 'patur' then
    v_vat := 0;
  else
    select coalesce(sum(
             round(
               (round(dl.quantity * dl.unit_price, 2)
                - round(round(dl.quantity * dl.unit_price, 2) * dl.discount_percent / 100.0, 2))
               * (case dl.vat_treatment when 'standard' then v_vat_rate else 0 end) / 100.0,
             2)
           ), 0)
      into v_vat
      from document_lines dl
     where dl.document_id = v_doc.id;
  end if;

  v_total   := v_net + v_vat;
  v_payable := v_total;

  if v_doc.type = 'credit_note' and v_parent.credited_amount + v_total > v_parent.total_amount then
    raise exception 'INV_CREDIT_EXCEEDS_PARENT: credit % exceeds remaining parent balance %',
      v_total, (v_parent.total_amount - v_parent.credited_amount)
      using errcode = 'P0001';
  end if;

  if v_doc.type in ('receipt', 'tax_invoice_receipt') then
    select coalesce(sum(amount), 0) into v_payments_sum from payments where document_id = v_doc.id;
    if v_payments_sum <> v_payable then
      raise exception 'INV_PAYMENTS_MISMATCH: payments sum % does not match payable amount %',
        v_payments_sum, v_payable
        using errcode = 'P0001';
    end if;
  elsif v_doc.type = 'credit_note' and v_parent.type in ('receipt', 'tax_invoice_receipt') then
    select coalesce(sum(amount), 0) into v_payments_sum from payments where document_id = v_doc.id;
    if v_payments_sum <> -v_payable then
      raise exception 'INV_PAYMENTS_MISMATCH: refund payments sum % does not match -payable %',
        v_payments_sum, -v_payable
        using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_signing_key_count
    from business_signing_keys
   where business_id = v_doc.business_id and is_active;
  if v_signing_key_count = 0 then
    raise exception 'INV_NO_SIGNING_KEY: business % has no active signing key', v_doc.business_id
      using errcode = 'P0001';
  end if;

  select jsonb_build_object(
           'name', c.name,
           'tax_id', c.tax_id,
           'tax_id_type', c.tax_id_type,
           'address_line1', c.address_line1,
           'address_line2', c.address_line2,
           'city', c.city,
           'postal_code', c.postal_code,
           'country', c.country,
           'email', c.email::text,
           'phone', c.phone
         )
    into v_customer_snapshot
    from customers c
   where c.id = v_doc.customer_id;

  v_business_snapshot := jsonb_build_object(
    'legal_name', v_business.legal_name,
    'entity_type', v_business.entity_type,
    'tax_id', v_business.tax_id,
    'address_line1', v_business.address_line1,
    'address_line2', v_business.address_line2,
    'city', v_business.city,
    'postal_code', v_business.postal_code,
    'country', v_business.country,
    'phone', v_business.phone,
    'email', v_business.email::text,
    'logo_path', v_business.logo_path,
    'accent_color', v_business.accent_color,
    'invoice_footer_note', v_business.invoice_footer_note
  );

  v_tax_year := extract(year from v_issue_date)::int;

  insert into document_counters (business_id, document_type, tax_year, next_number, start_number)
  values (v_doc.business_id, v_doc.type, v_tax_year,
          app.seed_for(v_doc.business_id, v_doc.type, v_tax_year),
          app.seed_for(v_doc.business_id, v_doc.type, v_tax_year))
  on conflict (business_id, document_type, tax_year) do nothing;

  update document_counters
     set next_number = next_number + 1,
         last_issued_at = now()
   where business_id = v_doc.business_id and document_type = v_doc.type and tax_year = v_tax_year
  returning next_number - 1, number_prefix into v_number, v_prefix;

  v_display_number := coalesce(v_prefix, '') || v_number::text;

  update documents set
    business_entity_type = v_business.entity_type,
    subtotal_amount       = v_subtotal,
    discount_amount       = v_discount,
    net_amount            = v_net,
    vat_rate              = v_vat_rate,
    vat_amount            = v_vat,
    total_amount          = v_total,
    payable_amount        = v_payable,
    customer_snapshot     = v_customer_snapshot,
    business_snapshot     = v_business_snapshot,
    document_number       = v_number,
    tax_year              = v_tax_year,
    display_number        = v_display_number,
    issue_date            = v_issue_date,
    issued_at             = now(),
    issued_by             = auth.uid(),
    status                = 'issued',
    pdf_status            = 'pending'
  where id = v_doc.id
  returning * into v_doc;

  if v_doc.type = 'credit_note' then
    update documents
       set credited_amount = credited_amount + v_doc.total_amount
     where id = v_doc.parent_document_id;
  end if;

  insert into audit_log (business_id, actor_type, actor_id, action, table_name, record_id, after_data)
  values (v_doc.business_id, 'user', auth.uid(), 'issue', 'documents', v_doc.id, to_jsonb(v_doc));

  return v_doc;
end;
$$;

revoke execute on function app.issue_document(uuid, date) from public, anon;
grant  execute on function app.issue_document(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- Restore app.set_start_number exactly as defined in 0008_issue_function.sql.
-- ----------------------------------------------------------------------------

create or replace function app.set_start_number(
  p_business uuid,
  p_type document_type,
  p_year int,
  p_start bigint
) returns document_counters
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row document_counters%rowtype;
begin
  if not app.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'INV_NOT_OWNER: only an owner may set the start number'
      using errcode = 'P0001';
  end if;

  insert into document_counters (business_id, document_type, tax_year, start_number, next_number)
  values (p_business, p_type, p_year, p_start, p_start)
  on conflict (business_id, document_type, tax_year) do update
    set start_number = excluded.start_number,
        next_number  = excluded.next_number
    where document_counters.next_number = document_counters.start_number
  returning * into v_row;

  if not found then
    raise exception 'INV_COUNTER_ALREADY_STARTED: a document has already been issued in this series'
      using errcode = 'P0001';
  end if;

  insert into audit_log (business_id, actor_type, actor_id, action, table_name, after_data)
  values (p_business, 'user', auth.uid(), 'set_start_number', 'document_counters', to_jsonb(v_row));

  return v_row;
end;
$$;

revoke execute on function app.set_start_number(uuid, document_type, int, bigint) from public, anon;
grant  execute on function app.set_start_number(uuid, document_type, int, bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- Remove everything else 0009 added.
-- ----------------------------------------------------------------------------

drop trigger documents_set_updated_at on documents;

alter table document_lines drop constraint line_total_consistent;

drop trigger lines_values_compute_trg on document_lines;
drop function app.document_lines_compute();
drop function app.compute_line(numeric, numeric, numeric, vat_treatment, numeric);
