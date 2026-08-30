-- 0001_extensions.sql
-- Phase 0 (ADR-INV-001 Implementation Notes #1).
-- pgcrypto: gen_random_uuid() used as the default for every table's `id` primary key.
-- citext: case-insensitive text type used for email columns (businesses.email,
-- customers.email) so "Foo@Bar.com" and "foo@bar.com" compare/uniquely-index equal.
-- moddatetime: auto-updates an `updated_at` column on UPDATE via a generic trigger
-- function (ADR-INV-001 Implementation Notes #4 — used on businesses/customers/items
-- in 0003a_core_tables.sql).

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists moddatetime;
