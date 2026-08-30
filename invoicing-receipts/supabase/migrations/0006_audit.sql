-- 0006_audit.sql
-- ADR-INV-001 §D6, Implementation Notes #5. A single SECURITY DEFINER trigger function
-- (`app.audit_trigger`, #7 of the closed 7-function whitelist in §D3.2) applied to every
-- business_id-bearing table plus `businesses` itself (scope-root) — everything in D7's
-- "Business-scoped" + "Scope-root" categories except business_signing_keys (would leak
-- ciphertext into audit_log) and audit_log itself (would be self-referential).
--
-- Why SECURITY DEFINER is required here specifically: audit_log has NO insert policy for
-- `authenticated` at all (0005_rls_policies.sql) — by design, so that the only way in is
-- through this trigger. If this function ran as SECURITY INVOKER, the implicit INSERT it
-- performs when e.g. `authenticated` updates a `customers` row would run as that same
-- `authenticated` role and be rejected by audit_log's RLS, which would make the *original*
-- customers UPDATE fail too. Running as the function owner (`postgres`, unaffected by RLS
-- since audit_log has no FORCE) is what lets every write path — including any future one
-- nobody remembers to special-case — get audited transparently.

create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before      jsonb;
  v_after       jsonb;
  v_row         jsonb;
  v_business_id uuid;
  v_record_id   uuid;
  v_actor_email text;
  v_request_id  text;
begin
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after  := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row    := coalesce(v_after, v_before);

  -- `businesses` is the scope-root (ADR-INV-001 §D7): its own `id` IS the business_id.
  -- Every other audited table carries an explicit `business_id` column.
  if tg_table_name = 'businesses' then
    v_business_id := (v_row ->> 'id')::uuid;
  else
    v_business_id := (v_row ->> 'business_id')::uuid;
  end if;

  -- record_id: tables with a single-column `id` primary key expose it via the jsonb ->>
  -- lookup (returns null, not an error, if the key is absent). business_members and
  -- document_counters have composite primary keys and no `id` column — record_id stays
  -- null for those; the composite key is fully visible in before_data/after_data anyway.
  v_record_id := nullif(v_row ->> 'id', '')::uuid;

  v_actor_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  v_request_id  := nullif(current_setting('app.request_id', true), '');

  insert into audit_log (
    business_id, actor_type, actor_id, actor_email, action,
    table_name, record_id, before_data, after_data, request_id
  ) values (
    v_business_id,
    case when auth.uid() is not null then 'user'::actor_type else 'service'::actor_type end,
    auth.uid(),
    v_actor_email,
    lower(tg_op),
    tg_table_name,
    v_record_id,
    v_before,
    v_after,
    v_request_id
  );

  return coalesce(new, old);
end;
$$;

-- Helper (ADR-INV-001 Implementation Notes #5): attaches the trigger to one table by name,
-- so the 11 call sites below are one line each instead of a hand-repeated CREATE TRIGGER.
-- Not SECURITY DEFINER — it only ever runs once per table, at migration time, as the
-- migration-owning role, which already has the DDL privileges it needs.
create or replace function app.enforce_audit(p_table regclass)
returns void
language plpgsql
as $$
declare
  v_name text := regexp_replace(p_table::text, '^public\.', '');
begin
  execute format(
    'create trigger %I after insert or update or delete on %s for each row execute function app.audit_trigger()',
    v_name || '_audit_trg', p_table
  );
end;
$$;

-- Every business_id-bearing table except business_signing_keys/audit_log, plus businesses.
select app.enforce_audit('businesses');
select app.enforce_audit('business_members');
select app.enforce_audit('customers');
select app.enforce_audit('items');
select app.enforce_audit('customer_document_consents');
select app.enforce_audit('documents');
select app.enforce_audit('document_lines');
select app.enforce_audit('payments');
select app.enforce_audit('document_counters');
select app.enforce_audit('allocation_requests');
select app.enforce_audit('document_public_links');

-- audit_log itself is append-only: no whitelist, no exceptions, not even for service_role
-- (ADR-INV-002 §D3 — triggers fire regardless of RLS/BYPASSRLS, only RLS *policies* are
-- skipped by BYPASSRLS; DML triggers are not).
create or replace function app.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'INV_AUDIT_IMMUTABLE: audit_log is append-only (row %)', coalesce(old.id, new.id)
    using errcode = 'P0001';
end;
$$;

create trigger audit_log_immutable_trg
  before update or delete on audit_log
  for each row
  execute function app.audit_log_immutable();
