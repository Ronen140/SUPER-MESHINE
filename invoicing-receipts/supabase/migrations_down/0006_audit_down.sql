-- Down for 0006_audit.sql — reverse order.

drop trigger if exists audit_log_immutable_trg on audit_log;
drop function if exists app.audit_log_immutable();

drop trigger if exists document_public_links_audit_trg on document_public_links;
drop trigger if exists allocation_requests_audit_trg on allocation_requests;
drop trigger if exists document_counters_audit_trg on document_counters;
drop trigger if exists payments_audit_trg on payments;
drop trigger if exists document_lines_audit_trg on document_lines;
drop trigger if exists documents_audit_trg on documents;
drop trigger if exists customer_document_consents_audit_trg on customer_document_consents;
drop trigger if exists items_audit_trg on items;
drop trigger if exists customers_audit_trg on customers;
drop trigger if exists business_members_audit_trg on business_members;
drop trigger if exists businesses_audit_trg on businesses;

drop function if exists app.enforce_audit(regclass);
drop function if exists app.audit_trigger();
