# Engineering Acceptance Review: Invoicing & Receipts — Phase 0

**Date:** 2026-08-30 (updated live — see note on 0017 below)
**Source plan:** [[invoicing-phase-0-plan]] (Revisions 1-3 + point-fix note on Amendments B/C migration renumbering)
**CEO brief:** "כל העבודה של Phase 0 הושלמה — acceptance review סופי, decision לפני דיווח למייסד."
**Branch / HEAD at time of review:** `claude/invoicing-receipts-system-2asysv` @ `8ae3148`, **with migration `0017` reported in progress by backend-builder at time of writing** (see Result, item A).

## Scope note on migration numbering

The plan (Revisions 1-3) tracked migrations through `0010`. In actual execution, two additional architect amendment rounds (ADR-INV-001 Amendment B, Amendment C) and one addendum (ADR-INV-002 Addendum A′) were dispatched directly by the CEO to backend-builder mid-build, each adding migrations. **Final as-built migration list (verified via `ls` on disk):**

`0001_extensions` · `0002_enums` · `0003a_core_tables` · `0003b_document_tables` · `0004_rls_helpers` · `0005_rls_policies` · `0006_audit` · `0007_immutability` · `0008_issue_function` · `0009_amendments` (line-value freezing + credit-parent-type guard + RPC→`public`) · `0010_addendum_fixes` (issue_date preservation + date-derived draft VAT + `search_path` root-cause + CI check ח) · `0011_create_business` · `0012_storage_buckets` · `0013_signing_key_check` (Amendment C-2) · `0014_app_execute_hardening` · `0015_amendment_c` (`compute_line` back to `app` schema) · `0016_log_event_and_fixes` (4 quality-review fixes) · **`0017` in progress** (see below).

This drift from the plan's exact file names is expected and accepted — the plan's subtask **scope/AC** is what's being graded here, not exact filenames, consistent with how Revisions 1-3 already treated file-naming as an implementation detail once subtask content was verified.

## Per-subtask review

### Subtask B1 — Project scaffold & tooling
- **Files:** `package.json`, `pnpm-workspace.yaml`, `biome.json`, `tsconfig.json`, `.env.example`, `src/server/service-role/client.ts`
- **Reviews:** spec-reviewer ✅ (`spec/2026-08-30-1530-invoicing-phase0-batch1.md`, after 1 fix — `moddatetime`, see B3), code-quality-reviewer ✅ (`quality/2026-08-30-invoicing-phase0-batch1.md`, 0🔴/0🟡/2🟢)
- **AC met:**
  - [x] `pnpm install`/`build`/`typecheck`/`lint`/`format`/`test` exit 0 — verified independently by both reviewers.
  - [x] `noRestrictedImports` on `service-role/**` — verified with live fixture by both reviewers, later upgraded to a permanent regression test (`tests/no-restricted-imports.test.ts`).
  - [x] Independent workspace (not swallowed into ERP root) — verified.
- **Verdict:** ✅ accepted.

### Subtask B2 — Migrations: extensions + enums
- **Files:** `0001_extensions.sql`, `0002_enums.sql`
- **Reviews:** same as B1 (same batch).
- **AC met:** [x] 9 enums verbatim to ADR §D2; [x] `pgcrypto`/`citext`; [x] down migrations clean roundtrip.
- **Verdict:** ✅ accepted.

### Subtask B3 — Migration: core tables
- **Files:** `0003a_core_tables.sql`
- **Reviews:** spec-reviewer ❌→✅ (round 1 found one gap: `updated_at` implemented as a custom trigger instead of the ADR-mandated `moddatetime` extension — a real deviation from an explicit ADR instruction, not a builder-level judgment call; fixed in `18e079d`, round 2 confirmed by quality-reviewer). code-quality-reviewer ✅.
- **AC met:** [x] all 8 tables/constraints/indexes match ADR §Schema line-for-line (independently verified by quality-reviewer); [x] `businesses_protect_identity_trg` present and empirically tested (3/3 blocked fields, 1/1 allowed field); [x] `on_auth_user_created` verified; [x] owner-guard trigger verified (`INV_NO_OWNER`).
- **Verdict:** ✅ accepted (first-round gap caught and fixed correctly — the review loop worked as designed).

### Subtask B4 — Migration: document tables
- **Files:** `0003b_document_tables.sql`
- **Reviews:** same batch, ✅/✅.
- **AC met:** [x] all 7 tables/CHECKs/indexes match ADR line-for-line; [x] `signed_total` generated column verified with real values; [x] no RLS statement present (verified by grep by both reviewers) — correct scope boundary.
- **Verdict:** ✅ accepted.

