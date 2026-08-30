-- 0002_enums.sql
-- ADR-INV-001 §D2. Postgres native enums, not text+CHECK — these values are legal/regulatory
-- categories, not product-configurable options. See ADR-INV-001 §D2 for the "why enum" rationale
-- and for the two additive (non-breaking) extensions planned for Phase 2:
--   - document_status will gain 'pending_allocation' (ADR-INV-002 §D5)
--   - payment_method may gain 'withholding' (Phase 2 withholding-tax-as-payment-component)

create type entity_type as enum ('patur', 'murshe');

create type document_type as enum (
  'receipt',
  'tax_invoice',
  'tax_invoice_receipt',
  'proforma_invoice',
  'credit_note',
  'price_quote'
);

create type document_status as enum ('draft', 'issued', 'cancelled');

create type payment_method as enum (
  'cash',
  'check',
  'bank_transfer',
  'credit_card',
  'bit',
  'paypal',
  'other'
);

create type vat_treatment as enum ('standard', 'zero', 'exempt');

create type member_role as enum ('owner', 'editor', 'viewer', 'accountant');

create type pdf_status as enum ('pending', 'rendering', 'ready', 'failed');

create type consent_channel as enum ('web', 'email', 'written', 'verbal_recorded');

create type actor_type as enum ('user', 'service', 'system', 'anonymous');
