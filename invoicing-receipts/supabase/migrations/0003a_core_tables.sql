-- 0003a_core_tables.sql
-- ADR-INV-001 §Schema — "global" + "businesses & membership" + "signing keys" +
-- "customers, catalog, consents" tables. Columns/constraints/indexes verbatim from the ADR.
--
-- Filename note: the ADR's own Implementation Notes #1 lists a single "0003_core_tables"
-- migration. The engineering plan (vault/Engineering/invoicing-phase-0-plan.md, B3/B4) splits
-- it into 0003a (this file, core/global/membership tables) and 0003b (document tables) for
-- reviewable chunk size, using a letter suffix specifically so every migration number *after*
-- 0003 still matches the ADR's canonical numbering exactly (0004_rls_helpers, 0005_rls_policies,
-- ... 0009_create_business) — no renumbering needed downstream.
--
-- RLS (enable/force/policies) is deliberately NOT part of this migration for ANY table,
-- including business_signing_keys and document_counters even though the ADR's schema
-- listing shows their `enable/force row level security` inline: the generic RLS pass runs
-- as a single later migration (0004_rls_helpers.sql / 0005_rls_policies.sql) so that every
-- table becomes RLS-protected in one atomic, reviewable step. Until then this migration
-- creates tables with RLS *disabled* — acceptable because there is no data and no
-- non-migration write path yet.
--
-- NOTE (ADR-INV-001 Amendment A, applied 2026-08-30 while this migration was in progress):
-- `businesses` gets RLS policies (§D3.1) and `app.create_business()` (§D10) in later
-- migrations (B6/B9) — out of scope here. The one piece of Amendment A that IS schema-level
-- (not RLS/security-definer dependent) is `businesses_protect_identity_trg` below, which
-- this migration includes since it directly guards the `businesses` table B3 creates.

-- ============================================================================
-- Generic updated_at maintenance (ADR-INV-001 Implementation Notes #4: businesses,
-- customers, items get auto-touched updated_at on every UPDATE). Plain trigger function
-- instead of the `moddatetime` contrib extension to avoid an extra extension dependency
-- for one column per table.
-- ============================================================================

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- users — profile extension of auth.users. Identity source of truth is Supabase Auth;
-- this table only adds the app-specific profile fields the UI needs.
-- ============================================================================

create table users (
  id           uuid primary key references auth.users(id) on delete restrict,
  full_name    text not null,
  phone        text,
  locale       text not null default 'he',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keeps public.users in sync with auth.users on signup. `security definer` because the
-- trigger fires as part of Supabase Auth's own insert into auth.users, which does not run
-- with a role that otherwise has insert rights on public.users.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, full_name, locale)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'משתמש חדש'
    ),
    coalesce(new.raw_user_meta_data->>'locale', 'he')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- ============================================================================
-- vat_rates — statutory VAT rate by effective date range. No business_id (ADR-INV-001 §D7
-- closed list). service_role-only writes; no write policy is ever added for `authenticated`.
-- ============================================================================

create table vat_rates (
  rate         numeric(5, 2) not null,
  valid_from   date not null,
  valid_to     date,
  primary key (valid_from),
  constraint vat_range check (valid_to is null or valid_to > valid_from)
);

insert into vat_rates (rate, valid_from, valid_to) values
  (17.00, date '2015-10-01', date '2024-12-31'),
  (18.00, date '2025-01-01', null);

-- ============================================================================
-- businesses — the tenant root. No business_id column (it IS the root); RLS for this
-- table is an open architect escalation (see vault/Engineering/invoicing-phase-0-plan.md
-- §Escalation) and is explicitly out of scope for B3/B4/B6.
-- ============================================================================

create table businesses (
  id                     uuid primary key default gen_random_uuid(),
  legal_name             text not null,
  display_name           text,
  entity_type            entity_type not null,
  tax_id                 text not null,
  tax_id_type            text not null default 'vat'
                           check (tax_id_type in ('vat', 'company', 'id')),

  address_line1          text,
  address_line2          text,
  city                   text,
  postal_code            text,
  country                char(2) not null default 'IL',
  phone                  text,
  email                  citext,
  website                text,

  logo_path              text,
  accent_color           text not null default '#0f766e',
  invoice_footer_note    text,

  default_payment_terms_days int not null default 0,
  numbering_reset_policy text not null default 'continuous'
                           check (numbering_reset_policy in ('continuous', 'yearly')),

  is_active              boolean not null default true,
  created_by             uuid not null references users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint tax_id_digits check (tax_id ~ '^[0-9]{9}$'),
  constraint businesses_id_entity_uk unique (id, entity_type)
);

