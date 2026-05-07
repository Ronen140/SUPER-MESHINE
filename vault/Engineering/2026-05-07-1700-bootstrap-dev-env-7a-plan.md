# Engineering Work Plan: Bootstrap Dev Environment (Round 7a)

**Date:** 2026-05-07 17:00
**Source task (CEO brief, verbatim):**
> Round 7a — bootstrap the dev environment locally. **Out of scope for this round:** external services (Vercel, Supabase Cloud, Sentry, PostHog, Axiom) — those require user-owned accounts and will be Round 7b.
>
> **In scope (Round 7a):**
> - pnpm workspace + Turborepo init at the project root.
> - Initial package skeletons per ADR-004:
>   - `apps/web/` — Next.js 15 (App Router), React 19, minimal "hello world" page.
>   - `packages/db/` — Drizzle setup, postgres-js driver, empty schema folder, migration tooling, `withTenant()` helper stub per ADR-002.
>   - `packages/api/` — tRPC v11 router with a single `health.check` procedure.
>   - `packages/ui/` — shadcn/ui init, Tailwind 4 config, design tokens placeholder.
>   - `packages/core/` — empty placeholder (to keep ADR-004 layout honest).
>   - `packages/config/` — shared tsconfig + biome config.
>   - `mcp/server/` — minimal MCP server stub (no tools yet, just the boilerplate).
> - Tooling: Biome (format + lint), Vitest (unit), Playwright (e2e config only — no real tests yet).
> - Local Postgres: use Supabase CLI's local stack (`supabase start`) — runs Postgres + Auth + Storage + Realtime in Docker. This is the lightest path that matches our cloud env.
> - A working `pnpm dev` that boots Next.js on `localhost:3000` with the tRPC `health.check` returning OK.
> - A working `pnpm test` (even if it runs zero tests — just confirms the runner works).
> - A working `pnpm build` (Turborepo build of all packages).
> - A working `pnpm typecheck`, `pnpm lint`, `pnpm format`.
> - `.env.example` at the project root and per-app, with all env-var names from ADR-003 (DATABASE_URL, SUPABASE_URL, etc.) but no values.
> - README sections at root explaining `pnpm install` → `supabase start` → `pnpm db:migrate` → `pnpm dev`.
>
> **Out of scope for 7a (deferred to 7b):**
> - Real DB schema (no `tenants`, `users`, etc. tables yet — those need vertical context per ADR-001 still pending).
> - Auth integration (Supabase Auth requires the cloud project).
> - Sentry/PostHog/Axiom client init (env keys not available).
> - GitHub Actions CI (can be added in 7b alongside cloud deploys).
> - Docker for the runtime app (Next.js itself; Supabase Docker is fine for local DB).

**Relevant ADRs:**
- [[002-multi-tenancy-strategy]] — RLS + `withTenant()` helper requirement (`SET LOCAL app.current_tenant`).
- [[003-stack-architecture]] — Node 22 LTS, pnpm 9, Turborepo 2, Next.js 15, React 19, tRPC v11, Drizzle + postgres-js, Tailwind 4 + shadcn, Biome+ESLint hybrid, Vitest + Playwright + Testcontainers, env-var convention.
- [[004-monorepo-structure]] — package layout (`apps/web`, `packages/{db,api,ui,core,config}`, `mcp/server`), `@super-meshine/*` scope, `workspace:*` deps, root `package.json` scripts, `turbo.json` pipelines.
- [[005-auth-and-rbac]] — read for env-var names only; auth not wired in 7a.
- [[006-audit-log-and-agent-action-gating]] — read for context; not implemented in 7a.

**Codebase state check:**
- Project root contains only `CLAUDE.md`, `README.md`, `vault/` — no `package.json`, no `pnpm-workspace.yaml`, no `apps/`, no `packages/`, no `mcp/`. Greenfield.
- `node`, `pnpm`, `supabase` CLI are **not installed** on the host shell. `docker` is installed (v29.2.1).
- No prior git history of code work to conflict with.
- `vault/Engineering/` directory does not exist yet — will be created by writing this plan file.

