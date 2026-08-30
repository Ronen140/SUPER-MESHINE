-- Down for 0010_addendum_fixes.sql — restores every function this migration replaced back to
-- the exact bodies left behind by 0003a_core_tables.sql / 0006_audit.sql /
-- 0007_immutability.sql / 0009_amendments.sql (verbatim, including their original lack of an
-- explicit search_path and, for issue_document/document_lines_compute, the pre-Addendum-A′
-- issue_date/VAT-rate logic). This deliberately reintroduces the A′-2/A′-4 bugs — that is the
-- correct behavior for a down-migration (exact prior state), not a recommendation to run it.

-- ----------------------------------------------------------------------------
-- Restore public.issue_document() to 0009_amendments.sql's version.
-- ----------------------------------------------------------------------------

create or replace function public.issue_document(p_document_id uuid, p_issue_date date default null)
returns public.documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc                public.documents%rowtype;
  v_business            public.businesses%rowtype;
  v_parent              public.documents%rowtype;
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
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: document % does not exist', p_document_id
      using errcode = 'P0001';
  end if;

  if not app.has_role(v_doc.business_id, array['owner', 'editor']::public.member_role[]) then
    raise exception 'INV_FORBIDDEN: not an owner/editor of this business'
      using errcode = 'P0001';
  end if;

  if v_doc.status <> 'draft' then
    raise exception 'INV_ALREADY_ISSUED: document % is already %', coalesce(v_doc.display_number, v_doc.id::text), v_doc.status
      using errcode = 'P0001';
  end if;

  select * into v_business from public.businesses where id = v_doc.business_id;
  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: business % does not exist', v_doc.business_id
      using errcode = 'P0001';
  end if;

  select count(*) into v_line_count from public.document_lines where document_id = v_doc.id;
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

    select * into v_parent from public.documents where id = v_doc.parent_document_id for update;
    if not found or v_parent.business_id <> v_doc.business_id then
      raise exception 'INV_CREDIT_NEEDS_PARENT: parent document not found in this business'
        using errcode = 'P0001';
    end if;
    if v_parent.status <> 'issued' then
      raise exception 'INV_CREDIT_NEEDS_PARENT: parent document is not issued'
        using errcode = 'P0001';
    end if;
    if v_parent.type not in ('receipt', 'tax_invoice', 'tax_invoice_receipt') then
      raise exception 'INV_CREDIT_PARENT_TYPE: cannot credit a document of type %', v_parent.type
        using errcode = 'P0001';
    end if;
  end if;

  select rate into v_vat_rate
    from public.vat_rates
   where valid_from <= v_issue_date and (valid_to is null or valid_to >= v_issue_date)
   order by valid_from desc
   limit 1;

  if v_business.entity_type = 'patur' then
    v_vat_rate := 0;
  elsif v_vat_rate is null then
    raise exception 'INV_NO_VAT_RATE: no vat_rates row covers %', v_issue_date
      using errcode = 'P0001';
  end if;

  perform app.recompute_draft_lines(v_doc.id, v_issue_date);

  select
    coalesce(sum(dl.line_net + dl.discount_amount), 0),
    coalesce(sum(dl.discount_amount), 0),
    coalesce(sum(dl.line_net), 0),
    coalesce(sum(dl.line_vat), 0),
    coalesce(sum(dl.line_total), 0)
    into v_subtotal, v_discount, v_net, v_vat, v_total
    from public.document_lines dl
   where dl.document_id = v_doc.id;

  v_payable := v_total;

  if v_doc.type = 'credit_note' and v_parent.credited_amount + v_total > v_parent.total_amount then
    raise exception 'INV_CREDIT_EXCEEDS_PARENT: credit % exceeds remaining parent balance %',
      v_total, (v_parent.total_amount - v_parent.credited_amount)
      using errcode = 'P0001';
  end if;

  if v_doc.type in ('receipt', 'tax_invoice_receipt') then
    select coalesce(sum(amount), 0) into v_payments_sum from public.payments where document_id = v_doc.id;
    if v_payments_sum <> v_payable then
      raise exception 'INV_PAYMENTS_MISMATCH: payments sum % does not match payable amount %',
        v_payments_sum, v_payable
        using errcode = 'P0001';
    end if;
  elsif v_doc.type = 'credit_note' and v_parent.type in ('receipt', 'tax_invoice_receipt') then
    select coalesce(sum(amount), 0) into v_payments_sum from public.payments where document_id = v_doc.id;
    if v_payments_sum <> -v_payable then
      raise exception 'INV_PAYMENTS_MISMATCH: refund payments sum % does not match -payable %',
        v_payments_sum, -v_payable
        using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_signing_key_count
    from public.business_signing_keys
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
    from public.customers c
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

  insert into public.document_counters (business_id, document_type, tax_year, next_number, start_number)
  values (v_doc.business_id, v_doc.type, v_tax_year,
          app.seed_for(v_doc.business_id, v_doc.type, v_tax_year),
          app.seed_for(v_doc.business_id, v_doc.type, v_tax_year))
  on conflict (business_id, document_type, tax_year) do nothing;

  update public.document_counters
     set next_number = next_number + 1,
         last_issued_at = now()
   where business_id = v_doc.business_id and document_type = v_doc.type and tax_year = v_tax_year
  returning next_number - 1, number_prefix into v_number, v_prefix;

  v_display_number := coalesce(v_prefix, '') || v_number::text;

  update public.documents set
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
    update public.documents
       set credited_amount = credited_amount + v_doc.total_amount
     where id = v_doc.parent_document_id;
  end if;

  insert into public.audit_log (business_id, actor_type, actor_id, action, table_name, record_id, after_data)
  values (v_doc.business_id, 'user', auth.uid(), 'issue', 'documents', v_doc.id, to_jsonb(v_doc));

  return v_doc;
