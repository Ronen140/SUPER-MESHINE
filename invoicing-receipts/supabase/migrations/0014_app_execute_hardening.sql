-- 0014_app_execute_hardening.sql
-- Fixes a real gap found empirically while writing B13's CI check (ז) against a fully
-- migrated database (not assumed from re-reading the migrations): `revoke execute on all
-- functions in schema app from public, anon, authenticated` (0004_rls_helpers.sql) is a
-- point-in-time statement — it only ever affected the functions that existed in `app` at
-- that moment (`current_business_ids`, `has_role`, both immediately re-granted narrowly per
-- ADR-INV-001 §D3/Amendment B-3). Every function added to `app` in every migration since
-- (0006's audit machinery, 0007's immutability triggers, 0008's `seed_for`, 0009's
-- `document_lines_compute`/`recompute_draft_lines`, 0013's `business_has_signing_key`) was
-- never covered by that revoke, and Postgres grants `EXECUTE` to `PUBLIC` by default on
-- every new function unless revoked — so `authenticated`/`anon` (both implicitly members of
-- `PUBLIC`) currently hold `EXECUTE` on all eleven of them.
--
-- This is not the same class of bug as `0010`'s `compute_line`/`0013`'s
-- `business_has_signing_key` fixes (those were "a legitimate internal caller cannot reach a
-- function it needs"); this is the mirror-image gap Amendment B-3 explicitly warned about —
-- an *unintended* grant that happens to be harmless today only because every one of these
-- eleven functions is either (a) a trigger function, never invoked via a direct client SQL
-- call regardless of EXECUTE (Postgres does not privilege-check trigger firing), or (b)
-- already blocked at the schema-USAGE layer for `anon`/`authenticated` (0004's `revoke all
-- on schema app`) even though EXECUTE itself is open. None of that makes the open grant
-- *correct* — it is exactly the "accidental protection" Amendment B-3 already rejected once
-- for a different pair of functions, and CI check (ז) (ADR-INV-001 Implementation Notes #2)
-- exists precisely to catch this drift.
--
-- Fix: revoke EXECUTE explicitly from public/anon/authenticated on every `app` function that
-- isn't one of the two RLS-policy helpers. No functional change for any legitimate caller —
-- every one of these functions is called either as a trigger (unaffected by EXECUTE) or from
-- within a SECURITY DEFINER `public.*` RPC that already owns them directly or (for
-- `business_has_signing_key`, owned by `service_role`) inherits that role's own privileges —
-- verified by re-running this project's entire test suite after applying this migration.

revoke execute on function app.audit_trigger()                                   from public, anon, authenticated;
revoke execute on function app.enforce_audit(regclass)                           from public, anon, authenticated;
revoke execute on function app.audit_log_immutable()                             from public, anon, authenticated;
revoke execute on function app.documents_immutable()                            from public, anon, authenticated;
revoke execute on function app.child_rows_locked()                              from public, anon, authenticated;
revoke execute on function app.allocation_requests_locked()                     from public, anon, authenticated;
revoke execute on function app.documents_set_entity_type()                      from public, anon, authenticated;
revoke execute on function app.seed_for(uuid, public.document_type, int)         from public, anon, authenticated;
revoke execute on function app.document_lines_compute()                         from public, anon, authenticated;
revoke execute on function app.recompute_draft_lines(uuid, date)                from public, anon, authenticated;
revoke execute on function app.business_has_signing_key(uuid)                   from public, anon, authenticated;
