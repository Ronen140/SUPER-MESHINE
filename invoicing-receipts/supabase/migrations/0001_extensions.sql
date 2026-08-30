-- 0001_extensions.sql
-- Phase 0 (ADR-INV-001 Implementation Notes #1).
-- pgcrypto: gen_random_uuid() used as the default for every table's `id` primary key.
-- citext: case-insensitive text type used for email columns (businesses.email,
-- customers.email) so "Foo@Bar.com" and "foo@bar.com" compare/uniquely-index equal.

create extension if not exists pgcrypto;
create extension if not exists citext;
