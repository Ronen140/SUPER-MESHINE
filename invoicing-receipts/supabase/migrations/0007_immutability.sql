-- 0007_immutability.sql
-- ADR-INV-002 §D3. Documents that have left `draft` are immutable except for an explicit,
-- default-deny whitelist. None of these functions are SECURITY DEFINER — they only ever
-- need to see rows the calling `authenticated` user can already see under RLS (they are
-- reading the very row being written, or a parent the write policy already required
-- membership for), so plain SECURITY INVOKER is correct and keeps the whitelist in
-- ADR-INV-001 §D3.2 unchanged.

-- ============================================================================
-- documents: default-deny whitelist trigger (ADR-INV-002 §D3, verbatim).
-- ============================================================================

create or replace function app.documents_immutable()
returns trigger language plpgsql as $$
declare
  -- Built as "always-allowed, plus PDF/signing fields unless the PDF is already final"
  -- rather than the ADR's literal "start with everything, then subtract the PDF fields
  -- once ready" — `text[] - text[]` is not a valid Postgres operator (array `-` only
  -- removes a single scalar element, not another array; verified empirically, this is not
  -- pseudocode that happens to also be valid SQL). The two constructions are logically
  -- equivalent; this one actually runs.
  allowed text[] := array[
    -- delivery state
    'sent_at', 'sent_to', 'delivery_mode',
    -- derived state: payment and credit
    'paid_amount', 'credited_amount', 'settled_at',
    -- Phase 2: allocation result
    'allocation_number', 'allocation_request_id', 'status',
    -- non-printed internal note
    'internal_note', 'updated_at'
  ];
  -- `signed_total` is `generated always as (...) stored` (0003b_document_tables.sql). No
  -- INSERT/UPDATE can ever set it directly — Postgres rejects that at parse time — but
  -- inside a BEFORE UPDATE trigger `NEW.signed_total` is always NULL regardless of
  -- `NEW.total_amount` (verified empirically: generated STORED columns are computed by the
  -- executor *after* BEFORE ROW triggers run, so the trigger never sees the new value).
  -- Comparing it here would therefore flag *every* legitimate whitelisted edit (e.g.
  -- `paid_amount`) as an illegal change, since old.signed_total (real value) would always
  -- differ from new.signed_total (NULL). It is excluded from the diff entirely rather than
  -- added to `allowed`, because unlike the whitelist fields above it can never be
  -- maliciously set in the first place — any real tampering with it is already caught via
  -- its sole input, `total_amount`.
  computed text[] := array['signed_total'];
  before_j jsonb;
  after_j  jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'INV_IMMUTABLE_DELETE: a document that has been issued is never deleted (document %)', old.display_number
      using errcode = 'P0001';
  end if;

  -- PDF / signing state is editable only while the pipeline hasn't produced a final
  -- artifact yet. Once pdf_status='ready', those fields freeze too.
  if old.pdf_status <> 'ready' then
    allowed := allowed || array['pdf_status', 'pdf_original_path', 'pdf_copy_path',
                                'pdf_sha256', 'signing_key_id', 'signed_at', 'pdf_attempts', 'pdf_error'];
  end if;

  -- status: only pending_allocation -> issued|cancelled is a legal transition here.
  -- `old.status::text = 'pending_allocation'` (not a bare enum-literal comparison): the
  -- Phase 0/1 `document_status` enum created in 0002_enums.sql is only
  -- ('draft','issued','cancelled') — 'pending_allocation' is an ADDITIVE Phase 2 value
  -- (ADR-INV-001 §D2 / ADR-INV-002 §D5) that does not exist yet. A bare
  -- `old.status = 'pending_allocation'` fails to even compile the comparison in Phase 0/1
  -- ("invalid input value for enum document_status") — verified empirically. Casting to
  -- text sidesteps that and needs no further change once Phase 2 adds the enum value: for
  -- now this simply always evaluates false, which is correct — in Phase 0/1 'issued' is a
  -- true final state (ADR-INV-002 §D5), so once old.status is already non-draft, no status
  -- change is ever legal.
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

create trigger documents_immutable_trg
  before update or delete on documents
  for each row when (old.status <> 'draft')
  execute function app.documents_immutable();

-- ============================================================================
-- document_lines / payments: locked while the parent document is not a draft.
--
-- Fix applied here vs. a naive reading of the ADR's one-line description ("בודק
-- parent.status <> 'draft' ⇒ exception"): when a *draft* document is deleted, `ON DELETE
-- CASCADE` fires this trigger's DELETE on document_lines/payments from *within the same
-- statement* as the parent's own DELETE. At that point `SELECT status FROM documents
-- WHERE id = ...` returns NO ROW (Postgres command-counter visibility — the parent row is
-- already gone from this statement's snapshot), not the pre-delete 'draft' value. A naive
-- `v_status IS DISTINCT FROM 'draft'` treats NULL as "not draft" and would make it
-- IMPOSSIBLE to ever delete a draft document that has lines — directly contradicting
-- ADR-INV-002 Implementation Notes #8 ("טיוטה שלא נגעו בה 180 יום ניתנת למחיקה"). Verified
-- this failure mode empirically (not assumed) before writing the fix below: a missing
-- parent during DELETE only ever happens because that parent's own deletion already passed
-- documents_immutable_trg's own draft-only-delete check, so treating "parent gone, we are
-- mid-DELETE" as "allow" is safe and exactly matches intent. INSERT/UPDATE keep strict
-- behavior — a genuinely missing parent there indicates a real bug, not a cascade.
-- ============================================================================

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

create trigger lines_locked_trg
  before insert or update or delete on document_lines
  for each row execute function app.child_rows_locked();

create trigger payments_locked_trg
  before insert or update or delete on payments
  for each row execute function app.child_rows_locked();

-- ============================================================================
-- allocation_requests: never deleted; immutable once the tax authority has responded
-- (ADR-INV-002 §D3 — "תשובת רשות המסים היא ראיה").
-- ============================================================================

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

create trigger allocation_requests_locked_trg
  before update or delete on allocation_requests
  for each row execute function app.allocation_requests_locked();

-- ============================================================================
-- documents: business_entity_type snapshot populated at draft-creation time (ADR-INV-001
-- §D8). Re-populated again at issue time by app.issue_document() itself (0008) — a
-- document is born legally at the moment of issuance, not at draft-creation time.
-- ============================================================================

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

create trigger documents_set_entity_type_trg
  before insert on documents
  for each row execute function app.documents_set_entity_type();
