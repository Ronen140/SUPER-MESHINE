# ADR 003: Stack Architecture & Package Layout

**Date:** 2026-05-07
**Status:** Accepted
**Decider:** Architect (proposed), CEO (final approval — pre-decided at high level in D1)

## Context

D1 (founding) קבע TypeScript + tRPC + Drizzle כ-stack מחייב; D2 קבע Vercel + Supabase כ-cloud target; ADR-002 קבע multi-tenancy דרך Postgres RLS עם `app.current_tenant` GUC ש-`SET LOCAL` בתחילת כל transaction. ה-stack הספציפי עוד לא ננעל מעבר לשלושת הפרימיטיבים האלה — חסר קונקרטית: גרסת Node, package manager, framework, ORM driver, auth, UI, testing, CI, ו-monorepo layout. ADR זה סוגר את כל אלה כדי ש-builders יוכלו להריץ scaffold בלי לחזור לארכיטקט. ה-status הוא **Accepted** כי הכיוון הכולל אושר ע"י CEO; ADR זה מפרש לפרטים, לא משנה כיוון.

## Options Considered

מאחר שה-D1 כבר נעל TypeScript+tRPC+Drizzle, ה-trade-offs כאן הם פר-החלטה משנית. שלוש קבוצות שדרשו דיון אמיתי:

### Option A: tRPC inside Next.js (Route Handlers)

ה-tRPC server רץ כ-`/api/trpc/[trpc]/route.ts` בתוך אותו Next.js app שמשרת את ה-frontend. deploy יחיד ל-Vercel. tenant context נקבע ב-procedure middleware על בסיס Supabase JWT ומועבר ל-Drizzle דרך connection wrapper שעושה `SET LOCAL app.current_tenant`.

- **Pros:** deploy יחיד, latency נמוך (אותו region), shared types בלי build step, Vercel preview deployments מתפקדים end-to-end, מתאים לפנימי ול-MVP.
- **Cons:** Vercel function cold-start חולק עם ה-frontend; queries ארוכות מוגבלות ל-Vercel function timeout (60s on Pro, 800s on Enterprise); pooling דרך Supabase Pooler חובה.
- **Risk:** אם בעתיד נצטרך long-running jobs (Customization Agent migrations), נצטרך להוציא worker חיצוני (Inngest/Trigger.dev) — אבל ה-tRPC layer נשאר.

### Option B: Hono/Fastify service נפרד

תהליך Node נפרד שמריץ tRPC, פרוס על Fly.io/Railway/Render. ה-Next.js רק client.

- **Pros:** isolation מ-Vercel limits, גמישות runtime (long jobs, websockets, custom middleware).
- **Cons:** סותר את D2 (Vercel-only); ניהול שני deploys; CORS; latency נוסף; שני billing accounts.
- **Risk:** הפרה של החלטה קודמת (D2) ללא הצדקה ל-MVP.

### Option C: Auth — Supabase Auth vs. Better Auth vs. Clerk vs. Lucia

- **Supabase Auth** — חינם עד 50K MAU, native ל-RLS (ה-`auth.uid()` JWT claim זמין ב-policies), email/OAuth/magic-link, SSO ב-Pro.
- **Better Auth** — TypeScript-native, self-hosted, plugin system, אבל schema משלו ב-DB שלנו = עוד טבלאות לתחזק.
- **Clerk** — UX הכי מלוטש, אבל $25/mo + $0.02/MAU, ו-JWT שלו לא משתלב ישירות עם Supabase RLS בלי custom JWT template.
- **Lucia** — roll-your-own; הספרייה עצמה מאז 2024 ב-maintenance mode.

## Trade-offs

### Backend pattern

| Criterion | A: tRPC in Next.js | B: Separate Hono service |
|---|---|---|
| Alignment with D2 (Vercel-only) | ✅ | ❌ |
| Deploy simplicity | ✅ | ⚠️ |
| Long-running job support | ⚠️ (offload needed) | ✅ |
| Type sharing | ✅ | ✅ |
| MVP cost | ✅ | ⚠️ |

### Auth