## Decomposition

Order rationale: backend-builder owns all scaffolding (Subtasks 1–8) because the entire round is server/tooling/config work; there is **no UI work** beyond the Next.js "hello world" page that comes free with `create-next-app`. frontend-builder is engaged only when we need Tailwind 4 + shadcn config in `packages/ui` and the `apps/web` "hello world" wired to tRPC, where browser verification is required. Subtasks 1–4 are sequential because each builds on the previous; 5–7 are largely parallel after Subtask 4 lands.

### Subtask 1 — Repo skeleton, pnpm workspace, Turborepo, root scripts, Biome config

- **Assignee:** `backend-builder`
- **Spec:** Initialize the monorepo: root `package.json` (private, scripts per ADR-004 §Root package.json), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `mcp/*`), `turbo.json` (tasks: dev, build, test, lint, typecheck, format, clean, db:generate, db:migrate per ADR-004 §turbo.json), `.nvmrc` (`22`), root `tsconfig.json` extending `@super-meshine/config`, root `biome.json` extending `@super-meshine/config/biome.base.json`, `.gitignore` (Node + Next.js + Turbo + drizzle output + `.env*` except `.env.example`), `.editorconfig`. Pin `packageManager: "pnpm@9.12.0"` and `engines.node: ">=22 <23"` (see Open Questions on Node version).
- **Files (predicted):**
  - `package.json` (new)
  - `pnpm-workspace.yaml` (new)
  - `turbo.json` (new)
  - `tsconfig.json` (new)
  - `biome.json` (new)
  - `.nvmrc` (new)
  - `.gitignore` (new)
  - `.editorconfig` (new)
- **Acceptance criteria:**
  - `pnpm install` at repo root completes with exit code 0 and no peer-dep errors.
  - `pnpm format` (Biome) runs and exits 0 on the empty repo.
  - `pnpm lint` runs and exits 0 (zero files to lint yet is acceptable; non-zero only on actual errors).
  - `pnpm build`, `pnpm test`, `pnpm typecheck` all run via Turborepo and exit 0 (zero tasks discovered is acceptable at this stage; non-zero only if Turbo itself errors).
  - `turbo run --help` works (Turbo installed correctly).
  - `node --version` reports v22.x when invoked in repo (via `.nvmrc`).
- **Dependencies:** none — must run first.
- **Invariants applied:** N/A (no app code yet).

### Subtask 2 — `packages/config` shared tsconfig + biome base

- **Assignee:** `backend-builder`
- **Spec:** Create `@super-meshine/config` package exposing `tsconfig.base.json` (strict: true, target ES2022, module Node16/Bundler, paths config compatible with both Next.js and Node), `biome.base.json` (2 spaces, single quotes, trailing comma all, recommended lints), and `eslint.base.cjs` (extends `next/core-web-vitals` + `plugin:react-hooks/recommended` — applied only inside `apps/web`). All other packages will extend these.
- **Files (predicted):**
  - `packages/config/package.json` (new — `@super-meshine/config`, private, exports map for json files)
  - `packages/config/tsconfig.base.json` (new)
  - `packages/config/biome.base.json` (new)
  - `packages/config/eslint.base.cjs` (new)
  - `packages/config/README.md` (new — one-paragraph usage)
- **Acceptance criteria:**
  - `pnpm --filter @super-meshine/config install` succeeds.
  - From any other package, `extends: "@super-meshine/config/tsconfig.base.json"` resolves (verified by `pnpm typecheck` working in Subtask 3+).
  - Biome config has explicit `formatter.indentWidth: 2`, `formatter.indentStyle: "space"`, `javascript.formatter.quoteStyle: "single"`, `javascript.formatter.trailingCommas: "all"`.
- **Dependencies:** Subtask 1.
- **Invariants applied:** N/A.

### Subtask 3 — `packages/db` skeleton + Drizzle + `withTenant()` stub + migration tooling

