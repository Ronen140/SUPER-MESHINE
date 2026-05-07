---
name: setup-deployment
description: Use when SUPER-MESHINE infrastructure needs to be initialized, modified, or troubleshot — Vercel project, Supabase project (DB + Auth + Storage), Sentry error monitoring, PostHog product analytics, Axiom logs, or GitHub Actions CI. Triggers on phrases like "deploy setup", "Vercel setup", "Supabase project", "create database", "monitoring setup", "CI setup", "deployment broken", "set up infrastructure". This skill replaces a separate devops-engineer agent — use it inline rather than dispatching a separate agent for ops tasks.
---

# Setup & Deployment

## Overview

Operational checklist for initializing or modifying SUPER-MESHINE infrastructure on the locked stack from ADR-003: Vercel (Next.js host), Supabase (Postgres + Auth + Storage), Sentry (errors), PostHog (analytics), Axiom (logs), GitHub Actions (CI). Monorepo is Turborepo + pnpm workspaces (ADR-004). Auth is Supabase Auth + JWT custom claims (ADR-005).

This is **not** a long-running agent — it's a step-by-step playbook. The invoker (typically `backend-builder`, sometimes `engineering-manager`) runs the relevant section and reports status back to the orchestrator.

## When to Use

```
New environment (dev / staging / prod)?      → Run all sections A–F.
Adding monitoring (Sentry/PostHog/Axiom)?    → Run only the relevant section (C / D / E).
CI/CD workflow change?                       → Run section F.
Production debug?                            → Section H (Troubleshooting).
Cost review or alert thresholds?             → Section G.
```

Skip this skill for: generic Next.js/Supabase questions answered by docs, schema-only migrations (use `backend-builder` directly), or anything not touching infra config.

## Prerequisites

Before starting any section:

- [ ] **pnpm 9.x** installed (`pnpm -v`).
- [ ] **Vercel CLI** installed: `npm i -g vercel`.
- [ ] **Supabase CLI** installed: `npm i -g supabase`.
- [ ] GitHub repo exists at `https://github.com/Ronen140/SUPER-MESHINE`.
- [ ] **Anthropic API key** available (production AI agents — pulled from secret manager, never committed).
- [ ] Logged into Vercel (`vercel login`), Supabase (`supabase login`), and GitHub (`gh auth status`).

If any prerequisite is missing, stop and report back — do not improvise installs in CI environments.

## Section A — Initial Vercel project setup

1. From `apps/web/`: `vercel login` then `vercel link`.
2. **Root Directory:** `apps/web` (monorepo root not at repo root).
3. **Build Command:** `cd ../.. && pnpm turbo run build --filter=web`.
4. **Output Directory:** `apps/web/.next`.
5. **Install Command:** `pnpm install`.
6. **Node Version:** 22 (Active LTS per ADR-003).
7. **Environment variables** to add (values pulled from secret manager — never paste in chat):
   - `DATABASE_URL` — Supabase pooler connection (port 6543, transaction mode).
   - `DIRECT_URL` — Supabase direct connection (port 5432). Migrations only.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   - `ANTHROPIC_API_KEY`.
   - `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
   - `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
   - `AXIOM_TOKEN`, `AXIOM_DATASET`.
8. **Branch deploys:** Preview Deploys enabled for all branches; `main` is Production.
9. **Verify:** `vercel deploy` from local — must succeed without errors.

## Section B — Initial Supabase project setup

