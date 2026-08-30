-- scripts/ci-schema-checks.sql
-- B13. Eight meta-checks against a fully-migrated database's catalogs, run with
-- `psql -v ON_ERROR_STOP=1 -f`. Each check is a `DO` block that raises an exception (failing
-- the whole script, and the CI step, with a descriptive message) if its underlying query
-- returns any row — chosen over bare `SELECT`s specifically so a single `psql -f` invocation
-- is enough to pass/fail cleanly in CI, with no separate output-parsing step needed.
--
-- Numbering note: the Batch 3 dispatch described "6 meta-checks (including new ח)". The ADR
-- itself (ADR-INV-001 Implementation Notes #2, as amended by Amendment B and by ADR-INV-002's
-- Addendum A′) actually specifies EIGHT: א through ח — Amendment B added (ו) and (ז) before
-- this batch even started, and the dispatch's "6" undercounts them (the same kind of
-- vault/plan-vs-ADR drift this project has hit before — see
-- vault/Meeting Notes/invoicing-receipts-system.md). All eight are implemented here since the
-- ADR, not the dispatch summary, is the source of truth.
--
-- Whitelist note (ה): 10 functions, not the ADR's currently-written 9 —
-- `app.business_has_signing_key(uuid)` (0013_signing_key_check.sql) is a real, necessary fix
-- for a live bug (see that migration's header comment), but it is a NEW SECURITY DEFINER
-- function outside ADR-INV-001 §D3.2's closed list as currently worded. Included here
-- explicitly, commented, pending architect sign-off — not silently omitted, and not silently
-- normalized into "9" by relaxing the check.

\set ON_ERROR_STOP on

-- (א) table in public without RLS enabled
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_bad is not null then
    raise exception '(א) table(s) in public without RLS enabled: %', v_bad;
  end if;
end $$;

-- (ב) FORCE applied anywhere other than exactly business_signing_keys
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relforcerowsecurity <> (c.relname = 'business_signing_keys');
  if v_bad is not null then
    raise exception '(ב) FORCE mismatch (must be exactly business_signing_keys): %', v_bad;
  end if;
end $$;

-- (ג) scoping map: every public table must carry business_id unless in the closed exception list
do $$
declare v_bad text;
begin
  with expected(relname) as (values ('businesses'), ('users'), ('vat_rates'))
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  left join expected e on e.relname = c.relname
  where n.nspname = 'public' and c.relkind = 'r' and e.relname is null
    and not exists (select 1 from pg_attribute a
                    where a.attrelid = c.oid and a.attname = 'business_id'
                      and a.attnum > 0 and not a.attisdropped);
  if v_bad is not null then
    raise exception '(ג) table(s) missing business_id and not in the scoping exception list: %', v_bad;
  end if;
end $$;

-- (ד) table with business_id (or businesses itself) missing an app.audit_trigger() trigger
do $$
declare v_bad text;
begin
  with auditable(relname) as (
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('business_signing_keys', 'audit_log')
      and (c.relname = 'businesses'
           or exists (select 1 from pg_attribute a
                      where a.attrelid = c.oid and a.attname = 'business_id'
                        and a.attnum > 0 and not a.attisdropped))
  )
  select string_agg(a.relname, ', ') into v_bad
  from auditable a
  where not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where c.relname = a.relname and pn.nspname = 'app' and p.proname = 'audit_trigger'
  );
  if v_bad is not null then
    raise exception '(ד) table(s) missing app.audit_trigger(): %', v_bad;
  end if;
end $$;

-- (ה) SECURITY DEFINER functions outside the closed whitelist (10 — see header note)
do $$
declare v_bad text;
begin
  with whitelist(oid) as (
    values
      (to_regprocedure('app.current_business_ids()')),
      (to_regprocedure('app.has_role(uuid, public.member_role[])')),
      (to_regprocedure('app.audit_trigger()')),
      (to_regprocedure('public.handle_new_auth_user()')),
      (to_regprocedure('public.create_business(text, public.entity_type, text, text, text)')),
      (to_regprocedure('public.issue_document(uuid, date)')),
      (to_regprocedure('public.set_start_number(uuid, public.document_type, integer, bigint)')),
      (to_regprocedure('public.send_document(uuid, text[])')),
      (to_regprocedure('public.log_event(uuid, text, text, uuid, jsonb)')),
      (to_regprocedure('app.business_has_signing_key(uuid)'))
  )
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef and n.nspname in ('public', 'app')
    and p.oid not in (select oid from whitelist where oid is not null);
  if v_bad is not null then
    raise exception '(ה) SECURITY DEFINER function(s) outside the closed whitelist: %', v_bad;
  end if;
end $$;

-- (ו) function in public reachable by anon (excluding trigger functions, which PostgREST
-- never exposes, and extension-owned functions — see (ח)'s comment on why pgcrypto/citext
-- land in public with default PUBLIC-execute in a vanilla Postgres install; they are not
-- this project's RPC surface and were never meant to be scoped by this check)
do $$
declare v_bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'execute');
  if v_bad is not null then
    raise exception '(ו) function(s) in public reachable by anon: %', v_bad;
  end if;
end $$;

-- (ז) EXECUTE on schema app granted to authenticated beyond the two RLS-policy helper functions
do $$
declare v_bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and has_function_privilege('authenticated', p.oid, 'execute')
    and p.oid not in (
      to_regprocedure('app.current_business_ids()'),
      to_regprocedure('app.has_role(uuid, public.member_role[])')
    );
  if v_bad is not null then
    raise exception '(ז) app function(s) with EXECUTE granted to authenticated beyond the two policy helpers: %', v_bad;
  end if;
end $$;

-- (ח) function in public/app with no explicit search_path set (ADR-INV-002 Addendum A′-4)
do $$
declare v_bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prokind = 'f'
    -- extension-owned functions (pgcrypto/citext/moddatetime) are excluded — they land in
    -- `public` by default in a vanilla (non-Supabase-managed) Postgres install with no
    -- `schema` clause in 0001_extensions.sql, and are not this project's functions to
    -- harden. Found empirically while verifying this exact check locally, not assumed.
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                    where c like 'search\_path=%');
  if v_bad is not null then
    raise exception '(ח) function(s) with no explicit search_path: %', v_bad;
  end if;
end $$;

\echo 'ci-schema-checks.sql: all 8 checks passed'
