# Code Quality Review: Invoicing Phase 0 — Batch 3 (B9-B13) + migrations 0010-0015

**תאריך:** 2026-08-30 17:40
**Base SHA:** `7bea4b7` (docs ADR-INV-002 Addendum A′ — last commit before Batch 3 work started)
**Head SHA:** `09d62a9` (fix Amendment C-1 — compute_line back to app schema with narrow grants, 0015)
**Spec:** `vault/Engineering/invoicing-phase-0-plan.md` (B9-B13); `invoicing-receipts/docs/adr/001-data-model-and-rls.md` (Amendment C, §D3/§D3.2/§D3.3/§D10); `invoicing-receipts/docs/adr/002-immutability-and-numbering.md` (§D2, §D8, Addendum A′); `invoicing-receipts/docs/adr/003-pdf-signing-storage.md` (§D4)
**Spec-reviewer:** ✅ round #2 per CEO briefing (round #1 — `vault/Reviews/spec/2026-08-30-invoicing-phase0-batch3.md` — was ❌ on one gap: no automated test for storage-bucket isolation; that gap was closed by `tests/storage-isolation.test.ts` + the separate Amendment C-1 fix, per `vault/Meeting Notes/invoicing-receipts-system.md`'s "Spec-review fix" session entry). **Note:** I could not find a written round-#2 spec-review report file in `vault/Reviews/spec/` — only round #1's ❌ is on record. Not my call to adjudicate (hard rule #2), flagging for the CEO's own records only.
**סבב code-quality-reviewer:** #1
**Security checklist:** הופעל — ה-diff נוגע ב-auth/RBAC bootstrap (`create_business`), RLS/`FORCE` (storage policies, `business_signing_keys` access), `SECURITY DEFINER` whitelist, secrets (KEK/service-role key handling in `api/keygen.py`), ו-audit log (`business_signing_keys` creation, ADR-INV-001 §D11).

## תוצאה: ❌ issues

**Severity counts:** 🔴 1 | 🟡 3 | 🟢 4

Batch 3 is the most rigorously self-documented and empirically-verified work I've reviewed in this project so far — the migrations narrate their own bug discoveries (C-1/C-2/C-3) with a level of honesty and detail rarely seen, every DB-level claim in the commit history is backed by a real Postgres-16 test run (not just re-reading code), and I was able to reproduce every headline claim myself (roundtrip, 8/8 CI checks, 122/122 Vitest, 18/18 pytest, all green from a clean state). The block on merge is **one confirmed, empirically-verified 🔴**: signing-key creation (`api/keygen.py` → `business_signing_keys`) currently writes **zero** audit-log rows anywhere in the system — a direct hit on CLAUDE.md invariant #2 ("audit log על כל mutation... לא חורגים מזה גם ב-migrations") and on this review's own explicit 🔴 criterion ("missing audit log on mutation"). Two 🟡 (a real, empirically-reproduced TOCTOU on the 10-business limit, and a raw-Postgres-error-message leak at the API boundary) round out the "should fix before merge" list.

## Strengths