create unique index businesses_tax_id_uk on businesses (tax_id);

-- ADR-INV-001 §D3.1 (Amendment A-1): created_by/tax_id/entity_type are immutable after
-- creation. tax_id changing would sever historical documents from the legal entity that
-- issued them; entity_type changing is a regulatory event that needs an explicit procedure
-- (see the ADR's Reversal Conditions), not a form edit.
create function public.protect_business_identity()
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

create trigger businesses_protect_identity_trg
  before update on businesses
  for each row
  execute function public.protect_business_identity();

create trigger businesses_set_updated_at
  before update on businesses
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- business_members — many-to-many user<->business, with role. "At least one owner"
-- (ADR-INV-001 §D4) enforced here as a trigger, independent of RLS.
-- ============================================================================

create table business_members (
  business_id  uuid not null references businesses(id) on delete restrict,
  user_id      uuid not null references users(id)      on delete restrict,
  role         member_role not null default 'owner',
  invited_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on business_members (user_id);

create function public.enforce_business_min_owner()
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

create trigger business_members_min_owner_trg
  after delete or update on business_members
  for each row
  execute function public.enforce_business_min_owner();

-- ============================================================================
-- business_signing_keys — full detail in ADR-INV-003. RLS (enable+force, zero policies —
-- default deny, service_role only) is applied in 0006_rls_policies.sql, not here.
-- No audit trigger is ever attached to this table (ADR-INV-001 schema comment) — key
-- lifecycle events are written to audit_log manually with metadata only, never ciphertext.
-- ============================================================================

create table business_signing_keys (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references businesses(id) on delete restrict,
  algorithm               text not null default 'RSA-3072',
  certificate_pem         text not null,
  certificate_serial      text not null,
  subject_dn              text not null,
  fingerprint_sha256      bytea not null,
  not_before              timestamptz not null,
  not_after               timestamptz not null,

  private_key_ciphertext  bytea not null,
  private_key_nonce       bytea not null,
  wrapped_dek             bytea not null,
  kek_id                  text  not null,

  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  revoked_at              timestamptz,
  revoke_reason           text
);
create unique index bsk_active_uk on business_signing_keys (business_id) where is_active;

-- ============================================================================
-- customers — per-business customer/contact records.
-- ============================================================================

create table customers (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete restrict,
  name                  text not null,
  tax_id                text,
  tax_id_type           text check (tax_id_type in ('vat', 'company', 'id', 'foreign')),
  email                 citext,
  phone                 text,
  address_line1         text,
  address_line2         text,
  city                  text,
  postal_code           text,
  country               char(2) not null default 'IL',
  payment_terms_days    int,
  withholding_tax_rate  numeric(5, 2) not null default 0,
  notes                 text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint customers_id_business_uk unique (id, business_id)
);
create index        customers_lookup_idx on customers (business_id, is_active, name);
create unique index customers_taxid_uk   on customers (business_id, tax_id) where tax_id is not null;

create trigger customers_set_updated_at
  before update on customers
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- items — per-business catalog of billable work/products.
-- ============================================================================

create table items (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references businesses(id) on delete restrict,
  name                 text not null,
  description          text,
  default_unit_price   numeric(14, 2),
  unit                 text not null default 'יח׳',
  default_vat_treatment vat_treatment not null default 'standard',
  is_active            boolean not null default true,
  usage_count          int not null default 0,
  last_used_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint items_id_business_uk unique (id, business_id)
);
create unique index items_name_uk on items (business_id, lower(name)) where is_active;
create index        items_recent_idx on items (business_id, last_used_at desc nulls last);

create trigger items_set_updated_at
  before update on items
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- customer_document_consents — consent to receive computerized ("original") documents
-- electronically, per Hozer Mas Hachnasa 24/2004. consent_text is a snapshot, not a
-- pointer to current wording (this row is itself part of the books of account).
-- ============================================================================

create table customer_document_consents (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete restrict,
  customer_id   uuid not null,
  channel       consent_channel not null,
  consented_at  timestamptz not null,
  consent_text  text not null,
  evidence      jsonb not null default '{}'::jsonb,
  revoked_at    timestamptz,
  revoke_reason text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  foreign key (customer_id, business_id) references customers (id, business_id)
);
create unique index consent_active_uk on customer_document_consents (business_id, customer_id)
  where revoked_at is null;
