-- Down for 0014_app_execute_hardening.sql — restores the implicit PUBLIC-default EXECUTE
-- grant each function had immediately after its own migration created it.

grant execute on function app.audit_trigger()                                   to public;
grant execute on function app.enforce_audit(regclass)                           to public;
grant execute on function app.audit_log_immutable()                             to public;
grant execute on function app.documents_immutable()                            to public;
grant execute on function app.child_rows_locked()                              to public;
grant execute on function app.allocation_requests_locked()                     to public;
grant execute on function app.documents_set_entity_type()                      to public;
grant execute on function app.seed_for(uuid, public.document_type, int)         to public;
grant execute on function app.document_lines_compute()                         to public;
grant execute on function app.recompute_draft_lines(uuid, date)                to public;
grant execute on function app.business_has_signing_key(uuid)                   to public;