- **Every headline verification claim in the commit history reproduces exactly, from a clean environment, on first try.** I ran `scripts/migrate-down-up-roundtrip.sh` (full up→down→up over all 15 migrations, `db_owner` as a real non-superuser, exactly as CI does it) — clean pass, all 8 `ci-schema-checks.sql` meta-checks green. `pnpm test` → 122/122 (vs. the reported 118/118 — the extra 4 are F3/F4 work landed in parallel, not part of this batch, confirmed by diff). `.venv`'s pytest → 18/18. `pnpm typecheck` clean. `pnpm build` clean (initial failure was a stale `.next` cache artifact in the sandbox, unrelated to this diff — reproduced clean after `rm -rf .next`).
- **The `db_owner`-as-non-superuser harness upgrade (documented in Amendment C) is real methodological rigor, not a claim.** I independently verified the exact mechanism: `tests/db/harness.ts`/`scripts/migrate-down-up-roundtrip.sh` create a genuinely non-superuser owner role and grant it membership in `anon`/`authenticated`/`service_role` rather than running as the Postgres bootstrap superuser — this is precisely what makes `FORCE ROW LEVEL SECURITY` bugs (C-2) and schema-`USAGE` bugs (C-1) observable at all. Confirmed by reading `harness.ts`'s own extensive comments and by successfully running the full roundtrip under this exact setup myself.
- **The 19+8 isolation/storage assertions (`tests/isolation.test.ts`, `tests/storage-isolation.test.ts`) are real, not tautological.** Traced every assertion: each one performs a genuine cross-tenant mutation attempt as `userB` and then verifies the *actual stored state* from `userA`'s perspective (or vice versa) — not just "the call returned an error." Assertion #17 (`create_business()` atomicity) injects a real trigger-based fault *after* the `businesses` INSERT and proves zero rows / a free `tax_id` afterward, not merely that the call rejected. The FORCE canary (`business_signing_keys` invisible even to the raw table-owner connection) is the one assertion in the suite that would actually flip green→red if `FORCE` were silently dropped — correctly isolated as such in its own comment.
- **The numbering-race test (`tests/numbering-race.test.ts`) is genuinely concurrent, not a labeled sequential loop.** `harness.ts`'s `runSql()` shells out to `psql` via `execFile` per call; `Promise.all(documentIds.map(id => runSql(...)))` fires 20 real, separate OS processes without an intervening `await`. I confirmed this by reading the implementation, not just trusting the test's own docstring.
- **`api/_keygen_core.py` gets the crypto right on every ADR-mandated dimension I checked**: RSA-3072 with the standard 65537 exponent; X.509 self-issued certificate with exactly the ADR's fields (CN/serialNumber/O/C, `BasicConstraints CA:FALSE`, `KeyUsage` digitalSignature+contentCommitment, `ExtendedKeyUsage` `1.3.6.1.5.5.7.3.36`, ~10y validity — all asserted in `test_keygen.py` and verified by reading the `cryptography` calls directly); AES-256-GCM envelope encryption with a fresh, independent nonce per operation (`private_key_nonce` for the DEK-encryption, a separate prepended nonce for the KEK-wrap) — the module's own header comment correctly reasons through *why* this is safe given the schema's one-nonce-column constraint; `kek_from_env()` fails loudly (`RuntimeError`) on a missing or wrong-length KEK — **no silent/dangerous fallback**. Private key material is never logged, never returned in any response (`test_create_signing_key_record_never_includes_the_raw_private_key`), and `api/keygen.py`'s error mapping deliberately never echoes Supabase's raw response body back to the caller (`_insert_signing_key`'s `except` block).
- **Amendment C's `compute_line`/`business_has_signing_key` narrative is the kind of documentation this project needs to survive 3 years.** Every migration in this batch that fixes a bug explains the wrong alternative that was tried first, why it was wrong, and cites the exact prior ADR section that made the (now-corrected) claim — verified by reading `0010`, `0013`, `0014`, `0015` end-to-end, not just their headers.
- `errors.ts` correctly extends the `INV_*` map with all five B9 codes (`INV_UNAUTHENTICATED`, `INV_NO_PROFILE`, `INV_BUSINESS_LIMIT`, `INV_BAD_TAX_ID`, `INV_TAX_ID_EXISTS`), matching `0011_create_business.sql` exactly.

## Quality Checklist

### A. Naming & Structure
- [x] Function/variable names are descriptive throughout (`generate_and_store_signing_key`, `envelope_decrypt_private_key`, `requestSigningKey`).
- [~] `0010_addendum_fixes.sql` is 679 lines — the largest file born in this batch. Not flagged as a blocking 🟡: it is a `create or replace` migration restating several pre-existing function bodies verbatim plus small diffs (the "never edit a committed migration" rule forces this shape), and every section is clearly delimited with its own header comment explaining which ADR item it fixes. Noted as a 🟢 below for future large corrective migrations.
- [x] Each new file has one clear responsibility (`_keygen_core.py` = pure crypto, `keygen.py` = HTTP/Supabase-insert orchestration, `route.ts` = two-step sequencing).

