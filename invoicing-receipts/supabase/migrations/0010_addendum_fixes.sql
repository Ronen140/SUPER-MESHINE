-- 0010_addendum_fixes.sql
-- Corrective migration for ADR-INV-002 "Addendum A′" (architect review of the actual
-- 0009_amendments.sql implementation, commit 7f50e53) — mandatory, must land before B13's
-- CI is built (per explicit dispatch instruction). Per the same "never edit an
-- already-committed migration" rule used for 0009, 0007/0008/0009 are NOT touched here;
-- every fix below is a `create or replace function` in this new migration.
--
-- Numbering note: this migration was built in the same round as B9 (public.create_business)
-- and B10 (storage buckets), which the dispatched plan had provisionally as "migration
-- 0010"/"0011". Since neither existed yet on disk when this round started, this fix round
-- takes 0010 and B9/B10 shift to 0011/0012 — no renumbering of anything already committed.
--
-- Three independent fixes, all from ADR-INV-002's Amendment Log § "Addendum A′":
--
-- A′-2 (🔴 live, unreported bug): public.issue_document() computed
--   `v_issue_date := coalesce(p_issue_date, current_date)`, silently ignoring and then
--   overwriting any `documents.issue_date` the user had set on the draft (e.g. a
--   deliberately backdated receipt was silently issued dated today) — silent data loss on
--   an immutable document. Fixed to `coalesce(p_issue_date, v_doc.issue_date, current_date)`,
--   plus a new `INV_FUTURE_ISSUE_DATE` rejection (a document cannot be dated after the
--   moment it is issued). `tax_year` (step 9, unchanged call site) is derived from the
--   now-correct v_issue_date automatically.
--
-- A′-1 / A′-3 (VAT-rate-in-draft correction, confirmed dead code + refined rule):
--   app.document_lines_compute()'s layer-1 (draft-time) rate lookup used
--   `coalesce(app.issuing_as_of, current_date)` unconditionally ("today's rate") in 0009.
--   The architect's confirmed fix is to also fall back through the document's own
--   `issue_date` before `current_date` — the exact same rule issue_document()'s layer 2
--   uses — so a backdated draft previews at the VAT rate that will actually apply at issue
--   time, not always today's rate.
--
-- A′-4 (root-cause search_path fix, "לסגור לפני B13, לא אחריו" — ADR-INV-002 Implementation
--   Notes #14): app.recompute_draft_lines() (0009) exists only to isolate step 6a's DML from
--   public.issue_document()'s `search_path=''`, because app.child_rows_locked() (0007)
--   declares `v_status document_status` with no schema qualification and has no explicit
--   `set search_path` at all, so it breaks when fired as a side effect of a caller running
--   under search_path=''. The workaround was approved as an interim measure, but the ADR
--   requires the root cause fixed: every function in `app`/`public` must have an explicit
--   `set search_path`, enforced going forward by a new CI meta-check (ח, ADR-INV-001
--   §Implementation Notes #2, "next"). This migration schema-qualifies
--   app.child_rows_locked() and adds `set search_path = ''` to it, and does the same for
--   every other function in `app`/`public` that was missing one (found by an actual query
--   against pg_proc/pg_namespace mirroring the CI check itself — see the verification note
--   at the bottom of this file — not by re-reading each migration file and guessing).
--   Once child_rows_locked() is fixed, app.recompute_draft_lines() is no longer working
--   around someone else's bug (ADR-INV-002 Implementation Notes #14, last bullet) — it
--   remains, because it still cleanly isolates step 6a's GUC + no-op-write pattern, but its
--   own search_path is tightened from `public, pg_temp` to `''` now that nothing it fires
--   (directly or via the trigger it re-triggers) depends on an ambient search path anymore.

-- ============================================================================
-- Functions that only needed an explicit `set search_path` added (no logic change) —
-- found missing one entirely in 0003a_core_tables.sql / 0006_audit.sql / 0007_immutability.sql.
-- None of these read any table other than via NEW/OLD record fields except where noted, so
-- `set search_path = ''` is safe without further qualification except where a table/type
-- name is touched (called out per-function below).
-- ============================================================================

-- 0003a_core_tables.sql — no unqualified table/type reference in the body.
create or replace function public.protect_business_identity()
returns trigger
language plpgsql
set search_path = ''
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

-- 0003a_core_tables.sql — references `business_members` unqualified; schema-qualified here.
create or replace function public.enforce_business_min_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_count int;
begin
  select count(*) into v_owner_count
    from public.business_members
   where business_id = old.business_id
     and role = 'owner';

  if v_owner_count = 0 then
    raise exception 'INV_NO_OWNER: business % must retain at least one owner', old.business_id
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

-- 0006_audit.sql — no unqualified table/type reference in the body (only NEW/OLD/tg_*).
create or replace function app.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'INV_AUDIT_IMMUTABLE: audit_log is append-only (row %)', coalesce(old.id, new.id)
    using errcode = 'P0001';
end;
$$;

-- 0006_audit.sql — migration-time-only DDL helper (never called at request time), still in
-- scope for CI check (ח) since it filters on schema+prokind only, not on how the function is
-- used. `p_table::text` under search_path='' always renders schema-qualified
-- ("public.<table>"), which regexp_replace already strips — identical output to before.
create or replace function app.enforce_audit(p_table regclass)
returns void
language plpgsql
set search_path = ''
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

-- 0007_immutability.sql — no unqualified table/type reference (only NEW/OLD, tg_table_name,
-- and array-of-text-literal construction; `text` and `jsonb` are pg_catalog built-ins,
-- always resolvable regardless of search_path).
create or replace function app.documents_immutable()
returns trigger language plpgsql set search_path = '' as $$
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

-- 0007_immutability.sql — root-cause fix (A′-4). `v_status` schema-qualified to
-- `public.document_status`, `documents` schema-qualified to `public.documents`, and an
-- explicit `set search_path = ''` added — this is the exact bug app.recompute_draft_lines()
-- (0009) was routing around. Logic is otherwise byte-for-byte identical to 0007's version,
-- including the deliberate "parent row gone during a cascade DELETE = allowed" exception
-- (see 0007_immutability.sql's own comment for why that is correct and is NOT touched here).
create or replace function app.child_rows_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_document_id uuid := coalesce(new.document_id, old.document_id);
  v_status public.document_status;
begin
  select status into v_status from public.documents where id = v_document_id;

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

-- 0007_immutability.sql — no unqualified table/type reference (only OLD.id/NEW.id).
create or replace function app.allocation_requests_locked()
returns trigger
language plpgsql
set search_path = ''
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

-- 0007_immutability.sql — references `businesses` unqualified; schema-qualified here.
create or replace function app.documents_set_entity_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select entity_type into new.business_entity_type
    from public.businesses where id = new.business_id;
  return new;
end;
$$;

-- ============================================================================
-- app.recompute_draft_lines() (0009_amendments.sql) — tightened now that the root cause in
-- child_rows_locked() above is fixed. `document_lines` schema-qualified; search_path
-- narrowed from `public, pg_temp` to `''` (ADR-INV-002 Implementation Notes #14, last
-- bullet: "אחרי התיקון, app.recompute_draft_lines() יכול להישאר... אך ה-search_path שלו
-- יהודק ל-''"). No behavior change — it still exists purely to isolate step 6a's
-- GUC-plus-no-op-write pattern from public.issue_document()'s own search_path='' (see that
-- function's comment, unchanged, for why the indirection itself is still worth keeping).
-- ============================================================================

create or replace function app.recompute_draft_lines(p_document_id uuid, p_as_of date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.issuing_as_of', p_as_of::text, true);
  update public.document_lines set quantity = quantity where document_id = p_document_id;
end;
$$;

-- ============================================================================
-- app.document_lines_compute() (0009_amendments.sql) — layer 1 VAT-rate fix (A′-1 confirmed,
-- A′-3 refinement). Adds `v_issue_date` to the initial lookup and folds it into the
-- `coalesce` ahead of `current_date`, matching layer 2's rule exactly. Everything else
-- (compute_line() call, trigger name/ordering, the layer-3 CHECK) is unchanged.
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

  -- ADR-INV-002 Addendum A′-1/A′-3: the rate a *draft* line previews at is derived from the
  -- document's own issue_date (same rule as layer 2's issue-time recompute), not
  -- unconditionally "today". `app.issuing_as_of` (set only by
  -- app.recompute_draft_lines()/public.issue_document()'s step 6a) still overrides both when
  -- present, since it carries the one case this coalesce chain cannot see on its own: an
  -- explicit `p_issue_date` RPC argument that differs from the draft's own issue_date.
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

-- ============================================================================
-- public.issue_document() (0009_amendments.sql) — A′-2 fix. Only the issue_date handling
-- changes (declare block + new step 3a); every other step is byte-for-byte identical to
-- 0009's version. Diffed against 0009_amendments.sql before writing this to keep the change
-- minimal and reviewable.
-- ============================================================================

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

  -- 3a. Determine the authoritative issue_date (ADR-INV-002 §D2, Addendum A′-2). Priority:
  -- an explicit RPC argument wins over whatever the user set on the draft, which wins over
  -- today. The previous `coalesce(p_issue_date, current_date)` silently discarded a
  -- user-entered backdate and then overwrote it (step 10 below) with today's date — silent
  -- data loss on a document that cannot be corrected after issuance. A document also cannot
  -- be dated after the moment it is actually issued.
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
  -- Done via app.recompute_draft_lines() rather than inline — that function's own comment
  -- (this migration) explains why the indirection is still needed even after
  -- child_rows_locked()'s root-cause search_path fix, above.
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

-- create or replace does not reset grants for an unchanged signature; the REVOKE/GRANT pair
-- 0009 already applied to public.issue_document(uuid, date) still stands. Restated here only
-- as a defensive no-op so this migration is self-contained if ever read in isolation.
revoke execute on function public.issue_document(uuid, date) from public, anon;
grant  execute on function public.issue_document(uuid, date) to authenticated;

-- ============================================================================
-- Verification note (not executed as part of the migration): before writing the fixes
-- above, the CI check (ח) query itself (ADR-INV-002 Implementation Notes #14) was run
-- against a fully-migrated local DB to enumerate every function in `app`/`public` missing
-- an explicit search_path, rather than re-reading each prior migration file and guessing
-- which ones qualified. That query, after this migration, returns zero rows — see this
-- round's status report / vault entry for the exact verification transcript.
-- ============================================================================
