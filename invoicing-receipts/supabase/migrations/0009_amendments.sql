-- 0009_amendments.sql
-- Corrective migration for two Amendments discovered/approved after 0004-0008 were already
-- committed and reviewed. Per ADR-INV-001 Implementation Notes #1 ("ה-migration המתקן הוא
-- ALTER FUNCTION ... SET SCHEMA public או drop+create ב-migration חדש — לא עריכה של קובץ
-- שכבר בוצע") and the explicit instruction for this round: 0007/0008 are NOT edited.
--
-- ADR-INV-002 Amendment A (§D8, D2 step 6א, D6 extended):
--   A-1: document_lines values (discount_amount/line_net/line_vat/line_total) were client-
--        writable with no server-side computation or consistency check — a document could
--        be issued whose printed line detail does not foot to its own header total.
--   A-2: credit_note could point at a price_quote/proforma_invoice parent (no income event
--        to reverse). Now parent.type must be in (receipt, tax_invoice, tax_invoice_receipt).
--   A-3: documents.updated_at was never touched by any trigger; documents_drafts_idx sorts
--        by updated_at desc, so the drafts list was silently mis-ordered.
--
-- ADR-INV-001 Amendment B (§D3.3): the RPC contract (issue_document, set_start_number) must
-- live in `public` (the only PostgREST-exposed schema) — `app` is confirmed to never be
-- exposed, so anything in `app` is unreachable via `supabase.rpc(...)` regardless of grants.
-- Internals (compute_line, seed_for, has_role, current_business_ids, trigger functions)
-- stay in `app`.
--
-- Scope note for this round specifically (per dispatch instructions): implements ADR-INV-002
-- Amendment A in full, and only the two `app.*` -> `public.*` RPC moves that A depends on
-- (issue_document, set_start_number). Amendment B's other items — the B-3 EXECUTE-grant
-- tightening on app.current_business_ids/app.has_role (0004), `public.create_business`
-- (still pending, was already "B9" and now becomes migration 0010), and `public.log_event`
-- (D11, "B9"+1) — are out of scope here and are not touched.

-- ============================================================================
-- app.compute_line() — ADR-INV-002 §D8. The single source of truth for every line-level
-- monetary value in the system. Called from app.document_lines_compute() (draft-time live
-- preview, below) and from public.issue_document() (issue-time authoritative recompute,
-- via the same trigger — see the comment on app.document_lines_compute() for why).
--
-- ⚠️ Warning required by the architect (ADR-INV-001 Implementation Notes #11, restated here
-- verbatim): "מקור האמת היחיד לכל סכום כספי במערכת. נקראת מ-app.document_lines_compute()
-- ומ-public.issue_document(). שינוי כאן משנה כל מסמך עתידי — דורש review של
-- erp-domain-expert."
-- ============================================================================

create or replace function app.compute_line(
  p_quantity          numeric,
  p_unit_price        numeric,
  p_discount_percent  numeric,
  p_vat_treatment     public.vat_treatment,
  p_vat_rate          numeric
) returns table (discount_amount numeric, line_net numeric,
                 line_vat numeric, line_total numeric)
language sql
immutable
set search_path = ''
as $$
  select d, n,
         v,
         round(n + v, 2)
  from (
    select round(gross * p_discount_percent / 100, 2) as d,
           round(gross - round(gross * p_discount_percent / 100, 2), 2) as n
    from (select round(p_quantity * p_unit_price, 2) as gross) g
  ) x,
  lateral (select case when p_vat_treatment = 'standard'
                       then round(x.n * p_vat_rate / 100, 2) else 0 end as v) y;
$$;

-- ============================================================================
-- app.document_lines_compute() — layer 1 (draft-time) AND layer 2 (issue-time) of
-- ADR-INV-002 §D8, sharing one trigger function rather than duplicating the
-- "look up the effective VAT rate, call app.compute_line(), assign to NEW" logic in two
-- places. public.issue_document()'s step 6a (below) re-fires this same trigger with a
-- transaction-local GUC (`app.issuing_as_of`) set to the authoritative issue_date instead
-- of leaving it to default to today — see the inline comment below for why a plain
-- UPDATE...FROM app.compute_line(...) from inside issue_document() would have been
-- silently overwritten by this very trigger, and why the GUC approach avoids that.
--
-- ⚠️ Judgment call flagged for architect review (not silently implemented): the ADR's
-- prose for layer 1 says the rate is "coalesce(parent.vat_rate, today's rate)". Literally
-- implemented, this is dead logic: `documents.vat_rate` is `not null default 0`
-- (0003b_document_tables.sql) and is only ever populated by public.issue_document() itself
-- — every draft (the only status this trigger ever runs against; app.child_rows_locked()
-- blocks line writes once issued) therefore always has `vat_rate = 0`, so `coalesce`
-- would always resolve to 0 and every draft line would preview at 0% VAT regardless of
-- entity_type, defeating layer 1's entire stated purpose (accurate live preview). This
-- migration uses "today's rate" (or `app.issuing_as_of` when set) unconditionally instead,
-- which is the reading that actually serves D8's purpose.
-- ============================================================================

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