| Criterion | Supabase Auth | Better Auth | Clerk | Lucia |
|---|---|---|---|---|
| Native RLS integration | ✅ | ⚠️ (custom JWT) | ⚠️ (custom JWT) | ⚠️ |
| Cost at MVP | ✅ free | ✅ free | ❌ paid | ✅ free |
| Maintenance burden | ✅ managed | ⚠️ self | ✅ managed | ❌ unmaintained |
| Multi-tenant (org/team) primitives | ⚠️ (build it) | ✅ built-in | ✅ built-in | ❌ |
| Lock-in risk | ⚠️ (already locked by D2) | ✅ | ❌ | ✅ |

### Linter

| Criterion | Biome | ESLint+Prettier |
|---|---|---|
| Speed | ✅ (Rust) | ⚠️ |
| Ecosystem (plugins) | ⚠️ (growing) | ✅ |
| Config simplicity | ✅ (one tool) | ❌ |
| Next.js/React rules coverage | ⚠️ (partial) | ✅ |

## Decision

**Stack נעול כדלקמן:**

- **Runtime & tooling**
  - Node.js **22 LTS** (active LTS until Apr 2027).
  - Package manager: **pnpm 9.x** (workspaces).
  - Monorepo orchestration: **Turborepo 2.x**.
- **Frontend**
  - **Next.js 15** (App Router, React Server Components).
  - **React 19**.
  - **Tailwind CSS 4** + **shadcn/ui** (copy-in components, Radix primitives).
  - **TanStack Table v8** for data grids.
  - **react-hook-form** + **zod** + `@hookform/resolvers/zod` for forms.
  - **Vercel AI SDK** (`ai` package) for streaming Copilot UI.
- **Backend**
  - **tRPC v11** mounted as Next.js Route Handler at `/api/trpc/[trpc]` (Option A above). No separate service for MVP.
  - **superjson** transformer (Date/Map/BigInt support).
  - All inputs validated with **zod**; all DB-derived schemas via **drizzle-zod**.
- **Database layer**
  - **Drizzle ORM** (latest stable), **code-first** (TypeScript schema in `packages/db/src/schema/*.ts`, generates SQL migrations via `drizzle-kit`).
  - **Driver: `postgres-js`** (Drizzle's recommended driver; supports `SET LOCAL` in transactions cleanly, lower overhead than `pg`).
  - All RLS-aware queries go through a `withTenant(db, tenantId, fn)` helper that opens a transaction and runs `SET LOCAL app.current_tenant = $1` before `fn(tx)`. See ADR-002.
  - Migrations: `drizzle-kit generate` → SQL files committed → applied via Supabase migration runner / `drizzle-kit migrate` in CI.
- **Authentication**
  - **Supabase Auth** (email/password + magic link + Google OAuth for MVP; SSO later on Pro tier).
  - JWT carries `sub` (user id) and a custom claim `tenant_id` populated via Supabase Auth Hook (Postgres function). The tRPC middleware reads this claim and calls `withTenant`.
  - Org/team primitives (`memberships` table) are app-owned, not Supabase-managed.
- **Validation / shared types**
  - **zod** is the single source of runtime schemas. tRPC inputs, drizzle-zod insert/select schemas, and react-hook-form resolvers all share zod definitions. No `class-validator`, no Joi, no Yup.
- **Testing**
  - **Vitest 2.x** for unit + integration (Node and jsdom environments).
  - **Playwright** for E2E.
  - **Testcontainers** (`@testcontainers/postgresql`) for DB integration tests against a real Postgres with our RLS policies loaded.
- **Linting / formatting**
  - **Biome** as primary (format + lint), augmented by **ESLint** for the two rule sets Biome doesn't yet cover well: `eslint-plugin-react-hooks` and `@next/eslint-plugin-next`. Biome handles formatting exclusively (no Prettier).
- **AI / agents**
  - **`@anthropic-ai/sdk`** for direct API calls (server-side).
  - **Claude Agent SDK** for Process Agents and the Customization Agent.
  - **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) for streaming UI (Copilot).
  - Agents reach the ERP exclusively through an internal **MCP server** (separate process, see `mcp/` package below) — not by direct DB or tRPC access.
