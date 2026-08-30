-- 0013_signing_key_check.sql
-- Fixes a live, previously-undiscovered bug found while building this round's B11 isolation
-- suite (specifically, while making the test harness's `db_owner` a real non-superuser table
-- owner — see tests/db/harness.ts's `OWNER_ROLE` comment for why that change was necessary
-- for the tests to be meaningful at all). Flagged for architect confirmation, same treatment
-- as the `compute_line` schema move in `0010_addendum_fixes.sql`.
--
-- The bug: `public.issue_document()`'s "signing key check" step does
--   `select count(*) from public.business_signing_keys where business_id = ... and is_active`
-- `business_signing_keys` has `FORCE ROW LEVEL SECURITY` and *zero* policies (ADR-INV-001
-- §D3.2 — "אין ולא תהיה אף policy... service_role בלבד, מתוקף BYPASSRLS שגובר על FORCE").
-- `issue_document()` is `SECURITY DEFINER`, so this SELECT runs as the function's *owner*
-- (the project's `postgres`-equivalent role) — and FORCE explicitly applies RLS even to the
-- table's own owner, exempting only a role with `BYPASSRLS` (`service_role`). The owner is
-- not `service_role` and has no policy to fall back on, so this SELECT returns 0 rows for
-- every business, every time — meaning `issue_document()` could never succeed against a real,
-- non-superuser Supabase project role, regardless of whether an active signing key actually
-- exists. This was invisible in every prior round's manual verification because local testing
-- ran everything as the literal Postgres bootstrap *superuser*, which bypasses FORCE
-- unconditionally (superusers are exempt from RLS full stop, independent of ownership) —
-- exactly the same class of gap Amendment A-4 already flagged for `app.current_business_ids()`
-- (§D3.2's own reasoning: relying on `postgres` having implicit RLS-bypass behavior is a
-- platform assumption, not a documented contract).
--
-- The fix: a single new function, narrowly scoped to an existence check with zero data
-- exposure (no ciphertext, no row, not even which key — just a boolean), owned by
-- `service_role` so its own body's query benefits from `BYPASSRLS` regardless of who calls
-- it. This is a *tenth* SECURITY DEFINER function, outside ADR-INV-001 §D3.2's closed
-- 9-function whitelist as currently written — the CI check (ה) whitelist and the ADR itself
-- need the architect to add it. Not adding it silently: `scripts/ci-schema-checks.sql` (B13)
-- lists it explicitly, with the same comment, rather than quietly expanding the SQL literal
-- to make the check pass unnoticed.
--
-- Why a new function rather than the alternatives considered:
--   - Adding a policy to business_signing_keys: contradicts the ADR's explicit "אין ולא תהיה
--     אף policy" — not this migration's call to make.
--   - Making `postgres`/`db_owner` a BYPASSRLS role: exactly the platform-assumption
--     Amendment A-4 already rejected, this time for a real functional reason instead of a
--     hypothetical one — would also silently defeat FORCE's entire purpose for every other
--     query `issue_document()` or any other definer function ever runs against this table.
--   - Making `issue_document()` itself owned by `service_role`: functionally works (it
--     already does its own explicit `app.has_role()` membership check as its real security
--     boundary, independent of table ownership), but widens the trust surface of one of the
--     most complex functions in the system instead of confining the fix to one small,
--     single-purpose, easily-audited function. The narrower change is preferred.

create or replace function app.business_has_signing_key(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_signing_keys
     where business_id = p_business_id and is_active
  )
$$;

-- `ALTER ... OWNER TO` requires the *new* owner to hold CREATE on the containing schema
-- (Postgres will not let ownership move to a role that couldn't have created the object
-- there itself) — `service_role` never received that (0004_rls_helpers.sql only ever
-- addressed `anon`/`authenticated`). Granting it is safe: `service_role` is already the
-- single most-trusted role in this system (BYPASSRLS, ADR-INV-001 §D5's three closed
-- service_role paths), and this grant is schema-level DDL capability, not data access.
grant usage, create on schema app to service_role;

-- Ownership (not grants) is what makes BYPASSRLS apply to this function's own query —
-- SECURITY DEFINER runs as the function's *owner*, and only `service_role` has BYPASSRLS.
alter function app.business_has_signing_key(uuid) owner to service_role;

-- Deliberately no revoke/grant pair here (unlike every `public.*` RPC): this function is
-- never meant to be called by a client at all, only from within public.issue_document() —
-- which already can (see this file's own header comment: `db_owner` owns schema `app`, so
-- schema USAGE was never the barrier for it, only for `anon`/`authenticated`). Leaving the
-- default PUBLIC execute grant in place changes nothing for `anon`/`authenticated`, who are
-- still blocked at the schema-USAGE layer exactly like every other `app.*` function besides
-- `current_business_ids()`/`has_role()`.

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
  v_issue_date          date;
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
begin
  -- 1. lock the document row.
  select * into v_doc from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: document % does not exist', p_document_id
      using errcode = 'P0001';
  end if;

  -- 2. membership/role check — SECURITY DEFINER bypasses RLS, so this is the only guard.
  if not app.has_role(v_doc.business_id, array['owner', 'editor']::public.member_role[]) then
    raise exception 'INV_FORBIDDEN: not an owner/editor of this business'
      using errcode = 'P0001';
  end if;

  -- 3. state check.
  if v_doc.status <> 'draft' then
    raise exception 'INV_ALREADY_ISSUED: document % is already %', coalesce(v_doc.display_number, v_doc.id::text), v_doc.status
      using errcode = 'P0001';
  end if;

  -- 3a. Determine the authoritative issue_date (ADR-INV-002 §D2, Addendum A′-2).
  v_issue_date := coalesce(p_issue_date, v_doc.issue_date, current_date);

  if v_issue_date > current_date then
    raise exception 'INV_FUTURE_ISSUE_DATE: issue date % is in the future', v_issue_date
      using errcode = 'P0001';
  end if;

  -- 4. load the business (drives the entity_type refresh + snapshot + VAT logic below).
  select * into v_business from public.businesses where id = v_doc.business_id;
  if not found then
    raise exception 'INV_DOCUMENT_NOT_FOUND: business % does not exist', v_doc.business_id
      using errcode = 'P0001';
  end if;

  -- 5. content validations.
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

  -- 6. determine the authoritative VAT rate for this issue_date.
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

  -- 6a (ADR-INV-002 Amendment A-1, §D8 layer 2).
  perform app.recompute_draft_lines(v_doc.id, v_issue_date);

  -- 7. recompute the header purely by summing the lines that were *just* recomputed above.
  select
    coalesce(sum(dl.line_net + dl.discount_amount), 0),
    coalesce(sum(dl.discount_amount), 0),
    coalesce(sum(dl.line_net), 0),
    coalesce(sum(dl.line_vat), 0),
    coalesce(sum(dl.line_total), 0)
    into v_subtotal, v_discount, v_net, v_vat, v_total
    from public.document_lines dl
   where dl.document_id = v_doc.id;

  v_payable := v_total; -- Phase 1: no withholding-as-payment-component yet.

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

  -- Signing key check (ADR-INV-003 §D4 dependency) — fixed this migration (see header
  -- comment): routed through app.business_has_signing_key() (owned by service_role) instead
  -- of querying public.business_signing_keys directly, which FORCE + zero policies made
  -- always-empty for this function's own (non-bypassrls) owner.
  if not app.business_has_signing_key(v_doc.business_id) then
    raise exception 'INV_NO_SIGNING_KEY: business % has no active signing key', v_doc.business_id
      using errcode = 'P0001';
  end if;

  -- 8. freeze snapshots (ADR-INV-002 §D4 — exact field lists).
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

  -- 9. allocate the number (ADR-INV-002 §D1: UPDATE ... RETURNING, never a SEQUENCE).
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

  -- 10-11. transition to issued.
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

  -- 12. explicit business-semantic audit row.
  insert into public.audit_log (business_id, actor_type, actor_id, action, table_name, record_id, after_data)
  values (v_doc.business_id, 'user', auth.uid(), 'issue', 'documents', v_doc.id, to_jsonb(v_doc));

  return v_doc;
end;
$$;

revoke execute on function public.issue_document(uuid, date) from public, anon;
grant  execute on function public.issue_document(uuid, date) to authenticated;
