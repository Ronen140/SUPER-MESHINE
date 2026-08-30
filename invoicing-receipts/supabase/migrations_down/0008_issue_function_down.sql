-- Down for 0008_issue_function.sql — reverse order.

drop function if exists app.set_start_number(uuid, document_type, int, bigint);
drop function if exists app.issue_document(uuid, date);
drop function if exists app.seed_for(uuid, document_type, int);
