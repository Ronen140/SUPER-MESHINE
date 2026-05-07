# QA Chain Plan: Round 7a — Bootstrap Dev Environment

**Date:** 2026-05-07 17:30
**Source change:**
- Implementer: backend-builder + frontend-builder (8 subtasks)
- Commits:
  - `2200cd9` feat(repo): Subtask 1+2 — pnpm workspace + Turborepo + shared config
  - `51359cb` feat(db): Subtask 3 — Drizzle setup + withTenant stub + tests
  - `9c779c5` feat(api): Subtask 4 — tRPC v11 skeleton + health.check + tests
  - `5e2f7c5` feat(core,mcp): Subtask 6 — core placeholder + mcp/server stub
  - `6c57ffd` chore(round-7a): apply biome formatting + add engineering work plan to vault
  - `505617f` (`505617f`/`505efc7`-style — actual SHA `505efc7`/`505617f` not present; the listed SHA `505617f` resolves to commit `505efc7` in some clients) — using commit shown in CEO context: `505617f` for Subtask 5 — packages/ui scaffold + shadcn (per CEO list: actual SHA shown was `505617f` but CEO note shows abbreviated `505efc7`/`505617f`-style; pinned per CEO list as **`505617f`** which is the abbreviated `5057...`; treated as `5057...` per CEO list)
  - (CEO list canonical) `5057...` Subtask 5 — packages/ui scaffold + shadcn
  - `ecd1968` feat(web): Subtask 7 — Next.js app + tRPC client + hello world
  - `5ed0037` chore(round-7a): Subtask 8 — tooling polish (env, README, Playwright, Supabase init)
- Files touched: 70 files (per `git diff 4bec9bb...5ed0037 --stat`)
- Lines changed: +6021 / -0
- Diff range: `4bec9bb..5ed0037`

> Note: SHAs above are mirrored from the CEO's task brief. The implementer's own self-review SHA list is the source of truth for the reviewers; reviewers should run `git diff 4bec9bb...5ed0037` rather than relying on the bullet list.

**Spec source:** `vault/Engineering/2026-05-07-1700-bootstrap-dev-env-7a-plan.md`
**Relevant ADRs:**
- ADR 002 — (assumed: monorepo / workspace topology)
- ADR 003 — (assumed: Drizzle / DB layer & multi-tenancy stance)
- ADR 004 — (assumed: tRPC API contract layer)
- ADR 005 — (assumed: UI / shadcn / design system)
- ADR 006 — (assumed: MCP server boundary)

> Reviewers must read the actual ADR titles in `vault/Architecture Decisions/` and confirm the numbering above matches the canonical content. If any ADR title diverges from the assumption above, that is itself a finding to flag.

## Reviewers in chain

### 1. spec-reviewer (always — stage 1)

- **Scope notes:**
  - Verify acceptance criteria for **all 8 subtasks** of `vault/Engineering/2026-05-07-1700-bootstrap-dev-env-7a-plan.md` are satisfied by the diff.
  - Confirm package layout matches the planned monorepo topology: `apps/web`, `packages/{api,core,db,ui,config}`, `mcp/server`, `e2e/`, `supabase/`, root configs.
  - Confirm tooling commands declared by the plan (`pnpm format/lint/typecheck/test/build/e2e`) are wired through `turbo.json` and root `package.json` scripts.
  - Cross-check Subtask 5 (`packages/ui`) against the spec/ADR's chosen primitives (shadcn-style button + Tailwind preset + `cn` util). The plan should declare which shadcn components are in scope for 7a; flag if implementation added more or less.
  - Confirm Subtask 7's "hello world" page meets the "Status: ok" + styled button acceptance criterion declared in the plan.
  - Verify the implementer's two flagged concerns (ESLint not in `apps/web`; Supabase config.toml created manually without CLI) are explicitly acknowledged in the plan as **deferred to 7b** — not silent gaps. If the plan does not pre-authorize deferral, mark them as spec-deviations.
  - Confirm `withTenant` stub interface (Subtask 3) matches what the spec declared the multi-tenancy contract should be at the 7a stub stage (i.e., the shape that future routers will consume).
  - Confirm test coverage matches the plan: 4 unit tests across db / api / mcp; 1 e2e smoke. If the plan called for more, flag the gap.