### Subtask B5 — RLS helper functions
- **Files:** `0004_rls_helpers.sql`
- **Reviews:** spec-reviewer ✅ (`spec/2026-08-30-invoicing-phase0-batch2.md`), code-quality-reviewer ✅ (`quality/2026-08-30-invoicing-phase0-batch2.md`, 0🔴/1🟡[unrelated]/1🟢).
- **AC met:** [x] `app.current_business_ids()`/`app.has_role()` — `SECURITY DEFINER`, `STABLE`, `set search_path`; [x] non-recursion empirically verified with `EXPLAIN` (single cached `SubPlan`, not per-row).
- **Verdict:** ✅ accepted.

### Subtask B6 — RLS policies
- **Files:** `0005_rls_policies.sql`
- **Reviews:** spec ✅, quality ✅ (with one ⚠️ judgment-needed on `document_lines` computational authority — **not a B6 defect**, resolved by Amendment A / `0009_amendments.sql`, see B7-adjacent verification below), domain-reviewer ✅ round 2 (`domain/2026-08-30-invoicing-phase0-batch2.md`).
- **AC met:** [x] FORCE on `business_signing_keys` only, verified against `pg_class.relforcerowsecurity` in a live DB by an independent reviewer; [x] `businesses` SELECT+UPDATE only, no INSERT/DELETE, verified with real cross-tenant attempts (userA cannot touch userB's rows, direct INSERT/DELETE both rejected); [x] `document_counters`/`audit_log` write-policy-free, verified.
- **Verdict:** ✅ accepted.

### Subtask B7 — Audit + immutability triggers
- **Files:** `0006_audit.sql`, `0007_immutability.sql` (+ `updated_at` fix landed later in `0009_amendments.sql`, see below)
- **Reviews:** spec ✅, quality ✅ with **1 🟡** (`documents.updated_at` never touched by any trigger — ADR Implementation Note #4 explicitly requires it) and **1 ⚠️ judgment-needed** (document-line value authority, see B7-note below).
- **Fix verification (direct inspection, since no dedicated review re-ran on `0009_amendments.sql` for this specific item):** `0009_amendments.sql:156-165` adds `documents_set_updated_at` (`moddatetime`, fires on every UPDATE, not just draft — correctly broader than the original ADR text once `document_lines`-driven post-issue mutations were understood). Consistent with the pattern already verified working on `businesses`/`customers`/`items` in B3. **Verified by me directly** — low-risk, mechanically simple, same trigger function already proven correct elsewhere.
- **⚠️ judgment-needed item (document_lines computational authority):** Was this a B7 defect? No — quality-reviewer explicitly scoped it as an ADR-interpretation question, not a bug in B7's own code. **Resolved** by `0009_amendments.sql` (`app.compute_line()` + `document_lines_compute()` trigger — single source of truth for line values, header sums now derive *from* line sums instead of a parallel formula). Domain-reviewer round 2 confirmed this closes the gap "in a way that eliminates the duplication that created it, more strongly than what was originally requested." ✅.
- **Verdict:** ✅ accepted (both the 🟡 and the ⚠️ closed by follow-on work, verified).

### Subtask B8 — `app.issue_document()` / `app.seed_for()` / `app.set_start_number()`
- **Files:** `0008_issue_function.sql`
- **Reviews:** spec ✅, quality ✅, domain-reviewer ❌→✅ (Round 1: 🔴 line-value integrity not enforced at DB level, 🟡 no guard on `credit_note` parent document type; **Round 2, after `0009_amendments.sql`: both closed, `✅ business-logic correct`**).
- **AC met:** [x] numbering race-safe under **real** 20-way concurrency (independently re-run by quality-reviewer, not just re-read: 1-20 exact, no gaps/dupes); [x] concurrent credit-note race against the same parent verified empirically (`credited_amount` exact, no lost update); [x] all `INV_*` error paths verified; [x] amounts always DB-derived, never client-trusted (verified, and *strengthened* post-Amendment-A: line values are now also DB-derived, closing the one real gap found).
- **Verdict:** ✅ accepted.

### Subtask B9 — `app.create_business()` + `api/keygen.py` + `POST /api/businesses`
- **Files:** `0011_create_business.sql`, `0013_signing_key_check.sql`, `api/keygen.py`, `api/_keygen_core.py`, `src/app/api/businesses/route.ts`
- **Reviews:** spec ✅ (`spec/2026-08-30-invoicing-phase0-batch3.md`, 1 gap on storage tests — that's B10, see below), code-quality-reviewer ❌→**in progress** (`quality/2026-08-30-invoicing-phase0-batch3.md`: **1 🔴 + 3 🟡**).
- **AC met:**
  - [x] `create_business()` atomicity (2 rows or 0, empirically fault-injected and verified).
  - [x] RSA-3072/X.509/envelope-encryption crypto correctness — independently re-verified by quality-reviewer against every ADR-mandated field.
  - [x] Two-step RPC-then-keygen sequencing, keygen failure does not fail business creation — verified.
  - [x] 5 `INV_*` codes mapped to Hebrew — verified.
  - [🟡→fixed, verified] TOCTOU on the 10-business limit — reviewer empirically reproduced (12 businesses created past a 10 cap under real concurrency); fixed in `0016` with `pg_advisory_xact_lock`, and a dedicated regression test (`tests/create-business-race.test.ts`) now exists per the concurrent-fix session log. **Verified by direct code inspection** (no dedicated re-review report exists — see Process Gaps below).
  - [🟡→fixed, verified] `route.ts` leaking raw Postgres error text — fixed (`toUserMessage()` now called server-side at the boundary, `route.ts:58`). **Verified by direct code inspection.**
  - [🟡→fixed, verified] KEK read as hex instead of ADR-mandated base64 — fixed (`_keygen_core.py:155`, `base64.b64decode(..., validate=True)`). **Verified by direct code inspection.**
  - [🔴→**IN PROGRESS, NOT YET VERIFIED**] Signing-key creation wrote **zero** `audit_log` rows anywhere — a direct hit on CLAUDE.md invariant #2. First fix attempt (`0016`: `public.log_event()` extended to accept `service_role` calls) has just been **rejected by the architect**. Backend-builder is now implementing migration `0017` (remove the `service_role` branch from `log_event()`; `api/keygen.py` writes to `audit_log` directly via `service_role`, matching the direct-INSERT pattern already used elsewhere rather than routing through a membership-checked RPC that doesn't fit a non-`authenticated` caller). **This is not yet built, tested, or reviewed as of this acceptance pass.**
- **Verdict:** ⚠️ **NOT YET ACCEPTED** — blocked on `0017` landing + verification. This was a confirmed 🔴 invariant violation (not a style nit); the interim fix has been overruled by the architect and its replacement does not exist yet on disk. Everything else in B9 is accepted.

### Subtask B10 — Storage buckets + policies
- **Files:** `0012_storage_buckets.sql`, `tests/storage-isolation.test.ts`
- **Reviews:** spec ❌→✅ (Round 1: bucket policies existed but had **zero** automated cross-tenant test coverage, a direct miss against the plan's explicit AC; closed by `tests/storage-isolation.test.ts`, 8 assertions, per commit `d560bf0` and the batch-3 quality reviewer's independent count "19+8 isolation/storage assertions... real, not tautological"). code-quality-reviewer ✅ (covered as part of batch 3, §Security 2: "8/8 real cross-tenant assertions, reproduced locally").
- **AC met:** [x] both buckets private; [x] `documents` SELECT-only, `business-assets` SELECT+INSERT-owner-only, no UPDATE/DELETE on either; [x] cross-tenant SELECT on `documents` fails — now with real automated coverage, independently re-run.
- **Verdict:** ✅ accepted (round-1 gap caught and closed correctly).

### Subtask B11 — Isolation test suite
- **Files:** `tests/isolation.test.ts`
- **Reviews:** spec ✅ (17 assertions verified present), code-quality-reviewer ✅ (traced assertions individually, confirmed non-tautological, confirmed FORCE-canary would actually flip red if `FORCE` were dropped).
- **AC met:** [x] 17/17 (12 base CRUD + 2 `businesses`-direct + 3 Amendment-A) — exceeds original 12-assertion ask from the CEO's Phase-0 brief, correctly expanded per Amendment A's scope growth.
- **Verdict:** ✅ accepted.

### Subtask B12 — Numbering race test
- **Files:** `tests/numbering-race.test.ts`, `tests/db/harness.ts`
- **Reviews:** spec ✅, code-quality-reviewer ✅ (confirmed genuinely concurrent — separate OS processes via `execFile`, not a labeled sequential loop, verified by reading the implementation).
- **AC met:** [x] 20 real concurrent `issue_document()` calls, 1-20 exact, no gaps/dupes, continuity on repeat run.
- **Verdict:** ✅ accepted.

### Subtask B13 — CI pipeline
- **Files:** `.github/workflows/ci.yml`, `scripts/ci-schema-checks.sql`, `scripts/migrate-down-up-roundtrip.sh`
- **Reviews:** spec ✅ (8 meta-checks present, up from the originally-planned 5 — grew correctly with Amendment A/B/C's new invariants), code-quality-reviewer ✅ (independently reproduced the full roundtrip + all 8 checks from a clean environment, using a genuine non-superuser `db_owner` role — the harness upgrade documented in Amendment C — "precisely what makes FORCE/USAGE bugs observable at all").
- **AC met:** [x] all 8 checks return 0 rows on a clean re-run by an independent party; [x] roundtrip up→down→up verified.
- **⚠️ Known limitation, not a defect:** the workflow has **never executed on real GitHub Actions infrastructure** — every "green" claim to date is from local/sandbox Postgres re-runs (by the builder and, independently, by two different reviewers). This is a real gap between "verified equivalent" and "verified on the actual CI system," but it is a environment constraint (no Docker in this sandbox — documented since Revision 1/3 of the plan), not a code defect. Low risk given the number of independent clean-environment re-runs, but **should be confirmed by an actual GitHub Actions run at push time**, per Definition-of-Done step 4 in CLAUDE.md, before this is called fully done in the house sense.
- **Verdict:** ✅ accepted, with the real-CI-run caveat noted above (does not block Phase 0 acceptance given the sandbox constraint was known and disclosed from the start, but must happen before the branch is considered mergeable per the house DoD).

### Subtask B14 — Ops jobs: keepalive + backup + restore-test skeleton
- **Files:** none found — `keepalive.yml`, `backup.yml`, `restore-test.yml`, `scripts/backup.sh`, `docs/ops-runbook.md` **do not exist on disk.**
- **Reviews:** none (nothing was submitted for review).
- **AC met:** none — **not built.**
- **My determination (per the CEO's explicit ask to judge whether this blocks Phase 0 or belongs to "setup"):** **Does not block *this* round's acceptance, but is a hard prerequisite before connecting to a live Supabase project.** The entire risk B14 exists to cover — Supabase Free's 7-day auto-pause and zero backup retention — is **dormant** while there is no live project at all (confirmed: this whole Phase 0 was built and verified against local Postgres only, by explicit original design). Shipping Phase 0 without B14 does not expose anything to that risk *today*. However, `docs/ops-runbook.md` was specifically supposed to tell the founder exactly which GitHub Secrets to configure — without it, the live-Supabase setup session (already planned as a separate step with the founder) has no checklist to work from. **Condition:** B14 must be built and verified before, or as the first step of, the live-Supabase setup session — not deferred indefinitely.
- **Verdict:** ⚠️ not built — **condition on go-live, not on this Phase 0 sandbox round.**

### Subtask F1 — App shell
- **Files:** `src/app/layout.tsx`, `src/components/ui/*`, `src/lib/supabase/{browser,server}.ts`, `src/app/globals.css`
- **Reviews:** spec ❌→✅ (Round 1: 2 gaps — no dedicated test for the Supabase client factories themselves [only mocked in consumer tests], and "browser verification" was actually curl+jsdom, not a real browser. Round 2: both closed — real, unmocked tests for `browser.ts`/`server.ts` including the `throw`-on-missing-env paths; real Playwright/Chromium screenshots of RTL rendering, form validation, and login redirect). code-quality-reviewer ✅ (0🔴/4🟡, all in F2 territory — see below).
- **AC met:** [x] RTL/logical-properties (verified by grep, zero physical-direction properties in any changed file); [x] design tokens match the Discovery doc (stone+emerald primary, Assistant font, `tabular-nums`); [x] client factories now genuinely tested; [x] genuine Chromium-headless verification exists (screenshots reviewed).
- **Verdict:** ✅ accepted.

### Subtask F2 — Auth flow
- **Files:** `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/lib/auth/public-paths.ts`, `src/app/(auth)/{login,signup}/*`, `src/components/auth/logout-button.tsx`
- **Reviews:** spec ✅ (bundled with F1, same round), code-quality-reviewer ✅ with **4 🟡** (missing `try/catch` around 3 auth calls; signup not handling the confirm-email `data.session === null` case; two silent fail-open paths in middleware with no logging).
- **Fix verification:** all 4 confirmed fixed and tested per the F3-F4 spec review's checklist (items #16-19, cross-referencing the F1-F2 quality report directly and citing the new test files for each) — `try/catch` added to all 3 forms with tests, signup now checks `data.session`, both middleware paths now log. **No dedicated F1-F2 quality *re-review* report exists confirming this from the quality-reviewer's own checklist perspective** (see Process Gaps) — I verified the fix content directly against the F1-F2 quality report's exact file/line citations and confirm they match.
- **Also noted (not blocking):** quality-reviewer flagged a ⚠️ judgment-needed item — refresh-token cookies are not `HttpOnly` — but correctly identified this as an unavoidable consequence of the already-approved architecture decision ("Supabase Auth directly from the browser, no tRPC/session-backend layer"), not a defect introduced by F2's code. No action needed beyond what's already documented in the plan.
- **Verdict:** ✅ accepted.

### Subtask F3 — Business creation form
- **Files:** `src/app/(app)/businesses/new/{page.tsx,business-form.tsx}`, `src/lib/schemas/business.ts`
- **Reviews:** spec ❌→✅ (Round 1: **one real over-build** — address fields [`address_line1`/`city`/`postal_code`] plus a whole separate best-effort write path [`saveAddressDetails`] added to the form despite not being in `create_business()`'s signature, not in the F3 spec, and contradicting the page's own copy telling the user to add address "later, via business settings." Fixed: fully removed in `bd04cbe`, confirmed by grep — zero remaining references — and a bundle-size regression check as a side benefit, 219kB→151kB first-load JS on that route). **code-quality-reviewer: never run — no quality report exists for F3-F4 at all** (see Process Gaps — this is a real, not cosmetic, gap in the review chain).
- **AC met (from spec review, all ✅ after the fix):** [x] form → `POST /api/businesses`, not direct RPC; [x] two-step RPC-then-keygen preserved server-side; [x] spinner during creation; [x] all 5 `INV_*` codes mapped to Hebrew; [x] `entity_type` immutability warning shown; [x] `tax_id` 9-digit client validation; [x] keygen-failure banner + retry, matching ADR-INV-001 §D10's literal text.
- **Verdict:** ⚠️ **spec-accepted, but never passed code-quality-reviewer.** Per hard rule #6 ("every feature goes through spec-reviewer → code-quality-reviewer... no skipping"), this is not fully closed. This form does non-trivial work (retry-on-keygen-failure state machine, direct fetch to a server boundary) that warrants the same security/error-handling scrutiny F1/F2/B9 all received and F3 has not.

### Subtask F4 — Business switcher
- **Files:** `src/components/business-switcher.tsx`, `src/app/(app)/businesses/actions.ts`, `src/lib/businesses/{get-user-businesses,get-active-business}.ts`
- **Reviews:** spec ✅ (bundled with F3, same round — 0/1/2+ business states, ownership re-verified server-side before writing the cookie, `httpOnly` cookie [not `localStorage`], full-layout refresh on switch). **code-quality-reviewer: never run** (same gap as F3 — this is the *same* review pass that was skipped for both).
- **AC met (from spec review):** [x] all three switcher states; [x] server-side ownership re-check before cookie write (RLS-scoped `SELECT`, matching the rest of the project's "RLS is the only source of truth" pattern); [x] `router.refresh()` on switch, no state leakage across the layout boundary.
- **Verdict:** ⚠️ **spec-accepted, but never passed code-quality-reviewer** — same condition as F3. The `httpOnly` cookie mechanism and the ownership-recheck server action are exactly the kind of session/authorization-adjacent code the security checklist exists to scrutinize, and it has not been.

## Integration check

- **Does the whole thing connect end-to-end as one working feature?** Yes, at the code level: `POST /api/businesses` → `create_business()` RPC → `keygen` → `business_signing_keys` row → `issue_document()` gated on that row existing (`INV_NO_SIGNING_KEY` verified) → RLS/audit/immutability enforced identically whether the write originates from a test harness or the real Next.js routes. The F3→F4 flow (create business → land on it → switch between businesses) is spec-verified with real ownership checks, though never browser-verified end-to-end with a live Supabase project (see below — by design, not by omission).
- **Are the 4 invariants met end-to-end?**
  - **Multi-tenancy:** ✅ — 17+8 = 25 automated cross-tenant assertions, re-run independently by a reviewer, covering tables, `businesses` itself, and storage.
  - **Audit log on every mutation:** ⚠️ **not yet fully met** — every table-level mutation is covered (`app.audit_trigger()` on 11 tables + `businesses`, independently verified), **except signing-key creation**, which is the one confirmed 🔴 gap still being fixed as of this review (migration `0017`, in progress, unreviewed).
  - **Agent-action gating:** N/A — no Process Agents in this project (correctly and repeatedly documented as such across every review).
  - **Migration rollback:** ✅ — full up→down→up roundtrip over all 17 migrations independently re-run clean by a reviewer.
- **Edge cases verified (sample, not exhaustive — see individual reviews for full lists):** double-issue rejected; credit exceeding parent rejected; credit against a quote/proforma rejected (closed in Amendment A); 20-way numbering race exact; concurrent credit-note race against the same parent exact; 10-business TOCTOU exact after the `0016` fix; `create_business()` fault-injection mid-transaction leaves zero rows; storage cross-tenant read rejected; open-redirect via `?next=` blocked; confirm-email signup flow now handled.

## Process gaps found during this acceptance review (not code defects — flagging for qa-manager/CEO awareness)

1. **F3-F4 never went through code-quality-reviewer.** Confirmed by directory listing of `vault/Reviews/quality/` — only `f1-f2`, `batch1`, `batch2`, `batch3` exist. This is the most concrete gap found in this review and is why F3/F4 above are marked ⚠️ rather than ✅.
2. **Missing written round-2 sign-off reports** for: the batch-3 quality-fix round (the 4 findings fixed in `0016` — I verified the fixes directly in code since no re-review file exists), and the F3-F4 address-field removal (fixed in `bd04cbe` — same situation). The batch-3 quality-reviewer itself flagged an analogous gap for the batch-3 spec round 2. This looks like a recurring pattern in this feature's review loop (fixes get made and logged in Meeting Notes, but a fresh reviewer pass confirming them in writing doesn't always happen) — worth a process note to qa-manager, not something I can fix from this seat.
3. **CI has never executed on real GitHub Actions** — only local/sandbox-equivalent runs (see B13).

## Result

**⚠️ ACCEPT-WITH-CONDITIONS**

Phase 0 is substantively complete and, on the evidence available, technically excellent — the review chain caught and closed every real defect it was given a chance to look at (moddatetime, line-value integrity, credit-parent-type, storage-test-gap, TOCTOU, error-leak, KEK-encoding, all four F1-F2 🟡s), and multiple independent reviewers re-ran the empirical evidence from clean environments rather than trusting the implementer's word. But it is not clean enough to tell the founder "done" today, for three concrete reasons:

**Blocking conditions (must close before I'd call Phase 0 fully accepted):**
1. **Migration `0017` (audit log on signing-key creation) must land, and the fix must be verified** — this was a confirmed CLAUDE.md invariant #2 violation (not a style nit), its first fix was just rejected by the architect, and its replacement does not exist on disk yet. I recommend at minimum a fresh spec-reviewer pass on `0017` given the churn (two attempts on the same invariant in one day is exactly the situation the review loop exists for) — code-quality-reviewer re-confirmation is a judgment call for qa-manager, but I'd want it given this exact spot already produced one rejected design.
2. **F3 and F4 must go through code-quality-reviewer** — this has never happened. Given both touch cookie/session-adjacent authorization logic, this is not a formality to skip.

**Non-blocking conditions (must close before connecting to a live Supabase project, i.e. before the separate founder go-live session — not before reporting Phase 0 as done for this sandbox round):**
3. **B14 (keepalive + backup + restore-test + ops runbook) must be built.** Dormant risk today (no live project exists), but the runbook is the founder's own checklist for that session and doesn't exist yet.

**Notes for CEO:**
- The other two open points from your brief — CI never run on real GitHub Actions, and no live-Supabase end-to-end verification — are not defects; they're consequences of a disclosed, intentional environment constraint (no Docker in this sandbox; no live Supabase project by original design) that was flagged as far back as Revision 1 of the plan. I'm not blocking on either — the volume of independent clean-environment re-verification (three different reviewers, from scratch, across three batches) is strong evidence the code will behave the same on real infrastructure, but "will behave the same" isn't "confirmed," so I'd still want a real CI run and a real go-live smoke test before calling the *feature*, as opposed to *this Phase 0 sandbox round*, done.
- Recommend a short, tight follow-up round scoped to exactly: `0017` + its review, F3/F4 quality pass, and B14 — not a full Phase 0 re-litigation. Everything else above is ✅ and shouldn't be reopened.
- The review chain's own process gaps (point 2 in "Process gaps") are worth a word to qa-manager — not urgent, but the pattern of fix-without-re-review-report happened three times in one day on this feature.