- **Observability**
  - **Sentry** (errors + tracing, both Next.js client+server).
  - **PostHog** (product analytics, feature flags, session replay).
  - **Axiom** (structured logs via Vercel log drain). Better Stack rejected for MVP — Axiom integrates natively with Vercel.
- **CI/CD**
  - **GitHub Actions** for CI (typecheck, lint, test, drizzle migration check).
  - **Vercel** for deploys (Preview per PR, Production on `main`).
  - **Supabase CLI** for DB migration application in CI on merge to `main`.

**Package layout (monorepo):**

```
super-meshine/
├── apps/
│   └── web/                   # Next.js 15 app (UI + tRPC route handler)
├── packages/
│   ├── db/                    # Drizzle schema, migrations, withTenant helper, RLS bootstrap
│   ├── api/                   # tRPC routers, procedures, zod input schemas
│   ├── ui/                    # shadcn/ui primitives + shared components
│   ├── agents/                # Claude Agent SDK integrations, agent definitions, prompts
│   ├── core/                  # Domain types & business logic shared across api+agents
│   └── config/                # Shared tsconfig, biome config, eslint config
├── mcp/
│   └── server/                # Internal MCP server exposing ERP capabilities to agents
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

הנימוק:
1. **tRPC ב-Next.js (לא service נפרד)** — היחיד שעולה בקנה אחד עם D2 (Vercel-only). long jobs ב-MVP אין; כשיהיו, נוציא worker (Inngest) בלי לשבור את ה-API layer.
2. **Supabase Auth** — היחיד מבין הארבעה שמתחבר native ל-RLS (`auth.uid()` ב-JWT זמין ישירות ב-policy). חינם עד 50K MAU. ה-lock-in כבר קיים מ-D2.
3. **postgres-js + code-first Drizzle** — postgres-js הוא ה-driver שדריזל ממליצים עליו ותומך נקי ב-`SET LOCAL` בתוך transaction. code-first נותן refactoring בטוח ב-IDE; schema-first SQL היה דורש codegen נוסף.
4. **Biome + ESLint hybrid** — Biome פי 25 מהיר מ-ESLint+Prettier ומספיק ל-95% מהמקרים, אבל react-hooks ו-next plugins עדיין נחוצים.
5. **MCP server נפרד** — Process Agents חייבים גישה לפעולות ERP אבל **אסור** להם גישה ישירה ל-DB; MCP server הוא הגבול שאוכף audit + permission gates.

נחזור ל-ADR הזה אם: Vercel function timeout מתחיל לחנוק work flows אמיתיים (אז Inngest/Trigger.dev), או Supabase Auth מתגלה כחסר לפיצ'ר משמעותי (org switching, SAML SSO ב-MVP).

## Consequences

- **חיובי:**
  - Builders יכולים להריץ `pnpm init` + scaffold מיידית ללא חזרה לארכיטקט.
  - Type-safety end-to-end: zod schema → drizzle-zod → tRPC procedure → react-hook-form → UI.
  - Cost ב-MVP: Vercel Hobby/Pro + Supabase Free/Pro + Sentry/PostHog free tiers ≈ $0–$45/mo עד שיש lיקוחות אמיתיים.
  - Single Vercel deploy = single rollback button.
- **שלילי / חוב טכני:**
  - Vercel function timeout (60s על Pro) יחנוק עבודות ארוכות → נצטרך להוציא worker מתישהו.
  - Biome עדיין צעיר; ייתכנו פערים בכללים שנשלים ב-ESLint.
  - Supabase Auth Hooks (להזרקת `tenant_id` ל-JWT) הוא Postgres function — debug שלו פחות נחמד מ-TypeScript middleware.
  - Code-first Drizzle: שינוי schema דורש re-generate ו-CI שיוודא שאין drift בין schema ל-DB.
- **השפעה על מודולים אחרים:**
  - `packages/db` הוא תלות חובה של `packages/api`, `packages/agents`, ו-MCP server.
  - `packages/api` ו-MCP server שניהם עוטפים את אותו core logic ב-`packages/core` — אין כפילות.
  - כל builder חדש (backend, frontend, agents) מקבל את ה-stack הזה כ-given; אם הוא צריך library חדשה — דרך CEO ל-architect.

## Reversal Conditions

נחזור ל-ADR הזה ולשקול שינוי אם:
- Vercel function limits נהיים bottleneck בייצור (long-running migration של Customization Agent חורג מ-60s/800s).
- Supabase Auth לא תומך בדרישת לקוח enterprise (SAML SSO לפני שאנחנו ב-Pro tier, או custom MFA flow).
- pnpm/Turborepo מתחילים להאט build ל-mono-monorepo (לא צפוי עד 50+ packages).
- Biome ימשיך להיות חסר ב-React rules → נחזור ל-ESLint full.
- מתגלה צורך ב-WebSockets/SSE persistent (Vercel Edge functions לא מיועדים לזה) → service נפרד.
- D2 ישונה (לא cloud-only יותר → on-prem) → כל ה-stack נפתח לדיון.

## Implementation Notes

ספציפי ל-backend-builder שמריץ scaffold ראשון:

1. **Init repo**
   ```
   pnpm init
   # pnpm-workspace.yaml: packages/*, apps/*, mcp/*
   pnpm add -Dw turbo typescript @types/node tsx vitest @biomejs/biome
   ```
2. **Next.js app**
   ```
   pnpm dlx create-next-app@latest apps/web --ts --tailwind --app --src-dir --import-alias "@/*" --no-eslint
   # Add to apps/web: shadcn-ui init, tanstack-table, react-hook-form, zod, @hookform/resolvers
   ```
3. **`packages/db`**
   - Deps: `drizzle-orm`, `postgres`, `drizzle-zod`. Dev: `drizzle-kit`.
   - `drizzle.config.ts` — dialect: `postgresql`, schema: `./src/schema/*.ts`, out: `./drizzle`.
   - Export a `createDb(connectionString)` factory and a `withTenant(db, tenantId, async (tx) => {...})` helper that runs:
     ```
     await tx.execute(sql`SET LOCAL app.current_tenant = ${tenantId}`)
     ```
     inside a transaction.
   - Use **two** connection strings: pooled (Supabase Pooler, port 6543, transaction mode) for tRPC; direct (port 5432) for `drizzle-kit migrate` only.
4. **`packages/api`**
   - Deps: `@trpc/server`, `superjson`, `zod`, plus workspace deps on `@super-meshine/db`, `@super-meshine/core`.
   - Define a `createTRPCContext` that extracts the Supabase JWT, verifies it (using `@supabase/ssr`), pulls `sub` and `tenant_id` claims, and returns `{ userId, tenantId, db }`. Procedures wrap their logic in `withTenant(ctx.db, ctx.tenantId, ...)`.
5. **Auth setup in Supabase**
   - Create a Postgres function `public.add_tenant_to_jwt()` that reads from `memberships` and returns `{ tenant_id }`.
   - Register it as a Custom Access Token Hook in Supabase Auth dashboard.
6. **`apps/web` tRPC route handler**
   - `apps/web/src/app/api/trpc/[trpc]/route.ts` — standard tRPC fetch adapter, passes `req` to `createTRPCContext`.
   - Client: `@trpc/client` + `@trpc/react-query` v11 (TanStack Query v5).
7. **Biome + ESLint**
   - `biome.json` at repo root: format (2 spaces, single quotes, trailing comma `all`) + lint (recommended).
   - `.eslintrc` at `apps/web` only: extends `next/core-web-vitals` + `plugin:react-hooks/recommended`. Disable all stylistic rules (Biome owns formatting).
8. **CI (`.github/workflows/ci.yml`)**
   - Jobs in parallel: `pnpm biome ci`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @super-meshine/db drizzle-kit check` (drift detection).
   - On `main`: additional job `drizzle-kit migrate` against staging DB; production migration is manual approval.
9. **Env vars convention** (validated via zod at startup, fail fast):
   - `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations only)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `AXIOM_TOKEN`
10. **Do not** install: `@trpc/next` (legacy adapter — use fetch adapter), `eslint-config-next` for monorepo root (only inside `apps/web`), `prettier` (Biome handles formatting), `pg` (use `postgres-js`).