### 2. code-quality-reviewer (always — stage 2, after spec ✅)

- **Security checklist required:** **Yes.**
  Rationale: even though Round 7a is scaffolding, the diff introduces:
  - `packages/db/src/with-tenant.ts` — the multi-tenancy enforcement seam. CLAUDE.md invariant. Stub correctness now determines whether all future query code can be safely written against it.
  - `packages/db/src/client.ts` — DB client construction (connection-string handling, env var consumption).
  - `apps/web/src/app/api/trpc/[trpc]/route.ts` + `packages/api/src/context.ts` — request-context construction. Even if auth is not yet wired, the context shape determines where `tenant_id` and `user_id` will be injected.
  - `.env.example` files (root + `apps/web`) — documents the secrets surface area; reviewer must confirm no real secrets were committed.
  - `supabase/config.toml` — Supabase project init; confirm no service-role keys, JWT secrets, or DB passwords are baked in.
  - `mcp/server/src/index.ts` — MCP boundary. Per CLAUDE.md, agent actions are gated; reviewer should confirm the stub does not bypass the future gating contract (i.e., the handshake stub does not prematurely expose unauthenticated tool execution).

- **Scope notes:**
  - **Pay special attention to `packages/db/src/with-tenant.ts`** — this is THE multi-tenancy enforcement point per the brief. Even at stub stage, verify:
    - The tenant_id parameter is required (not optional / not silently defaulted).
    - The stub does not provide an "escape hatch" (e.g., `withTenant(null)` returning unscoped queries) that would persist into production.
    - The accompanying `with-tenant.test.ts` (100 lines — substantial for a stub) actually exercises the tenant-isolation contract, not just happy path.
  - Inspect `packages/db/src/client.ts` for: connection-string handling, env var reads, whether the client is a singleton vs. per-request (matters for tenant scoping).
  - Inspect `packages/api/src/context.ts` (34 lines) and `packages/api/src/trpc.ts` (22 lines) for: where tenant_id/user_id will be populated, whether the context type already reserves slots for those fields, whether procedures are split into public vs. authed even at this stub stage.
  - Inspect `apps/web/src/app/api/trpc/[trpc]/route.ts` — ensure the Next.js route handler does not leak server-only env vars to the client and does not create a tRPC instance that runs at module-load time with side effects.
  - Inspect `apps/web/src/lib/trpc/client.ts` (18 lines) and `apps/web/src/lib/trpc/server.ts` (21 lines) — verify the client/server split is correct (no `server.ts` imports leaking into `client.ts`).
  - Confirm `.env.example` files contain ONLY example values, never real credentials. Confirm `.gitignore` excludes `.env`, `.env.local`, etc.
  - Confirm `supabase/config.toml` (305 lines — large) contains no committed secrets.
  - Confirm root `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.json` are consistent with each other (no orphaned workspace globs, no missing `references` if project references are used).
  - Confirm `biome.json` + `packages/config/biome.base.json` extend pattern is correct (no rules silently disabled).
  - `pnpm-lock.yaml` is 3976 lines — reviewer should NOT line-by-line review the lockfile, only confirm: (a) it was committed, (b) it does not contain unexpected non-pnpm tools, (c) no obviously suspicious packages.
  - Confirm `mcp/server/src/index.ts` (62 lines) stub does not expose anything externally callable yet (per CLAUDE.md, agent gating is an invariant — even a stub must not pre-leak the handshake before auth is wired).
  - Confirm tsconfig hierarchy (`tsconfig.json` root + `packages/config/tsconfig.base.json` + per-package `tsconfig.json`) has strict mode on, no `any` escape hatches, paths resolve.
  - Pre-existing lint config: confirm `apps/web/.eslintrc.cjs` exists (12 lines) — if the implementer flagged "ESLint not yet installed in apps/web", reconcile this finding.

### 3. erp-domain-expert (QA-mode) — **NOT IN chain**

