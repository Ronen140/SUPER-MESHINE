-- Down for 0007_immutability.sql — reverse order.

drop trigger if exists documents_set_entity_type_trg on documents;
drop function if exists app.documents_set_entity_type();

drop trigger if exists allocation_requests_locked_trg on allocation_requests;
drop function if exists app.allocation_requests_locked();

drop trigger if exists payments_locked_trg on payments;
drop trigger if exists lines_locked_trg on document_lines;
drop function if exists app.child_rows_locked();

drop trigger if exists documents_immutable_trg on documents;
drop function if exists app.documents_immutable();