### B. Type Safety
- [x] No unexplained `any`. The two `as` casts in `route.test.ts` (`as ReturnType<typeof vi.fn>`) are conventional Vitest-mock typing, not risk.
- [~] `route.ts`'s `business` (destructured from `supabase.rpc("create_business", ...)`) is implicitly `any` because this project's Supabase clients (`src/lib/supabase/server.ts`, `src/server/service-role/client.ts`) are never instantiated with a generated `Database` generic anywhere in the codebase — a pre-existing, project-wide gap from F1/F2, not introduced by this batch. Low practical risk here specifically (the value is your own just-created row, not attacker-controlled), but worth a follow-up ticket once a `Database` type is generated, since every `.rpc()`/`.from()` call in the project is silently untyped until then.
- [x] Zod boundary validation present and correct on the one new HTTP boundary (`route.ts`'s `bodySchema`, including a 9-digit regex on `tax_id` — redundant-but-correct defense-in-depth against `0011`'s own server-side check).

### C. Error Handling
- [x] No empty `catch` blocks. `route.ts`'s `requestSigningKey()` catch, `keygen.py`'s `_insert_signing_key()`'s `except urllib.error.*`, and `kek_from_env()`'s missing/malformed-KEK path all convert to specific, actionable outcomes.
- [x] Postgres exceptions are consistently `INV_CODE: detail` + `errcode = 'P0001'` across all new/changed functions in 0010-0015.
- [ ] **🟡 `route.ts:55` forwards the raw Postgres/PostgREST `error.message` straight to the HTTP client, bypassing `toUserMessage()` server-side** — see Issues.

### D. Database Queries
- [x] `0011_create_business.sql`'s two INSERTs (`businesses`, `business_members`) + `audit_log` write are in the same implicit function-transaction — empirically proven atomic by `isolation.test.ts` assertion #17 (injected mid-transaction failure → zero rows, `tax_id` free again).
- [ ] **🟡 TOCTOU on the 10-business-per-user limit** — `0011_create_business.sql:46-50`'s `select count(*)` has no lock and no serializable isolation; empirically reproduced (see Issues) — 3 of 5 truly concurrent calls succeeded past a state where only 1 slot remained, landing a user at 12 businesses.
- [x] `0012_storage_buckets.sql`'s policies reuse the existing `app.current_business_ids()`/`app.has_role()` helpers — no separate, unaudited authorization logic for Storage.
- [x] No N+1s introduced; no new hot-path queries missing an index (`business_signing_keys` lookup is by `business_id`, already indexed via its own scoping).
- [ ] **🔴 `business_signing_keys` INSERT (the actual production path in `api/keygen.py`) writes no `audit_log` row anywhere** — empirically confirmed against a live migrated DB (see Issues). This is the one mutation in the entire schema, as currently shipped, with zero audit trail.

### E. Performance
- [x] No O(n²)/unbounded loops. `runSql`'s per-call `psql` subprocess spawn is a deliberate, documented test-harness trade-off (no new npm dependency), not production code.

### F. Tests
- [x] New DB-level tests hit a real Postgres 16 instance end-to-end (no DB mocking) — traced and re-verified several assertions directly against the schema myself, independent of the test file's own claims.
- [x] `api/test_keygen.py` correctly separates pure-logic tests (KEK always injected explicitly) from the one `os.environ`-touching test (`test_reads_kek_from_env`); `api/test_keygen_handler.py` correctly mocks only the network transport (`urllib.request.urlopen`), not the business/validation logic.
- [ ] Minor: `tests/isolation.test.ts` has two `it(...)` blocks used purely as ordered setup steps ("seeds an item for bizA") with no `expect()` inside — works today because Vitest runs `it` blocks in file order within a `describe`, but reads as an assertion when skimming the file. `beforeAll`/a shared fixture helper would be clearer. 🟢.
- [ ] No direct, non-concurrent test exists for `INV_BUSINESS_LIMIT` itself (only discovered its race via my own ad hoc script — see Issues). 🟡, bundled into the TOCTOU finding below.

