# service-role

Server-only code that talks to Supabase with the `service_role` key (bypasses RLS).

Per ADR-INV-001 §D5, there are exactly three legitimate `service_role` call sites in this
project: the PDF signing pipeline, the public document-viewer route, and the nightly
backup/export job. Everything else must go through RLS (`authenticated` client) or through
a `SECURITY DEFINER` Postgres function (e.g. `app.issue_document()`).

**Rule (enforced by `biome.json` → `linter.rules.style.noRestrictedImports`):** nothing
outside this directory may import from `src/server/service-role/`. Modules inside this
directory must import each other using relative paths (`./foo`, not `@/server/service-role/foo`)
so the lint rule does not need a self-exemption.

`SUPABASE_SERVICE_ROLE_KEY` must never be read outside this directory, and must never be
prefixed `NEXT_PUBLIC_`.

Implementation of the three call sites lands in later Phase 0 subtasks (B9, B13) and Phase 1
(ADR-INV-003 signing pipeline). This directory exists from B1 so the import-boundary rule has
something real to guard from the start.