1. Create project at supabase.com. **Region: `eu-central-1`** (Israeli proximity until on-prem becomes a requirement).
2. From `packages/db/`: `supabase init`.
3. `supabase link --project-ref <ref>`.
4. **Auth providers:** enable email+password and Google OAuth (per ADR-005). Magic link optional.
5. **JWT custom claims:** register the Postgres function `public.add_tenant_to_jwt()` as a Custom Access Token Hook in the Supabase Auth dashboard (per ADR-005 §5 and Implementation Notes).
6. Run initial migrations: `pnpm db:migrate` (after `backend-builder` has scaffolded the Drizzle schema in `packages/db/src/schema/`).
7. **Verify RLS** is enabled on every tenant-scoped table:
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname='public';
   ```
   Every tenant-scoped row must show `t`. Any `f` is a release-blocker.
8. Daily logical backup to S3 per ADR-002 Implementation Notes #11.

## Section C — Sentry setup

1. Create org + project at sentry.io.
2. From `apps/web/`: `pnpm add @sentry/nextjs`.
3. Run wizard: `npx @sentry/wizard@latest -i nextjs` inside `apps/web/`.
4. Configure `sentry.client.config.ts` and `sentry.server.config.ts` with the DSN.
5. **Data scrubbing** at the org level: enable for patterns `password`, `token`, `apiKey`, `authorization`, `secret`.
6. **Verify:** throw `new Error('sentry test')` in dev, confirm event appears in the Sentry UI.
7. Source maps: handled automatically by `@sentry/nextjs` (`SENTRY_AUTH_TOKEN` required at build time).

## Section D — PostHog setup

1. Create project at posthog.com.
2. From `apps/web/`: `pnpm add posthog-js`.
3. Initialize in `apps/web/app/providers.tsx` using `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST`.
4. **Session replay:** ON for prod, OFF for dev.
5. **Feature flags:** none at MVP — leave for later.
6. **Verify:** capture a test event (e.g. `posthog.capture('setup_test')`) and confirm it appears in the PostHog UI.

## Section E — Axiom setup

1. Create dataset at axiom.co.
2. From `apps/web/`: `pnpm add next-axiom`.
3. Configure middleware in `apps/web/middleware.ts` for log shipping.
4. **Log levels:** `error`, `warn`, `info` ship to Axiom; `debug` only in dev.
5. **Verify:** emit a structured log and confirm it surfaces in the Axiom UI.

## Section F — GitHub Actions CI

Create `.github/workflows/ci.yml` with parallel jobs:

1. **lint** — Biome check (`pnpm biome ci`).
2. **typecheck** — `pnpm typecheck` (`tsc --noEmit` across all packages via Turborepo).
3. **test** — Vitest unit tests (`pnpm test`).
4. **build** — Turborepo build with remote cache (`pnpm build`).

**Repo secrets required:**
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- `TURBO_TOKEN`, `TURBO_TEAM` (Turborepo remote cache).
- `DATABASE_URL` (test DB only — never the production string).

**Branch protection on `main`:** require status checks + 1 approval (defer the approval rule until the team grows past one person).

## Section G — Cost monitoring

Cheapest-tier targets at MVP:

| Service | Free tier | Headroom |
|---|---|---|
| Vercel Hobby | free | until first paying customer |
| Supabase Free | 500 MB DB, 50K MAU | until Pro is needed |
| Sentry | 5K events/mo | sufficient at MVP |
| PostHog | 1M events/mo | sufficient at MVP |
| Axiom | 500 MB/mo | sufficient at MVP |

**Total target: $0/month until first $X ARR.**

Set billing alerts at **50%, 75%, 90%** of each free-tier limit. Anthropic API spend monitored separately (per-tenant rate limits in app layer per ADR-005 #8).

## Section H — Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Vercel build fails on monorepo | Check Root Directory (`apps/web`) + Build Command (`cd ../.. && pnpm turbo run build --filter=web`). |
| Supabase migration fails | Confirm `DIRECT_URL` (port 5432) is used for migrations, not `DATABASE_URL` (pooler). |
| Sentry not capturing client errors | Verify DSN; ensure `NEXT_PUBLIC_` prefix on any client-exposed Sentry env. |
| PostHog not initializing | Verify `NEXT_PUBLIC_POSTHOG_KEY` is set in Vercel; check provider mounted in `app/providers.tsx`. |
| Axiom logs missing | Confirm `AXIOM_TOKEN` + `AXIOM_DATASET` set; verify middleware path matches routes. |
| RLS shows `rowsecurity=f` on a tenant table | Block release. Add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and policy before deploy. |

## After running this skill

The invoker reports back to the orchestrator with:

- **Status:** `ok all sections completed` | `partial (which sections)` | `blocked (which step + why)`.
- **Files touched:** any config files added/modified (`vercel.json`, `sentry.*.config.ts`, `.github/workflows/ci.yml`, etc.).
- **Verification evidence:**
  - One successful test deploy URL.
  - One captured error visible in Sentry.
  - One captured event visible in PostHog.

Do not consider this skill complete without all three verification artifacts when sections A–E ran.