### G. Comments
- [x] Comments consistently explain *why*, especially the "flagged for architect confirmation" pattern used for every judgment call in this batch (`_keygen_core.py`'s nonce-column note, `0013`'s whitelist-of-10 note, `0015`'s USAGE-reversal note). No stale or restating-the-code comments found.
- [x] No unowned TODO/FIXME anywhere in this batch's files (checked via grep across `api/`, `src/app/api/businesses/`, `src/lib/errors.ts`, `tests/`, `supabase/migrations/001{0-5}*.sql`, `scripts/`, `.github/workflows/ci.yml`).
- [ ] **🟡 `_keygen_core.py`'s own docstring states the KEK is "hex-encoded" without ever noting that ADR-INV-003 §D4 explicitly specifies `base64(32B)` for the same env var** — see Issues.

### H. Dead Code
- [x] No unreachable branches, no commented-out blocks, no half-wired features. `api/keygen.py`'s handler class is Vercel's required shape, fully exercised by `test_keygen_handler.py`.

## Security Checklist

### 1. Auth
- [x] `route.ts` uses the existing cookie-session-based `createClient()` (RLS-aware, anon key) — no new auth mechanism introduced, no JWT re-implementation.
- [n/a] No login/refresh/logout code touched in this diff.
- [x] No credentials logged. `keygen.py`'s error paths and `_keygen_core.py` never log or echo key material (verified by reading every log/return/raise statement in both files).

### 2. Multi-Tenancy
- [x] `0012_storage_buckets.sql`'s policies scope by `(storage.foldername(name))[1]::uuid in (select app.current_business_ids())` — the same helper every other RLS policy in the project uses. Verified empirically via `storage-isolation.test.ts` (8/8 real cross-tenant assertions, reproduced locally).
- [x] `0011_create_business.sql`'s `create_business()` explicitly checks `auth.uid()`/profile existence itself (SECURITY DEFINER bypasses RLS, so this is the real guard) — matches the pattern every other `public.*` RPC in this project uses.
- [x] No new service-role client usage outside `api/keygen.py` (one of ADR-INV-001 §D5's closed paths) and the one narrowly-scoped `app.business_has_signing_key()` (owned by `service_role` specifically to cross `FORCE`, per Amendment C-2 — reviewed and empirically re-verified: `amendment-c.test.ts`'s last assertion proves `authenticated` still cannot call it directly).
- [x] No new table added in this batch lacking RLS/audit — confirmed by CI check (א)/(ד), both green against the fully-migrated DB.
- [⚠️] See 🔴 below: `business_signing_keys` writes are RLS-safe (FORCE + zero policies + `service_role`-only), but are **not audited** — a data-integrity/observability gap, not a tenant-isolation one.

### 3. RBAC
- [x] `0011_create_business.sql` is the only new mutation-granting RPC in this batch and enforces membership/limit/format checks before any write.
- [x] `revoke ... from public, anon` / `grant ... to authenticated` applied correctly on every new `public.*` function (`create_business`), verified via CI check (ו) passing against the live DB.
- [x] No default-allow branches found in any new permission check.
- [x] `INV_FORBIDDEN`/`INV_UNAUTHENTICATED` map to specific, non-generic error codes, not swallowed.

### 4. Agent Actions
- [n/a] This project has no Process Agents (per ADR-INV-001 Context, confirmed again in this batch — no new agent-adjacent code).

### 5. Secrets
- [x] No hardcoded API keys/secrets found (`sk-`, `eyJ`, long hex literals) in any file in scope — the only long hex-looking strings are test fixture data (`TEST_KEK = b"\x01" * 32`, explicitly commented "never a real secret, test-only") and CI placeholder env values (`ci-placeholder-anon-key` etc., clearly non-functional).
- [x] `SUPABASE_SERVICE_ROLE_KEY`/`SIGNING_MASTER_KEK_V1` are read only in `api/keygen.py` (a server-only Vercel Python function) — never imported into any client component.
- [x] `.env`/`.env.local` correctly excluded from git (verified `.gitignore` coverage was already established in F1/F2, unchanged here).
- [ ] **🟡 KEK encoding mismatch with the ADR** — `_keygen_core.py`'s `kek_from_env()` reads `SIGNING_MASTER_KEK_V1` as **hex**; ADR-INV-003 §D4 explicitly specifies `base64(32B)`. Not a leak, but a real production foot-gun and an undocumented deviation — see Issues.

### 6. Input Validation
- [x] `route.ts`'s `bodySchema` (`z.object(...)`) validates every field, including a 9-digit regex on `tax_id`, before any RPC call.
- [x] `keygen.py`'s `generate_and_store_signing_key()` validates all three required fields before touching the KEK or Supabase.
- [x] No `sql.raw`/string-concatenated SQL with user input anywhere in the new migrations (the one dynamic-SQL use, `app.enforce_audit()`'s `format(%I, %s)`, is migration-time-only against hardcoded table names, unchanged in this batch).
- [n/a] No file upload code in this batch's scope.

### 7. OWASP Quick Scan
- [n/a] XSS/SSRF — no HTML rendering or outbound-URL-from-user-input code in this batch's scope (the one `fetch` in `route.ts` targets a same-origin, hardcoded `/api/keygen` path, not a user-supplied URL).
- [x] IDOR — `create_business()`'s membership/ownership checks and the storage policies' `business_id`-path scoping were both empirically re-verified above.
- [x] Broken auth — no `publicProcedure`-equivalent found on any new mutation; `create_business` explicitly checks `auth.uid()` as its first statement.
- [ ] **Sensitive data exposure — 🟡, see Issues.** `route.ts:55` returns the RPC's raw `error.message` to the client unfiltered.

## Issues

### 🔴 Critical (Block merge)

1. **Signing-key creation (the actual `api/keygen.py` → `business_signing_keys` production path) writes zero `audit_log` rows anywhere**
   - Files: `invoicing-receipts/api/keygen.py` (the only place `business_signing_keys` is written outside test fixtures), `invoicing-receipts/supabase/migrations/0006_audit.sql:5,91` (the explicit, deliberate exclusion of `business_signing_keys` from the trigger-based audit mechanism), ADR-INV-001 §D11/schema section for `business_signing_keys` ("ללא audit trigger... אירועי מפתח דרך `log_event()`").
   - What I found: `business_signing_keys` is deliberately excluded from `app.audit_trigger()` (to avoid duplicating ciphertext into `audit_log`) — the ADR's stated design assumes `public.log_event()` (with a closed action list including `key_create`/`key_revoke`) covers this instead. I confirmed `public.log_event()` **does not exist anywhere in migrations 0001-0015** (only referenced as "pending" in a `0009_amendments.sql` comment), and `api/keygen.py`'s `_insert_signing_key()` makes exactly one Supabase call — a raw `POST .../business_signing_keys` via PostgREST — with no second call to any audit mechanism.
   - Empirical proof (not assumed): I stood up a fully-migrated throwaway DB, ran `create_business()` for a test user (3 audit_log rows, as expected), then inserted a `business_signing_keys` row as `service_role` with the same shape `api/keygen.py` produces. `select count(*) from audit_log` was identical (3) before and after — the key-creation event left no trace whatsoever.
   - Why this matters: CLAUDE.md invariant #2 is unconditional — "כל insert/update/delete על אובייקט עסקי כותב רשומה ל-audit_log... לא חורגים מזה גם ב-migrations." `business_signing_keys` is explicitly a Business-scoped table per ADR-INV-001 §D7, and its content is the cryptographic material that will legally sign every document this business ever issues — arguably the single most security-sensitive mutation in the whole schema. As shipped, there is no way to answer "when was this business's signing key created, and by what request" from the data at all.
   - How to fix: either (a) implement `public.log_event()` now (it is on the closed action-list already, `key_create` included, per ADR-INV-001 §D11) and have `api/keygen.py` call it in the same logical operation as the `business_signing_keys` insert (accepting that these are two separate HTTP calls to PostgREST, not one transaction — document that trade-off explicitly, the same way `route.ts`'s two-step `create_business`+keygen sequencing is already documented), or (b) escalate to the architect if `log_event()`'s implementation was intentionally deferred past B9 and confirm what covers this gap in the interim before this ships to a real business. Either way, this cannot land silently — it needs an explicit decision, not a follow-up ticket that might slip.

### 🟡 Important (Should fix)

1. **TOCTOU on the 10-business-per-user limit in `create_business()` — empirically reproduced, not theoretical**
   - File: `invoicing-receipts/supabase/migrations/0011_create_business.sql:46-50`.
   - What I found: `select count(*) into v_count from public.businesses where created_by = v_uid` takes no lock and runs under default READ COMMITTED — two-plus concurrent calls from the same user can all read the same pre-limit count before any of them commits its INSERT.
   - Empirical proof: I seeded one user with exactly 9 businesses, then fired 5 truly concurrent `create_business()` calls (separate `psql` OS processes, `&`/`wait` in bash) with distinct `tax_id`s. Result: **3 of the 5 succeeded** (only 1 should have, since the limit is 10) — the user ended up owning **12** businesses, 2 over the documented cap. 2 of the 5 correctly failed with `INV_BUSINESS_LIMIT`.
   - Why this matters: ADR-INV-001 §D10 documents this limit explicitly as "בלם abuse — בהיעדר INSERT policy אין בודק חיצוני" (the *only* backstop against unbounded business creation, since there's no INSERT policy to layer on top). It is trivially triggerable by a user double-clicking "create business" or opening the form in two tabs, not just an adversarial scenario.
   - How to fix: serialize per-user creation, e.g. `perform pg_advisory_xact_lock(hashtext(v_uid::text))` before the count check, or run the count+insert under `SERIALIZABLE` with retry-on-conflict at the call site. Also worth a direct (non-concurrent) test for `INV_BUSINESS_LIMIT` itself — none exists today; I only found this via my own ad hoc script, not the existing test suite.

2. **`route.ts:55` forwards the raw RPC `error.message` to the HTTP client instead of sanitizing server-side**
   - Files: `invoicing-receipts/src/app/api/businesses/route.ts:54-56`; contrast with `invoicing-receipts/src/lib/errors.ts` (`toUserMessage()`, which exists precisely to prevent this) and `invoicing-receipts/src/app/(app)/businesses/new/business-form.tsx:38` (which calls `toUserMessage()` **client-side**, after the fact).
   - What I found: `if (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }` — every current failure mode of `create_business()` happens to be a clean `INV_CODE: detail` string, so today's practical exposure is limited. But this is a server boundary returning **whatever Postgres/PostgREST hands back**, unfiltered — an unexpected error (a future bug, a constraint violation not wrapped in an `INV_*` raise, a connection-level failure, or any future extension of this RPC) would leak raw Postgres error text — potentially including column/constraint/schema names — directly over the wire to any client, not just the one first-party page that happens to call `toUserMessage()` afterward.
   - Why this matters: relying on a *specific frontend component* to sanitize is not a server-side control — any other caller of this API (a different page, a future mobile client, a direct `curl`) gets the raw message with no filtering at all. This is exactly the kind of "sensitive data exposure" gap the security checklist's OWASP section targets.
   - How to fix: call `toUserMessage(error.message)` (or an equivalent explicit allow-list) inside `route.ts` itself before constructing the response — sanitize at the boundary that actually talks to the network, not downstream in one specific UI component.

3. **KEK encoding mismatch between the ADR and the implementation, undocumented**
   - Files: `invoicing-receipts/api/_keygen_core.py:142-155` (`kek_from_env()`: `kek = bytes.fromhex(raw)`); `invoicing-receipts/docs/adr/003-pdf-signing-storage.md:106` (`KEK = base64(32B) ב-Vercel env var SIGNING_MASTER_KEK_V1`).
   - What I found: the ADR that this exact function's own docstring cites (`ADR-INV-003 §D4`) specifies base64 for the KEK env var; the implementation decodes hex instead, and both `test_keygen.py`/`test_keygen_handler.py` set up their fixtures consistently in hex — so the test suite is internally consistent but doesn't catch the divergence from the ADR text. The module's own header comment states "hex-encoded" as if that were simply the spec, with no note that it differs from what the ADR says.
   - Why this matters: whoever generates the real production KEK (the founder, per ADR-INV-003 §D4's own operational note about backing it up) will most likely follow the ADR text literally (e.g. `openssl rand -base64 32`) and set a base64 string in Vercel — which `bytes.fromhex()` will reject outright (`ValueError: non-hexadecimal number found`), surfaced as a generic 500 with no signing key ever created, for every business, until someone traces it back to this exact line. This is a real operational landmine, not just a documentation nit.
   - How to fix: either change the implementation to decode base64 (matching the ADR verbatim), or get explicit architect sign-off to update the ADR text to hex and note the deviation in both places. Either is fine — leaving it silently inconsistent is not.

### 🟢 Nits

1. **`tests/isolation.test.ts`'s two setup-only `it(...)` blocks** (e.g. "seeds an item for bizA") have no `expect()` and exist purely for Vitest's guaranteed in-file ordering. Consider `beforeAll`/a shared helper instead — reads as a real assertion on a skim.
2. **`0010_addendum_fixes.sql` at 679 lines** is the largest file born in this batch. Understandable given the "never edit a committed migration" constraint (it restates several full function bodies verbatim plus small diffs) and it is clearly sectioned — but worth keeping an eye on: a future corrective migration that bundles 4+ independent fixes the way this one does (A′-1/2/3/4 plus the independent `compute_line` bug) is harder to `git blame`/revert piecemeal than one fix per migration where the schedule allows it.
3. **No explicit zeroization of RSA private-key material during generation** in `_keygen_core.py` (the `private_key`/`private_key_der` locals live until GC). The module's own docstring correctly scopes "sign-only, memory-zeroed" as `api/sign.py`'s job (out of this batch), and Python bytes objects can't be reliably zeroed anyway — noted for completeness, not a real gap given the language's constraints.
4. **Untyped Supabase clients project-wide** (no `Database` generic anywhere) mean `route.ts`'s `business` value is implicitly `any`. Pre-existing from F1/F2, not introduced here, and low-risk in this specific call site (trusted, just-inserted row) — worth a follow-up once generated types exist.

## הערכה כללית

הבסיס הטכני של ה-batch הזה יוצא דופן באיכות: כל טענת verification בהיסטוריית ה-commits אומתה כאן מחדש ועברה, מ-scratch, ללא יוצא מן הכלל (roundtrip מלא, 8/8 בדיקות CI, 122/122 Vitest, 18/18 pytest) — וה-crypto ב-`_keygen_core.py` מדויק לכל דרישות ה-ADR שבדקתי (RSA-3072, שדות X.509, envelope encryption עם nonce ייחודי לכל פעולה, אין fallback מסוכן ל-KEK, אין דליפת חומר מפתח). זה בדיוק סוג הקוד שראוי לתחזוקה ל-3 שנים. ה-❌ נובע מממצא אחד קונקרטי וקריטי — יצירת מפתח חתימה (ה-mutation הרגיש ביותר במערכת) לא משאירה שום עקבה ב-`audit_log`, כי `public.log_event()` שה-ADR מסתמך עליו לא נבנה עדיין — בדיוק הפרה מהסוג שה-review הזה קיים כדי לתפוס. שני ה-🟡 (TOCTOU אמיתי על מגבלת 10 העסקים, שאומת אמפירית ולא רק נקרא בקוד; ודליפת שגיאת Postgres גולמית ללקוח ב-boundary) ראויים לתיקון לפני merge אבל אינם באותה רמת חומרה. ממליץ להחזיר ל-implementer עם שלושת הממצאים האלה, ולא לדלג על ה-🔴 גם אם התיקון (`log_event()`) חורג מ-scope המקורי של B9 — עדיף להכריע את זה עכשיו מאשר לגלות שאין audit trail על מפתחות חתימה אחרי שהעסק הראשון האמיתי כבר משתמש במערכת.

---
