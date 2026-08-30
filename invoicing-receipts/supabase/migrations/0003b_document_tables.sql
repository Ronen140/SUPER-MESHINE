-- 0003b_document_tables.sql
-- ADR-INV-001 §Schema — "documents" + "counters, allocation, public links, audit" tables.
-- Columns/constraints/indexes verbatim from the ADR, including Phase 2/3 columns
-- (allocation_number, allocation_request_id, withholding_rate, withholding_amount).
--
-- Filename note: paired with 0003a_core_tables.sql — see the header comment there for why
-- the ADR's single "0003_core_tables" migration is split a/b here instead of taking a plain
-- integer slot (keeps 0004_rls_helpers onward matching the ADR's canonical numbering).
--
-- As in 0003a_core_tables.sql: RLS (enable/force/policies) is NOT part of this migration,
-- even for document_counters and audit_log whose `enable/force row level security` +
-- (for counters) the `counters_read` policy appear inline in the ADR's schema listing.
-- `counters_read` depends on app.current_business_ids(), which does not exist until
-- 0004_rls_helpers.sql — so it, and every other RLS statement, is applied atomically in
-- 0005_rls_policies.sql instead. See B6 in vault/Engineering/invoicing-phase-0-plan.md.

-- ============================================================================
-- documents — the accounting document itself. See ADR-INV-002 for the immutability
-- trigger (0007) and app.issue_document() (0008) that operate on this table.
-- WARNING: any column added here later is immutable-by-default once a document is
-- issued (ADR-INV-002 §D3 default-deny whitelist) unless explicitly added to the
-- whitelist in app.documents_immutable(). This is deliberate — read the ADR first.
-- ============================================================================

create table documents (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete restrict,

  type                  document_type not null,
  status                document_status not null default 'draft',
  document_number       bigint,
  tax_year              int,
  display_number        text,
  issue_date            date,
  issued_at             timestamptz,
  due_date              date,

  parent_document_id    uuid,
  credit_reason         text,

  customer_id           uuid,
  customer_snapshot     jsonb,
  business_snapshot     jsonb,
  business_entity_type  entity_type not null,

  currency              char(3) not null default 'ILS',
  exchange_rate         numeric(18, 6) not null default 1,
  subtotal_amount       numeric(14, 2) not null default 0,
  discount_amount       numeric(14, 2) not null default 0,
  net_amount            numeric(14, 2) not null default 0,
  vat_rate              numeric(5, 2)  not null default 0,
  vat_amount            numeric(14, 2) not null default 0,
  total_amount          numeric(14, 2) not null default 0,
  withholding_rate      numeric(5, 2)  not null default 0,
  withholding_amount    numeric(14, 2) not null default 0,
  payable_amount        numeric(14, 2) not null default 0,
  signed_total          numeric(14, 2) generated always as
                          (case when type = 'credit_note' then -total_amount else total_amount end) stored,

  paid_amount           numeric(14, 2) not null default 0,
  credited_amount       numeric(14, 2) not null default 0,
  settled_at            timestamptz,

  delivery_mode         text not null default 'computerized'
                          check (delivery_mode in ('computerized', 'print')),
  sent_at               timestamptz,
  sent_to               text[],

  pdf_status            pdf_status not null default 'pending',
  pdf_original_path     text,
  pdf_copy_path         text,
  pdf_sha256            bytea,
  signing_key_id        uuid references business_signing_keys(id),
  signed_at             timestamptz,
  pdf_attempts          int not null default 0,
  pdf_error             text,

  allocation_number     text,
  allocation_request_id uuid,

  notes                 text,
  internal_note         text,

  created_by            uuid not null references users(id),
  issued_by             uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint documents_id_business_uk unique (id, business_id),
  foreign key (parent_document_id, business_id) references documents (id, business_id),
  foreign key (customer_id,        business_id) references customers (id, business_id),

  constraint draft_has_no_number check (status <> 'draft' or document_number is null),
  constraint issued_is_complete  check (
    status = 'draft' or (document_number is not null and tax_year is not null
                         and issued_at is not null and issue_date is not null
                         and customer_snapshot is not null and business_snapshot is not null)),
  constraint credit_needs_parent check (
    type <> 'credit_note' or (parent_document_id is not null and credit_reason is not null)),
  constraint amounts_non_negative check (total_amount >= 0 and net_amount >= 0),
  constraint credited_within_total check (credited_amount <= total_amount),
  constraint ils_only_phase1 check (currency = 'ILS'),
  constraint doc_type_allowed_for_entity check (
    business_entity_type <> 'patur' or type not in ('tax_invoice', 'tax_invoice_receipt')),
  constraint patur_has_no_vat check (
    business_entity_type <> 'patur' or (vat_rate = 0 and vat_amount = 0))
);

create unique index documents_number_uk
  on documents (business_id, type, tax_year, document_number)
  where document_number is not null;

create index documents_list_idx     on documents (business_id, status, issue_date desc);
create index documents_customer_idx on documents (business_id, customer_id, issue_date desc);
create index documents_drafts_idx   on documents (business_id, updated_at desc) where status = 'draft';
create index documents_parent_idx   on documents (parent_document_id) where parent_document_id is not null;
create index documents_pdf_retry_idx on documents (business_id, pdf_attempts) where pdf_status = 'failed';
create index documents_open_idx     on documents (business_id, due_date)
  where status = 'issued' and settled_at is null;

-- ============================================================================
-- document_lines — snapshot line items. business_id is denormalized on purpose (RLS
-- without a join once RLS lands in 0006).
-- ============================================================================

create table document_lines (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null,
  business_id       uuid not null,
  line_number       int  not null,
  item_id           uuid,
  name              text not null,
  description       text,
  quantity          numeric(14, 3) not null default 1,
  unit              text,
  unit_price        numeric(14, 2) not null,
  discount_percent  numeric(5, 2)  not null default 0,
  discount_amount   numeric(14, 2) not null default 0,
  vat_treatment     vat_treatment not null default 'standard',
  line_net          numeric(14, 2) not null,
  line_vat          numeric(14, 2) not null default 0,
  line_total        numeric(14, 2) not null,
  foreign key (document_id, business_id) references documents (id, business_id) on delete cascade,
  foreign key (item_id,     business_id) references items     (id, business_id),
  unique (document_id, line_number),
  constraint discount_pct_range check (discount_percent between 0 and 100)
);
create index document_lines_doc_idx on document_lines (business_id, document_id, line_number);

-- ============================================================================
-- payments — recorded receipts against a document. No full card number / CVV ever
-- stored — last 4 digits + auth number is enough for a receipt and keeps this out of
-- PCI scope.
-- ============================================================================

create table payments (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null,
  business_id    uuid not null,
  line_number    int  not null,
  method         payment_method not null,
  amount         numeric(14, 2) not null,
  payment_date   date not null,
  bank_name text, bank_branch text, bank_account text,
  check_number text, check_due_date date,
  card_brand text, card_last4 char(4), card_auth_number text, installments int,
  reference      text,
  notes          text,
  foreign key (document_id, business_id) references documents (id, business_id) on delete cascade,
  unique (document_id, line_number),
  constraint payment_amount_nonzero check (amount <> 0),
  constraint card_last4_digits check (card_last4 is null or card_last4 ~ '^[0-9]{4}$')
);
create index payments_doc_idx on payments (business_id, document_id);

-- ============================================================================
-- document_counters — one row per (business, document_type, tax_year). Written only by
-- app.issue_document() / app.set_start_number() (0008) via `UPDATE ... RETURNING`
-- (ADR-INV-002 §D1) — never a Postgres SEQUENCE. RLS (SELECT-only, no write policy at
-- all) is added in 0006_rls_policies.sql.
-- ============================================================================

create table document_counters (
  business_id     uuid not null references businesses(id) on delete restrict,
  document_type   document_type not null,
  tax_year        int not null,
  number_prefix   text not null default '',
  start_number    bigint not null default 1,
  next_number     bigint not null,
  last_issued_at  timestamptz,
  created_at      timestamptz not null default now(),
  primary key (business_id, document_type, tax_year),
  constraint counter_forward check (next_number >= start_number)
);

-- ============================================================================
-- allocation_requests — Phase 2 (tax-authority allocation-number API); the table is
-- created in Phase 0 so the immutable-after-response trigger (0007) and Phase 2 code
-- never need a migration on a table that may already hold rows. Never deleted — this is
-- evidence against the tax authority.
-- ============================================================================

create table allocation_requests (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete restrict,
  document_id       uuid not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected', 'error', 'not_required')),
  threshold_amount  numeric(14, 2),
  requested_at      timestamptz not null default now(),
  responded_at      timestamptz,
  request_payload   jsonb not null,
  response_payload  jsonb,
  allocation_number text,
  rejection_code    text,
  rejection_reason  text,
  http_status       int,
  attempt           int not null default 1,
  foreign key (document_id, business_id) references documents (id, business_id)
);
create index alloc_doc_idx    on allocation_requests (business_id, document_id, attempt);
create index alloc_status_idx on allocation_requests (business_id, status, requested_at desc);

-- ============================================================================
-- document_public_links — anonymous, tokenized read access to a single document
-- (served by the service_role "public viewer" path, ADR-INV-001 §D5).
-- ============================================================================

create table document_public_links (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete restrict,
  document_id    uuid not null,
  token_sha256   bytea not null,
  serves_original boolean not null default false,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz,
  revoked_at     timestamptz,
  view_count     int not null default 0,
  last_viewed_at timestamptz,
  foreign key (document_id, business_id) references documents (id, business_id)
);
create unique index dpl_token_uk on document_public_links (token_sha256);

-- ============================================================================
-- audit_log — append-only. Written by app.audit_trigger() (0007) on every business_id-
-- bearing table except business_signing_keys/audit_log itself, plus explicit inserts for
-- non-DML events (send, download, view_public, export, key_create, key_revoke, ...).
-- RLS (SELECT for business members, no write policy at all) is added in 0006; the
-- immutability trigger that blocks UPDATE/DELETE even for service_role is added in 0007.
-- ============================================================================

create table audit_log (
  id           bigint generated always as identity primary key,
  business_id  uuid references businesses(id),
  occurred_at  timestamptz not null default now(),
  actor_type   actor_type not null,
  actor_id     uuid,
  actor_email  text,
  action       text not null,
  table_name   text,
  record_id    uuid,
  before_data  jsonb,
  after_data   jsonb,
  request_id   text,
  ip           inet,
  user_agent   text
);
create index audit_record_idx on audit_log (business_id, table_name, record_id, occurred_at desc);
create index audit_recent_idx on audit_log (business_id, occurred_at desc);
create index audit_actor_idx  on audit_log (business_id, actor_id, occurred_at desc);