-- Trigger name deliberately sorts *after* `lines_locked_trg` (0007_immutability.sql)
-- alphabetically ("lines_locked_trg" < "lines_values_compute_trg" since 'l' < 'v' at the
-- first differing character) — Postgres fires same-event BEFORE ROW triggers in trigger-
-- name order, and the lock check must run before the compute (ADR-INV-002 Implementation
-- Notes #12; not a correctness bug either way since child_rows_locked raises on the row
-- regardless, but running the compute first would be wasted work on a row about to be
-- rejected, and confusing to debug).
create trigger lines_values_compute_trg
  before insert or update on document_lines
  for each row
  execute function app.document_lines_compute();

-- ============================================================================
-- Layer 3 (ADR-INV-002 §D8): exact arithmetic invariant, no rounding function, no
-- cross-table reference — cannot fail due to a JS/Postgres rounding disagreement, only due
-- to an actual bypass of the trigger (e.g. a future migration that forgets it exists).
-- ============================================================================

alter table document_lines
  add constraint line_total_consistent check (line_total = line_net + line_vat);

-- ============================================================================
-- documents.updated_at (ADR-INV-002 Amendment A-3): moddatetime on *every* UPDATE, not
-- "only while draft" (that was always the wrong rule — documents_drafts_idx sorts by
-- updated_at desc, and updated_at is already on documents_immutable_trg's whitelist
-- specifically so post-issuance state changes like payment/PDF status are reflected in it).
-- ============================================================================

create trigger documents_set_updated_at
  before update on documents
  for each row
  execute function moddatetime(updated_at);