end;
$$;

revoke execute on function public.issue_document(uuid, date) from public, anon;
grant  execute on function public.issue_document(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- Restore app.document_lines_compute() to 0009_amendments.sql's version ("today's rate"
-- unconditionally, no v_issue_date lookup).
-- ----------------------------------------------------------------------------

create or replace function app.document_lines_compute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entity_type public.entity_type;
  v_as_of       date;
  v_vat_rate    numeric(5, 2);
  v_computed    record;
begin
  select business_entity_type into v_entity_type
    from public.documents
   where id = new.document_id;

  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: document % does not exist', new.document_id
      using errcode = 'P0001';
  end if;

  v_as_of := coalesce(nullif(current_setting('app.issuing_as_of', true), '')::date, current_date);

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

-- ----------------------------------------------------------------------------
-- Restore app.recompute_draft_lines() to 0009_amendments.sql's version (unqualified
-- document_lines, search_path = public, pg_temp).
-- ----------------------------------------------------------------------------

create or replace function app.recompute_draft_lines(p_document_id uuid, p_as_of date)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.issuing_as_of', p_as_of::text, true);
  update document_lines set quantity = quantity where document_id = p_document_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Restore app.child_rows_locked() to 0007_immutability.sql's version (unqualified
-- `document_status`/`documents`, no explicit search_path — the A′-4 bug, reintroduced
-- deliberately for exact rollback fidelity).
-- ----------------------------------------------------------------------------

create or replace function app.child_rows_locked()
returns trigger
language plpgsql
as $$
declare
  v_document_id uuid := coalesce(new.document_id, old.document_id);
  v_status document_status;
begin
  select status into v_status from documents where id = v_document_id;

  if tg_op = 'DELETE' and not found then
    return old;
  end if;

  if v_status is distinct from 'draft' then
    raise exception 'INV_IMMUTABLE_CHILD: document % is not a draft — % on % is not allowed',
      v_document_id, tg_op, tg_table_name
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

