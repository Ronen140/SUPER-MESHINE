-- Down for 0004_rls_helpers.sql
-- Safe only once every migration that added functions into schema `app` (0006, 0008, 0009
-- in the full plan; 0006/0007/0008 within this batch) has already been rolled back —
-- `drop schema app` (no CASCADE) fails loudly if anything was left behind, which is the
-- point: it is a safety net against an incomplete down script elsewhere.

drop function if exists app.has_role(uuid, member_role[]);
drop function if exists app.current_business_ids();
drop schema if exists app;