-- ============================================================================
-- ADR-INV-001 §D3.3 (Amendment B-2): the RPC contract moves to `public` — `app` is
-- confirmed unreachable via supabase.rpc()/PostgREST regardless of GRANT settings (it is
-- not, and will never be, in supabase/config.toml's `[api] schemas`). app.issue_document
-- and app.set_start_number (0008_issue_function.sql) are dropped and recreated in `public`
-- with the exact REVOKE/GRANT pattern the ADR specifies for every RPC-facing function, and
-- with `set search_path = ''` + fully-qualified names (ADR-INV-001 §D3, "hardening
-- סטנדרטי נגד search-path hijack... חל על כל 9 הפונקציות ב-whitelist של D3.2").
-- 0008_issue_function.sql itself is left untouched — this is the drop+create path the ADR
-- explicitly allows instead of editing an already-reviewed migration.
-- ============================================================================

drop function app.issue_document(uuid, date);
drop function app.set_start_number(uuid, public.document_type, int, bigint);

-- ----------------------------------------------------------------------------
-- app.recompute_draft_lines — isolates step 6a's DML into a function with an ordinary
-- (non-empty) search_path, instead of running it directly inline in
-- public.issue_document() (search_path='').
--
-- Why this indirection is necessary (found while verifying, not assumed): `SET search_path`
-- on a PL/pgSQL function scopes the GUC for that function's *entire* execution, including
-- anything it triggers as a side effect. public.issue_document()'s UPDATE on document_lines
-- fires *two* BEFORE ROW triggers: app.document_lines_compute() (this migration — fully
-- schema-qualified, safe under search_path='') and `lines_locked_trg` /
-- app.child_rows_locked() (0007_immutability.sql — declares `v_status document_status;`
-- with NO schema prefix, since it was written before this hardening convention existed and
-- is not edited here). Under search_path='', that bare type name fails to resolve
-- ("type document_status does not exist"), which surfaced only when step 6a's UPDATE was
-- run directly inside public.issue_document(). Routing the UPDATE through a helper with
-- `search_path = public, pg_temp` gives 0007's unqualified trigger body the ambient search
-- path it needs, without touching 0007 and without permanently weakening
-- public.issue_document()'s own hardening for its other 11 steps.
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
-- public.issue_document — ADR-INV-002 §D2, now 12 steps (6a inserted by Amendment A-1).
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
    -- ADR-INV-002 §D6 (Amendment A-2): a credit_note may only reverse a recognized income
    -- document. This positive list also subsumes "no credit-of-credit" (credit_note is not
    -- in it), replacing the narrower INV_CREDIT_OF_CREDIT check from 0008.
    if v_parent.type not in ('receipt', 'tax_invoice', 'tax_invoice_receipt') then
      raise exception 'INV_CREDIT_PARENT_TYPE: cannot credit a document of type %', v_parent.type
        using errcode = 'P0001';
    end if;
  end if;

  -- 6. determine the authoritative VAT rate for this issue_date (header display value;
  -- the per-line recompute in 6a derives its own rate from the same rule via
  -- app.issuing_as_of, since app.document_lines_compute() cannot see a local variable).
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

  -- 6a (ADR-INV-002 Amendment A-1, §D8 layer 2). Re-fire app.document_lines_compute() for
  -- every line of this document, this time rating against v_issue_date instead of today —
  -- covers a draft opened under one VAT rate and issued after a rate change. A plain
  -- `UPDATE document_lines SET line_net = ... FROM app.compute_line(...)` from here would
  -- be silently clobbered by this exact trigger firing again with *today's* rate on the
  -- same statement (BEFORE ROW triggers see the SET list, not the caller's intent) — so
  -- instead of duplicating app.compute_line()'s caller logic a second time in this
  -- function, `app.issuing_as_of` tells the *same* trigger which date to use, and a no-op
  -- write (`quantity = quantity`) is enough to make every row's BEFORE UPDATE trigger run.
  -- Done via app.recompute_draft_lines() rather than inline — see that function's comment
  -- for why running it directly here (search_path='') breaks 0007's child_rows_locked().
  perform app.recompute_draft_lines(v_doc.id, v_issue_date);

  -- 7. recompute the header purely by summing the lines that were *just* recomputed above
  -- — never from client-supplied header fields, and never by re-deriving amounts from raw
  -- quantity/unit_price here (that duplicated app.compute_line()'s formula in 0008 and is
  -- exactly the kind of second implementation Amendment A-1 exists to eliminate).
  -- subtotal (pre-discount gross) = line_net + discount_amount, summed.
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

  -- Payment matching: receipt/tax_invoice_receipt require sum(payments)=payable;
  -- a credit_note against one of those requires sum(payments)=-payable (refund, D6).
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

  -- Signing key check (ADR-INV-003 §D4 dependency) — a document cannot be issued if there
  -- is nothing that could ever sign its PDF.
  select count(*) into v_signing_key_count
    from public.business_signing_keys
   where business_id = v_doc.business_id and is_active;
  if v_signing_key_count = 0 then
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

  -- 10-11. transition to issued. old.status is still 'draft' at this point (this statement
  -- is the transition itself), so documents_immutable_trg's `when (old.status <> 'draft')`
  -- does not fire for this UPDATE — it only guards *subsequent* edits (ADR-INV-002 §D3).
  update public.documents set
    business_entity_type = v_business.entity_type,  -- refreshed at issue time (§D8)
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
    -- v_parent was locked with `for update` above; old.status='issued' here, so this UPDATE
    -- *does* fire documents_immutable_trg for the parent row — it passes because
    -- credited_amount is on the whitelist (0007_immutability.sql).
    update public.documents
       set credited_amount = credited_amount + v_doc.total_amount
     where id = v_doc.parent_document_id;
  end if;

  -- 12. app.audit_trigger() already logged the UPDATEs above automatically
  -- (0006_audit.sql); this explicit row records the business-semantic event on top.
  insert into public.audit_log (business_id, actor_type, actor_id, action, table_name, record_id, after_data)
  values (v_doc.business_id, 'user', auth.uid(), 'issue', 'documents', v_doc.id, to_jsonb(v_doc));

  return v_doc;
end;
$$;

revoke execute on function public.issue_document(uuid, date) from public, anon;
grant  execute on function public.issue_document(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- public.set_start_number — unchanged logic from 0008, moved schema + hardened per §D3.3.
-- ----------------------------------------------------------------------------

create or replace function public.set_start_number(
  p_business uuid,
  p_type public.document_type,
  p_year int,
  p_start bigint
) returns public.document_counters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.document_counters%rowtype;
begin
  if not app.has_role(p_business, array['owner']::public.member_role[]) then
    raise exception 'INV_NOT_OWNER: only an owner may set the start number'
      using errcode = 'P0001';
  end if;

  insert into public.document_counters as dc (business_id, document_type, tax_year, start_number, next_number)
  values (p_business, p_type, p_year, p_start, p_start)
  on conflict (business_id, document_type, tax_year) do update
    set start_number = excluded.start_number,
        next_number  = excluded.next_number
    where dc.next_number = dc.start_number
  returning * into v_row;

  if not found then
    raise exception 'INV_COUNTER_ALREADY_STARTED: a document has already been issued in this series'
      using errcode = 'P0001';
  end if;

  insert into public.audit_log (business_id, actor_type, actor_id, action, table_name, after_data)
  values (p_business, 'user', auth.uid(), 'set_start_number', 'document_counters', to_jsonb(v_row));

  return v_row;
end;
$$;

revoke execute on function public.set_start_number(uuid, public.document_type, int, bigint) from public, anon;
grant  execute on function public.set_start_number(uuid, public.document_type, int, bigint) to authenticated;