-- ----------------------------------------------------------------------------
-- Restore the remaining 0007_immutability.sql functions to their original (no search_path)
-- bodies.
-- ----------------------------------------------------------------------------

create or replace function app.documents_immutable()
returns trigger language plpgsql as $$
declare
  allowed text[] := array[
    'sent_at', 'sent_to', 'delivery_mode',
    'paid_amount', 'credited_amount', 'settled_at',
    'allocation_number', 'allocation_request_id', 'status',
    'internal_note', 'updated_at'
  ];
  computed text[] := array['signed_total'];
  before_j jsonb;
  after_j  jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'INV_IMMUTABLE_DELETE: a document that has been issued is never deleted (document %)', old.display_number
      using errcode = 'P0001';
  end if;

  if old.pdf_status <> 'ready' then
    allowed := allowed || array['pdf_status', 'pdf_original_path', 'pdf_copy_path',
                                'pdf_sha256', 'signing_key_id', 'signed_at', 'pdf_attempts', 'pdf_error'];
  end if;

  if new.status is distinct from old.status
     and not (old.status::text = 'pending_allocation' and new.status in ('issued', 'cancelled')) then
    raise exception 'INV_IMMUTABLE_STATUS: status transition % -> % is not allowed', old.status, new.status
      using errcode = 'P0001';
  end if;

  before_j := to_jsonb(old) - allowed - computed;
  after_j  := to_jsonb(new) - allowed - computed;
  if before_j is distinct from after_j then
    raise exception 'INV_IMMUTABLE_FIELDS: illegal change on document % — fields: %',
      old.display_number, (select string_agg(key, ', ') from jsonb_each(after_j)
                           where value is distinct from before_j -> key)
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function app.allocation_requests_locked()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'INV_ALLOCATION_IMMUTABLE: allocation_requests rows are never deleted (row %)', old.id
      using errcode = 'P0001';
  end if;
  if old.responded_at is not null then
    raise exception 'INV_ALLOCATION_IMMUTABLE: allocation_request % already has a response and cannot be updated', old.id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function app.documents_set_entity_type()
returns trigger
language plpgsql
as $$
begin
  select entity_type into new.business_entity_type
    from businesses where id = new.business_id;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Restore 0006_audit.sql's app.enforce_audit() / app.audit_log_immutable() to their
-- original (no search_path) bodies.
-- ----------------------------------------------------------------------------

create or replace function app.enforce_audit(p_table regclass)
returns void
language plpgsql
as $$
declare
  v_name text := regexp_replace(p_table::text, '^public\.', '');
begin
  execute format(
    'create trigger %I after insert or update or delete on %s for each row execute function app.audit_trigger()',
    v_name || '_audit_trg', p_table
  );
end;
$$;

create or replace function app.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'INV_AUDIT_IMMUTABLE: audit_log is append-only (row %)', coalesce(old.id, new.id)
    using errcode = 'P0001';
end;
$$;

-- ----------------------------------------------------------------------------
-- Restore 0003a_core_tables.sql's public.enforce_business_min_owner() /
-- public.protect_business_identity() to their original (no search_path, unqualified table)
-- bodies.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_business_min_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner_count int;
begin
  select count(*) into v_owner_count
    from business_members
   where business_id = old.business_id
     and role = 'owner';

  if v_owner_count = 0 then
    raise exception 'INV_NO_OWNER: business % must retain at least one owner', old.business_id
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.protect_business_identity()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'INV_IMMUTABLE_FIELD: businesses.created_by cannot be changed'
      using errcode = 'P0001';
  end if;
  if new.tax_id is distinct from old.tax_id then
    raise exception 'INV_IMMUTABLE_FIELD: businesses.tax_id cannot be changed'
      using errcode = 'P0001';
  end if;
  if new.entity_type is distinct from old.entity_type then
    raise exception 'INV_IMMUTABLE_FIELD: businesses.entity_type cannot be changed without an explicit migration procedure'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
