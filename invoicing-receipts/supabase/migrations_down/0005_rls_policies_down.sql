-- Down for 0005_rls_policies.sql — drop every policy, then disable RLS/FORCE, restoring
-- the tables to the schema-only state they were in right after 0003a/0003b.

drop policy if exists audit_log_read on audit_log;
alter table audit_log disable row level security;

drop policy if exists counters_read on document_counters;
alter table document_counters disable row level security;

drop policy if exists document_public_links_read on document_public_links;
drop policy if exists document_public_links_write on document_public_links;
alter table document_public_links disable row level security;

drop policy if exists allocation_requests_read on allocation_requests;
drop policy if exists allocation_requests_write on allocation_requests;
alter table allocation_requests disable row level security;

drop policy if exists payments_read on payments;
drop policy if exists payments_write on payments;
alter table payments disable row level security;

drop policy if exists document_lines_read on document_lines;
drop policy if exists document_lines_write on document_lines;
alter table document_lines disable row level security;

drop policy if exists documents_read on documents;
drop policy if exists documents_write on documents;
alter table documents disable row level security;

drop policy if exists customer_document_consents_read on customer_document_consents;
drop policy if exists customer_document_consents_write on customer_document_consents;
alter table customer_document_consents disable row level security;

drop policy if exists items_read on items;
drop policy if exists items_write on items;
alter table items disable row level security;

drop policy if exists customers_read on customers;
drop policy if exists customers_write on customers;
alter table customers disable row level security;

alter table business_signing_keys no force row level security;
alter table business_signing_keys disable row level security;

drop policy if exists bm_self on business_members;
drop policy if exists bm_peers on business_members;
drop policy if exists bm_manage on business_members;
alter table business_members disable row level security;

drop policy if exists businesses_read on businesses;
drop policy if exists businesses_update on businesses;
alter table businesses disable row level security;

drop policy if exists vat_rates_read on vat_rates;
alter table vat_rates disable row level security;

drop policy if exists users_self_read on users;
drop policy if exists users_self_update on users;
alter table users disable row level security;