- **Assignee:** `backend-builder`
- **Spec:** Create `@super-meshine/db` per ADR-003 §Implementation Notes step 3 and ADR-002. Install `drizzle-orm`, `postgres`, `drizzle-zod`; dev `drizzle-kit`, `@super-meshine/config`, `tsx`, `vitest`. Provide `drizzle.config.ts` (postgresql, schema `./src/schema/*.ts`, out `./drizzle`, two URLs: `DATABASE_URL` for runtime, `DIRECT_URL` for migrations). Empty `src/schema/` (placeholder `index.ts` re-exporting nothing — no real tables in 7a per CEO brief). Implement `createDb(connectionString)` factory and `withTenant(db, tenantId, fn)` helper stub that opens a transaction and runs ``await tx.execute(sql\`SET LOCAL app.current_tenant = ${tenantId}\`)`` then calls `fn(tx)`. Add scripts `db:generate` (drizzle-kit generate) and `db:migrate` (drizzle-kit migrate). One Vitest unit test asserting the helper passes the tenant id through.
- **Files (predicted):**
  - `packages/db/package.json` (new — `@super-meshine/db`)
  - `packages/db/tsconfig.json` (new — extends config)
  - `packages/db/drizzle.config.ts` (new)
  - `packages/db/src/index.ts` (new — exports `createDb`, `withTenant`, schema namespace)
  - `packages/db/src/client.ts` (new — `createDb` factory)
  - `packages/db/src/with-tenant.ts` (new — helper)
  - `packages/db/src/schema/index.ts` (new — empty re-export barrel)
  - `packages/db/src/with-tenant.test.ts` (new — Vitest unit test using a mocked tx that records the SQL string)
  - `packages/db/drizzle/.gitkeep` (new — empty migrations folder)
- **Acceptance criteria:**
  - `pnpm --filter @super-meshine/db typecheck` exits 0.
  - `pnpm --filter @super-meshine/db test` exits 0 with at least 1 passing test for `withTenant`.
  - The Vitest test asserts the executed SQL matches `/SET LOCAL app\.current_tenant\s*=/i` and that `tenantId` is passed as a parameter (not interpolated raw).
  - `pnpm --filter @super-meshine/db drizzle-kit generate` runs without errors against the empty schema (produces no migration; exit 0).
  - `withTenant` signature: `<T>(db: PostgresJsDatabase, tenantId: string, fn: (tx: Transaction) => Promise<T>) => Promise<T>`.
- **Dependencies:** Subtask 2.
- **Invariants applied:** multi-tenancy ✅ (`withTenant` stub is the enforcement point).

### Subtask 4 — `packages/api` skeleton + tRPC v11 + `health.check` procedure

- **Assignee:** `backend-builder`
- **Spec:** Create `@super-meshine/api` per ADR-003 §Implementation Notes step 4. Install `@trpc/server@^11`, `superjson`, `zod`. Workspace deps: `@super-meshine/db`, `@super-meshine/config`. Define `createTRPCContext(opts)` returning `{ userId: null, tenantId: null, db: null }` for now (real auth wiring is 7b). Define `appRouter` with one router `health` containing one public procedure `check` that returns `{ status: 'ok', timestamp: new Date().toISOString() }`. Export `AppRouter` type. One Vitest test that constructs the router caller directly and asserts `health.check()` returns `status: 'ok'`.
- **Files (predicted):**
  - `packages/api/package.json` (new — `@super-meshine/api`)
  - `packages/api/tsconfig.json` (new)
  - `packages/api/src/index.ts` (new — re-exports `appRouter`, `AppRouter`, `createTRPCContext`)
  - `packages/api/src/trpc.ts` (new — initTRPC, transformer superjson, publicProcedure)
  - `packages/api/src/context.ts` (new — `createTRPCContext`)
  - `packages/api/src/routers/_app.ts` (new — root router merge)
  - `packages/api/src/routers/health.ts` (new — `health.check`)
  - `packages/api/src/routers/health.test.ts` (new — Vitest)
- **Acceptance criteria:**
  - `pnpm --filter @super-meshine/api typecheck` exits 0.
  - `pnpm --filter @super-meshine/api test` exits 0 with the health.check test passing.
  - `health.check()` invoked via tRPC server-side caller returns object with `status === 'ok'` and a valid ISO 8601 `timestamp` (regex `/^\d{4}-\d{2}-\d{2}T/`).
  - `AppRouter` type is exported (verified: `import type { AppRouter } from '@super-meshine/api'` resolves in Subtask 5).
- **Dependencies:** Subtask 3 (workspace dep on `@super-meshine/db` for context shape consistency, even though db is null in 7a).
- **Invariants applied:** N/A in 7a (no procedures touch DB yet); the `withTenant` plumbing is reserved for 7b.

### Subtask 5 — `packages/ui` skeleton + Tailwind 4 preset + shadcn init + design tokens placeholder

- **Assignee:** `frontend-builder`
- **Spec:** Create `@super-meshine/ui`. Install `tailwindcss@4`, `@tailwindcss/postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`. Set up shadcn/ui via `pnpm dlx shadcn@latest init` configured to write into this package (`components.json` with `aliases.components: "@super-meshine/ui/components"`). Provide `tailwind.preset.ts` (Tailwind 4 CSS-first config exporting design tokens — placeholder palette + spacing scale + radius). Add one minimal component (`Button` from shadcn) so we can verify the pipeline end-to-end. Export everything via `src/index.ts`. No tests in 7a (UI component tests deferred).
- **Files (predicted):**
  - `packages/ui/package.json` (new — `@super-meshine/ui`)
  - `packages/ui/tsconfig.json` (new)
  - `packages/ui/components.json` (new — shadcn config)
  - `packages/ui/src/index.ts` (new)
  - `packages/ui/src/components/button.tsx` (new — shadcn-generated)
  - `packages/ui/src/lib/utils.ts` (new — `cn()` helper)
  - `packages/ui/src/styles/globals.css` (new — Tailwind 4 directives + CSS custom properties for design tokens)
  - `packages/ui/tailwind.preset.ts` (new — token export)
- **Acceptance criteria:**
  - `pnpm --filter @super-meshine/ui typecheck` exits 0.
  - `pnpm --filter @super-meshine/ui lint` (Biome) exits 0.
  - `Button` component imports cleanly from `@super-meshine/ui` in `apps/web` (verified in Subtask 7).
  - `globals.css` contains `@import "tailwindcss";` (Tailwind 4 syntax) and at least 4 design-token CSS variables (e.g., `--color-primary`, `--color-bg`, `--radius`, `--font-sans`).
- **Dependencies:** Subtask 2. Can run in parallel with Subtasks 3 and 4.
- **Invariants applied:** N/A.

### Subtask 6 — `packages/core` empty placeholder + `mcp/server` minimal stub

- **Assignee:** `backend-builder`
- **Spec:** Two trivial packages bundled into one subtask because both are stubs. (a) `@super-meshine/core` — empty package with `package.json`, `tsconfig.json`, `src/index.ts` (exports `{}`), so the ADR-004 layout is honest. No deps beyond `@super-meshine/config`. (b) `mcp/server` — minimal MCP server boilerplate using `@modelcontextprotocol/sdk` (StdioServerTransport), no tools registered yet. Server starts, advertises capabilities `{}`, exits cleanly on SIGINT. One smoke test: spawn the server, send an `initialize` request over stdio, assert it responds with valid MCP handshake.
- **Files (predicted):**
  - `packages/core/package.json` (new — `@super-meshine/core`)
  - `packages/core/tsconfig.json` (new)
  - `packages/core/src/index.ts` (new — `export {}`)
  - `mcp/server/package.json` (new — `@super-meshine/mcp-server`)
  - `mcp/server/tsconfig.json` (new)
  - `mcp/server/src/index.ts` (new — Server + StdioServerTransport, no tools)
  - `mcp/server/src/index.test.ts` (new — smoke test for handshake)
- **Acceptance criteria:**
  - `pnpm --filter @super-meshine/core typecheck` exits 0.
  - `pnpm --filter @super-meshine/mcp-server typecheck` exits 0.
  - `pnpm --filter @super-meshine/mcp-server test` exits 0 with the handshake test passing.
  - Running `pnpm --filter @super-meshine/mcp-server dev` (or `tsx src/index.ts`) starts the server on stdio and exits cleanly when stdin closes (verified manually or via the test).
- **Dependencies:** Subtask 2. Can run in parallel with Subtasks 3, 4, 5.
- **Invariants applied:** N/A in 7a (no tools = no agent-gating to enforce yet).

### Subtask 7 — `apps/web` Next.js 15 + tRPC client wiring + hello-world page hitting `health.check`

- **Assignee:** `frontend-builder`
- **Spec:** Scaffold `apps/web` per ADR-003 §Implementation Notes step 2 and step 6. Use `pnpm dlx create-next-app@latest apps/web --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint`. Then: install `@trpc/server@^11`, `@trpc/client@^11`, `@trpc/react-query@^11`, `@tanstack/react-query@^5`, `superjson`, `zod`, workspace deps `@super-meshine/api`, `@super-meshine/db`, `@super-meshine/ui`, `@super-meshine/config`. Adopt `eslint.base.cjs` from config. Adopt the Tailwind preset from `@super-meshine/ui` and import `globals.css` from the ui package. Create `app/api/trpc/[trpc]/route.ts` (fetch adapter, imports `appRouter` from `@super-meshine/api`). Create `lib/trpc.ts` (client + provider). Replace the default homepage with a Server Component that calls the tRPC server-side caller for `health.check` and renders `Status: ok | <timestamp>` plus the shadcn `Button` from `@super-meshine/ui` to prove the UI pipeline. No auth, no DB connection (7b).
- **Files (predicted):**
  - `apps/web/package.json` (new)
  - `apps/web/next.config.ts` (new — `transpilePackages: ['@super-meshine/ui', '@super-meshine/api', '@super-meshine/db']`)
  - `apps/web/tsconfig.json` (new — extends config)
  - `apps/web/.eslintrc.cjs` (new — extends `@super-meshine/config/eslint.base.cjs`)
  - `apps/web/postcss.config.mjs` (new — `@tailwindcss/postcss`)
  - `apps/web/src/app/layout.tsx` (new)
  - `apps/web/src/app/page.tsx` (new — calls `health.check`, renders status + Button)
  - `apps/web/src/app/api/trpc/[trpc]/route.ts` (new — fetch adapter)
  - `apps/web/src/app/globals.css` (new — re-export ui package globals)
  - `apps/web/src/lib/trpc/server.ts` (new — server-side caller)
  - `apps/web/src/lib/trpc/client.ts` (new — client provider — minimal, may be used for client components in 7b)
- **Acceptance criteria:**
  - `pnpm --filter web dev` boots Next.js on `http://localhost:3000` within 30s.
  - GET `http://localhost:3000` returns 200 and the rendered HTML body contains the literal string `Status: ok` and a non-empty timestamp matching `/\d{4}-\d{2}-\d{2}T/`.
  - GET `http://localhost:3000/api/trpc/health.check?batch=1&input=%7B%220%22%3A%7B%7D%7D` returns HTTP 200 with a JSON body where `result.data.status === 'ok'`.
  - `pnpm --filter web build` exits 0 and produces `.next/` output.
  - `pnpm --filter web typecheck` exits 0.
  - `pnpm --filter web lint` exits 0.
  - **Browser verification (mandatory):** frontend-builder navigates to `localhost:3000` in a browser, screenshots the rendered page showing the `Status: ok` text and the styled Button, attaches the screenshot to the return report. (Per `verification-before-completion`.)
- **Dependencies:** Subtasks 4 (api), 5 (ui), 2 (config). Must run after those three are merged.
- **Invariants applied:** N/A in 7a; tRPC procedure is unauthenticated stub.

### Subtask 8 — Tooling polish: Vitest root config, Playwright config (no real tests), `.env.example` files, README bootstrap section

- **Assignee:** `backend-builder`
- **Spec:** (a) Root `vitest.config.ts` (or per-package — pick per-package since each package already has its own; just confirm `pnpm test` via Turbo runs all of them and passes). (b) Root `playwright.config.ts` (testDir `e2e/`, baseURL `http://localhost:3000`, projects: chromium only for 7a). Empty `e2e/.gitkeep`. Add `pnpm e2e` script that runs `playwright test` (will report 0 tests; exit 0). (c) `.env.example` at root listing every env var name from ADR-003 step 9: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `AXIOM_TOKEN` — all with empty values and one-line comments. `.env.example` per app at `apps/web/.env.example` with the subset relevant to web. (d) Update root `README.md` adding a "Local development" section: prerequisites (Node 22 via nvm, pnpm 9, Docker Desktop, Supabase CLI), then `pnpm install` → `supabase init` (only first time) → `supabase start` → copy `.env.example` to `.env.local` and fill local values from `supabase status` output → `pnpm db:migrate` → `pnpm dev` → open `localhost:3000`. Include troubleshooting note: if Docker isn't running, `supabase start` will fail.
- **Files (predicted):**
  - `playwright.config.ts` (new)
  - `e2e/.gitkeep` (new)
  - `.env.example` (new)
  - `apps/web/.env.example` (new)
  - `README.md` (modified — add "Local development" section; do NOT delete existing content)
  - `supabase/config.toml` (new — generated by `supabase init`; commit)
- **Acceptance criteria:**
  - `pnpm test` from root exits 0 (running tests across all packages — health.check test + withTenant test + mcp handshake test must all pass; total ≥ 3 passing tests, 0 failing).
  - `pnpm e2e` exits 0 (zero Playwright tests, no errors).
  - `pnpm playwright install chromium` is documented in README but not run automatically.
  - `.env.example` at root contains all 9 env-var names listed in ADR-003 §Implementation Notes step 9. Verified by grep: every name appears at least once.
  - README "Local development" section contains, in order, the literal command strings: `pnpm install`, `supabase start`, `pnpm db:migrate`, `pnpm dev`.
  - `supabase init` produces `supabase/config.toml`; running `supabase start` (Docker required) brings up the local stack and `supabase status` prints `DB URL`, `Anon key`, `Service role key` — these match the placeholders in `.env.example`. (Manual verification step; document in the return report.)
- **Dependencies:** Subtasks 1, 7. Must run last because it ties everything together and requires `pnpm test` to find the tests written in Subtasks 3, 4, 6.
- **Invariants applied:** N/A.

## Open questions / risks

1. **Node 24 vs Node 22 (most important).** ADR-003 pins **Node 22 LTS**. The dev host currently has no Node installed at all (verified: `node --version` not found). If the user is planning to install Node 24 (current at time of this plan), we either (a) update ADR-003 to allow `>=22` (Node 24 is also LTS-track but exits LTS earlier than 22), or (b) install exactly Node 22 LTS via nvm. **Recommendation: stay on Node 22 LTS as ADR-003 specifies.** Reason: 22 has LTS support through April 2027, Vercel's default Node runtime in 2026 is 22, and ADR-003 explicitly considered this. Pin `.nvmrc` to `22` and `engines.node` to `>=22 <23`. Escalate to CEO only if user has a strong preference for 24; if so, request architect to amend ADR-003 first. **No code change needed in this plan if recommendation is accepted.**
2. **Supabase CLI requires Docker.** ADR-003 §Implementation Notes step 9 implicitly assumes a Postgres is reachable; the CEO brief explicitly chooses Supabase CLI's local stack which requires Docker Desktop running. Docker is installed (v29.2.1) but **must be running** for `supabase start`. This is an acceptable dependency for 7a since the alternative (raw Postgres in Docker, or Postgres.app) is more divergent from the cloud env. **Recommendation: accept as-is; document in README troubleshooting.**
3. **Supabase CLI itself is not installed.** The README bootstrap section needs to instruct the user to install the CLI (`npm i -g supabase` is no longer the recommended path; current 2026 path is `scoop install supabase` on Windows, or the standalone binary). README must reflect platform-specific install. **Risk: low; documentation-only.**
4. **No Node/pnpm on host.** A truly clean bootstrap needs the user (or builder) to install Node 22 + pnpm 9 first. Builders will need this resolved before they can run `pnpm install`. **Recommendation: README's "Prerequisites" section addresses this; engineering-manager assumes builders run on a host where Node 22 + pnpm 9 are available.** If a builder reports `pnpm: command not found` as `BLOCKED`, escalate to CEO/user — that's an env issue, not a planning issue.
5. **Tailwind 4 + Next.js 15 compatibility.** Tailwind 4 final shipped in 2025; Next.js 15 supports it but requires `@tailwindcss/postcss`, not the legacy `tailwindcss` PostCSS plugin. ADR-003 specifies Tailwind 4 explicitly. **Risk: low; well-documented.** Builder must verify integration in browser (Subtask 7 acceptance).
6. **shadcn/ui in a workspace package.** shadcn historically copies components into `apps/web`, not into a shared package. As of 2026 the official `components.json` supports `aliases` that make a workspace package the install target. **Risk: low–medium; if the official installer doesn't cooperate, frontend-builder may need to copy the generated component manually into `packages/ui/src/components/` and adjust imports.** This is a known frontend-builder concern; if it blocks them they should report `NEEDS_CONTEXT` so engineering-manager can confirm the manual-copy fallback is acceptable for 7a.
7. **`apps/web` cannot import from `mcp/*` (ADR-004 rule).** Subtask 6 (mcp/server) has zero coupling to apps/web in 7a, so this rule is trivially satisfied; documenting here so future rounds remember.
8. **No real schema → no real migration → `pnpm db:migrate` is a no-op.** README documents the command anyway so the bootstrap path matches what users will run in 7b. This is intentional. The acceptance for Subtask 8 verifies the command runs without error, not that it applies a migration.

## Escalations needed

- [ ] **To CEO/user:** Confirm Node 22 LTS as the version to install (per ADR-003) — recommendation is to keep ADR-003 as-is. If CEO wants Node 24, this becomes an ADR-003 amendment escalation to architect first.
- [ ] **To CEO/user:** Confirm Supabase CLI local stack (Docker-based) is acceptable as the local Postgres choice — recommendation: accept (it's what the CEO brief requested).
- [ ] **To architect:** None for 7a. All decisions are inside ADR-003 and ADR-004 implementation notes. No new dependencies beyond what ADR-003 lists. No schema. No auth. If a builder discovers a needed dep that's not in ADR-003 (e.g., a specific MCP SDK version), that's a NEEDS_CONTEXT to engineering-manager, who will escalate to architect if it's a real new dep.

## Estimated rounds

- **Workers:** 2 sequential CEO dispatch rounds expected.
  - **Round A (parallel):** Subtask 1 → then in parallel Subtask 2; then in parallel Subtasks 3, 4, 5, 6 (after 2 lands; 5 is frontend-builder, 3/4/6 are backend-builder).
  - **Round B (sequential):** Subtask 7 (frontend-builder, depends on 4+5+2) and Subtask 8 (backend-builder, depends on 1+7) — these two run after Round A; 8 depends on 7 so 7 must finish first, but in practice they can be dispatched in the same CEO round with a sequential note.
- **Review chain (qa-manager):** 1 round expected — spec-reviewer + code-quality-reviewer; erp-domain-expert N/A (no business logic in 7a). Possible 1 fix-and-re-review loop if reviewers find issues.
- **Total CEO dispatches estimated:** **3 sequential** (Round A workers, Round B workers, review chain) plus engineering-manager Phase 5 acceptance = **4 dispatches end to end** (excluding fix loops).
- **Wall-clock feel:** half a working day if everything goes clean; up to a full day with one fix loop on Subtask 7 (browser verification often surfaces the most issues).
