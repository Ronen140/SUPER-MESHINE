-- tests/db/storage-stub.sql
-- LOCAL/CI TEST FIXTURE ONLY — never applied to a real Supabase project. Supabase's platform
-- creates and manages the real `storage` schema (via the Storage API service, not user
-- migrations); `0012_storage_buckets.sql` only ever INSERTs into `storage.buckets` and adds
-- RLS policies to `storage.objects`, exactly as it would against a real project. This stub
-- reproduces just enough of the real `storage.buckets`/`storage.objects` shape (columns used
-- by 0012's own policies, plus `storage.foldername()`, copied from Supabase's own storage-api
-- migrations) to exercise that migration's policy logic end-to-end against a throwaway
-- Postgres — not a general-purpose Storage API reimplementation.

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata   jsonb
);

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end;
$$;

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
