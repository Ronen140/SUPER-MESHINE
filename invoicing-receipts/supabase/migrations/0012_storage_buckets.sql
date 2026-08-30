-- 0012_storage_buckets.sql
-- B10 (ADR-INV-001 Implementation Notes #9). Numbering: shifted from the plan's "0010" to
-- 0012 by the same two migration-numbering shifts documented in 0011_create_business.sql.
--
-- Two private buckets:
--   - `documents`   — rendered PDFs (original + copy, ADR-INV-003). SELECT only, scoped by
--     the business_id encoded as the first path segment
--     (`<business_id>/<document_id>/original.pdf` etc.) — no INSERT/UPDATE/DELETE policy for
--     `authenticated` at all: the PDF pipeline writes via `service_role` (ADR-INV-001 §D5,
--     one of the three closed service_role paths), never as the end user.
--   - `business-assets` — business logos (`businesses.logo_path`). SELECT + INSERT for an
--     `owner` of the business the path's first segment names; no UPDATE/DELETE policy (a
--     logo change is a new object at a new path — deleting/replacing a customer-facing asset
--     isn't a legitimate authenticated-client operation in Phase 0/1).
--
-- Every policy is schema-qualified (`app.current_business_ids()`, `public.member_role`) and
-- reuses the exact same `app.current_business_ids()`/`app.has_role()` helpers every other RLS
-- policy in this project uses — no separate storage-specific authorization logic.

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('business-assets', 'business-assets', false)
on conflict (id) do nothing;

-- ============================================================================
-- documents bucket — SELECT only, no write policy for authenticated at all.
-- ============================================================================

create policy documents_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select app.current_business_ids())
  );

-- ============================================================================
-- business-assets bucket — SELECT for any member, INSERT for an owner only.
-- ============================================================================

create policy business_assets_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1]::uuid in (select app.current_business_ids())
  );

create policy business_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-assets'
    and app.has_role((storage.foldername(name))[1]::uuid, array['owner']::public.member_role[])
  );