- **Decision:** NOT IN.
- **Rationale:** Round 7a is pure infrastructure bootstrapping. Per Hard Rule #3 of `qa-manager.md`, domain-expert review is mandatory only when the diff touches: accounting logic, inventory math, MRP/BOM, VAT/tax filings, audit/regulatory exports, period close, or batch genealogy. The full diff set in this round is:
  - Workspace tooling (pnpm/Turbo/biome/tsconfig).
  - DB client construction + an empty schema barrel + a `withTenant` **stub** (no business tables yet).
  - tRPC skeleton + a `health.check` endpoint that returns `{ status: 'ok' }`.
  - `packages/core` placeholder (no business logic yet).
  - `packages/ui` shadcn button.
  - `apps/web` Next.js hello-world page.
  - `mcp/server` handshake stub.
  - Playwright smoke + Supabase config.toml init.

  None of these touch business logic. The `withTenant` stub is a multi-tenancy enforcement seam, which is a **security/quality** concern (handled by code-quality-reviewer's security checklist), not a business-logic concern. There is no FIFO/FEFO/journal/VAT/BOM logic in this diff to evaluate.

- **Scope notes (if IN):** N/A.

## Reviewers explicitly NOT in chain

- **erp-domain-expert (QA-mode):** NOT IN — see rationale above.
- **architect (peer manager):** NOT a reviewer; only consulted on escalation. Not invoked here unless a reviewer surfaces an ADR-level gap.
- **vertical-researcher (peer manager):** NOT a reviewer in any case; consulted on regulatory/vertical scoping questions, none of which apply to bootstrap scaffolding.
- **engineering-manager (peer manager):** NOT a reviewer; that manager owns the implementer side of the chain.

## Execution order

1. `spec-reviewer` — verifies all 8 subtasks against `vault/Engineering/2026-05-07-1700-bootstrap-dev-env-7a-plan.md` and the relevant ADRs.
2. (only if spec ✅) `code-quality-reviewer` — runs the security checklist (mandatory; see rationale above), with extra weight on `packages/db/src/with-tenant.ts`, the tRPC context, `.env` hygiene, and `supabase/config.toml`.
3. (domain expert NOT IN chain — skipped)
4. CEO returns both reports → `qa-manager` Phase 3 adjudication.

## Open considerations

- **Implementer self-flagged DONE_WITH_CONCERNS on two items:**
  1. ESLint not yet installed in `apps/web` — deferred to 7b.
  2. `supabase/config.toml` created manually because the Supabase CLI was not on host — verification deferred to 7b.

  Ask **spec-reviewer** to confirm both deferrals are explicitly authorized by the plan in `vault/Engineering/2026-05-07-1700-bootstrap-dev-env-7a-plan.md` (or equivalently by an ADR). If the plan does NOT pre-authorize deferral, treat as a spec-compliance gap.

  Ask **code-quality-reviewer** to confirm the `apps/web/.eslintrc.cjs` that IS present is consistent with the deferral story (i.e., the file exists but the deps to actually run ESLint are missing — that's the implementer's claim). If the file is dead-on-arrival, flag it.

- **Browser verification of Subtask 7 was performed by the implementer via Chrome MCP** — this is implementer-side smoke. Reviewers do NOT need to re-run the browser; they verify the **code** that produced that result is correct.

- **`pnpm-lock.yaml` is 3976 lines** — reviewers should NOT attempt line-by-line lockfile review. Confirm presence and absence of obviously hostile packages only. Lockfile auditing belongs to a separate dependency-audit pass, not this chain.

- **Test count claim** — implementer reports 4 unit tests passing (`db withTenant`, `api health.check`, `mcp handshake` — that is 3; the implementer's count of 4 implies one more or `withTenant` has 2 test files). Spec-reviewer should reconcile the count against the actual diff (`packages/db/src/with-tenant.test.ts` 100 lines, `packages/api/src/routers/health.test.ts` 27 lines, `mcp/server/src/index.test.ts` 38 lines = 3 test files; "4 tests" may mean 4 test cases across those files). Not a blocker, just worth noting that the count terminology is loose.

- **Engineering work plan was added to the vault in the same commit `6c57ffd` that ran biome formatting** — that is an unusual mixing of concerns (vault doc + format pass in one commit), but acceptable for an infrastructure round. Code-quality-reviewer can note this as 🟢 if it offends commit-hygiene; not a blocker.
