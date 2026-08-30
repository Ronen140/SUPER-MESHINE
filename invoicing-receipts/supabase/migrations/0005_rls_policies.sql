-- 0005_rls_policies.sql
-- ADR-INV-001 §D3/§D3.1/§D3.2/§D7. Enables RLS on every one of the 15 tables created in
-- 0003a/0003b, and applies the policies for all four D7 scoping categories:
--   1. Business-scoped (business_id)      — customers, items, customer_document_consents,
--                                            documents, document_lines, payments,
--                                            document_counters, allocation_requests,
--                                            document_public_links, business_signing_keys,
--                                            audit_log, business_members
--   2. Scope-root (id)                    — businesses
--   3. Self-scoped (id = auth.uid())      — users
--   4. Reference data, global             — vat_rates
--
-- FORCE ROW LEVEL SECURITY (Amendment A-4, §D3.2) is applied to EXACTLY ONE table —
-- business_signing_keys. Every other table gets ENABLE only: the SECURITY DEFINER
-- functions this whole design depends on (app.current_business_ids, app.has_role, and
-- later app.issue_document/app.audit_trigger/app.create_business) run as their owner
-- (`postgres`, the migration role), and FORCE would make even the owner subject to
-- policies — which would break every one of those functions the moment they touch a
-- table with no matching write policy (document_counters, audit_log). See the ADR's
-- Amendment Log for the exact runtime failure mode this caused before it was caught.

-- ============================================================================
-- 3. Self-scoped: users
-- ============================================================================

alter table users enable row level security;

create policy users_self_read on users for select to authenticated
  using (id = auth.uid());

create policy users_self_update on users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert/delete policy: the row is created by on_auth_user_created (0003a), which runs
-- as the table owner (no FORCE here) and so is unaffected by the absence of a policy.

-- ============================================================================
-- 4. Reference data, global: vat_rates
-- ============================================================================

alter table vat_rates enable row level security;

create policy vat_rates_read on vat_rates for select to authenticated
  using (true);

-- No write policy at all — service_role only (statutory rate table, not app data).

-- ============================================================================
-- 2. Scope-root: businesses (§D3.1, Amendment A-1)
-- ============================================================================

alter table businesses enable row level security;

create policy businesses_read on businesses for select to authenticated
  using (id in (select app.current_business_ids()));

create policy businesses_update on businesses for update to authenticated
  using      (app.has_role(id, array['owner']::member_role[]))
  with check (app.has_role(id, array['owner']::member_role[]));

-- No INSERT policy — the only legitimate write path is app.create_business() (§D10, B9).
-- No DELETE policy — ever. businesses_protect_identity_trg (0003a) still guards
-- created_by/tax_id/entity_type even through this UPDATE policy.

-- ============================================================================
-- 1. Business-scoped: business_members (§D3 — the recursion-breaking case)
-- ============================================================================

alter table business_members enable row level security;

create policy bm_self on business_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy bm_peers on business_members for select to authenticated
  using (business_id in (select app.current_business_ids()));

create policy bm_manage on business_members for all to authenticated
  using      (app.has_role(business_id, array['owner']::member_role[]))
  with check (app.has_role(business_id, array['owner']::member_role[]));

-- ============================================================================
-- 1. Business-scoped: business_signing_keys — the ONE table with FORCE, zero policies.
-- ============================================================================

alter table business_signing_keys enable row level security;
alter table business_signing_keys force row level security;
-- No policies, ever. ENABLE + FORCE + zero policies = unconditional deny for every role
-- except service_role (BYPASSRLS, which is unaffected by FORCE — ADR-INV-001 §D3.2).

-- ============================================================================
-- 1. Business-scoped: the generic customers_read/customers_write pattern, applied
-- identically to 8 tables per the ADR's D3 template and the B6 spec's explicit list.
-- ============================================================================

alter table customers enable row level security;
create policy customers_read on customers for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy customers_write on customers for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

alter table items enable row level security;
create policy items_read on items for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy items_write on items for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

alter table customer_document_consents enable row level security;
create policy customer_document_consents_read on customer_document_consents for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy customer_document_consents_write on customer_document_consents for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

alter table documents enable row level security;
create policy documents_read on documents for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy documents_write on documents for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));
-- No policy allows `UPDATE documents SET status = 'issued'` as a *general* write — the
-- documents_write policy above does grant UPDATE broadly, but app.documents_immutable()
-- (0007_immutability.sql) is what actually stops direct status/content edits once a
-- document is no longer draft. That trigger, not this policy, is the enforcement layer
-- ADR-INV-002 §D2 refers to ("אין ל-authenticated שום policy שמאפשרת UPDATE ... status").

alter table document_lines enable row level security;
create policy document_lines_read on document_lines for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy document_lines_write on document_lines for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

alter table payments enable row level security;
create policy payments_read on payments for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy payments_write on payments for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

alter table allocation_requests enable row level security;
create policy allocation_requests_read on allocation_requests for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy allocation_requests_write on allocation_requests for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

alter table document_public_links enable row level security;
create policy document_public_links_read on document_public_links for select to authenticated
  using (business_id in (select app.current_business_ids()));
create policy document_public_links_write on document_public_links for all to authenticated
  using      (app.has_role(business_id, array['owner', 'editor']::member_role[]))
  with check (app.has_role(business_id, array['owner', 'editor']::member_role[]));

-- ============================================================================
-- 1. Business-scoped: document_counters — SELECT only. Writes exist solely through
-- app.issue_document()/app.set_start_number() (both SECURITY DEFINER, 0008), which bypass
-- RLS as the table owner because this table is not FORCE'd.
-- ============================================================================

alter table document_counters enable row level security;
create policy counters_read on document_counters for select to authenticated
  using (business_id in (select app.current_business_ids()));

-- ============================================================================
-- 1. Business-scoped: audit_log — SELECT only. Writes exist solely through
-- app.audit_trigger() (SECURITY DEFINER, 0006), which bypasses RLS as the table owner.
-- business_id is nullable here (account-level events); such rows are invisible to
-- everyone under this policy, which is acceptable — there is no "member" of a null
-- business to show them to.
-- ============================================================================

alter table audit_log enable row level security;
create policy audit_log_read on audit_log for select to authenticated
  using (business_id in (select app.current_business_ids()));
