# Code Quality Review: Round 7a — Bootstrap Dev Environment

**תאריך:** 2026-05-07 17:40
**Base SHA:** 4bec9bb
**Head SHA:** 5ed0037
**Spec:** `vault/Engineering/2026-05-07-1700-bootstrap-dev-env-7a-plan.md`
**Spec-reviewer:** ✅ (round #1) — `vault/Reviews/spec/2026-05-07-1735-round-7a-bootstrap.md`
**סבב code-quality-reviewer:** #1
**Security checklist:** הופעל — ה-diff נוגע ב-multi-tenancy seam (`with-tenant.ts`), DB client construction, tRPC context, env hygiene, Supabase config, ו-MCP boundary.

## תוצאה: ✅ approved

**Severity counts:** 🔴 0 | 🟡 0 | 🟢 3

## Strengths

- **`packages/db/src/with-tenant.ts:46`** — ה-`SET LOCAL app.current_tenant = ${tenantId}` משתמש ב-Drizzle `sql` template tag עם binding כפרמטר, לא string interpolation. ה-test ב-`with-tenant.test.ts:85-88` מאמת בדיוק את הנקודה הזו ("`expect(setLocal?.params).toContain('tenant-abc')`" + "`expect(setLocal?.sql).not.toContain('tenant-abc')`") — זו הגנה ב-2 שכבות (קוד + test), בדיוק מה שצריך לנקודת multi-tenant enforcement.
- **`packages/db/src/with-tenant.ts:38-40`** — rejection של tenantId ריק/whitespace עם הודעת שגיאה ברורה. defence-in-depth מוצלח: גם אם upstream שכח לאמת, הקריאה תיכשל לפני שתישלח SQL בלי tenant scope.
- **`packages/api/src/context.ts:12-16`** — ה-context shape מכריזה במפורש על שלושת ה-slots `userId | tenantId | db` כ-`null` ב-7a, וה-comment מסביר מה יקרה ב-7b. אין דרך בטעות לצרוך אותם כ-authenticated — ה-types יחייבו narrowing/null-check.
- **`mcp/server/src/index.ts:24`** — `capabilities: {}` ריק במפורש + ה-test ב-`index.test.ts:32-33` מאמת `expect(capabilities).toEqual({})`. אין tools רשומים, אין surface ל-leak. הגישה הנכונה לבוט שעדיין לא קיים.
- **`supabase/config.toml`** — כל ה-secrets (Twilio, OpenAI, OAuth Apple, S3, edge runtime) משתמשים ב-`env(...)` substitution. אין credential אחד embedded.

## Quality Checklist

### A. Naming & Structure
- [x] שמות מתארים תפקיד (`createMcpServer`, `getServerCaller`, `withTenant`, `createTRPCContext`).
- [x] גודל קבצים סביר — הגדול ביותר מבין הקבצים החדשים שאינם config/lockfile/Supabase TOML הוא `with-tenant.test.ts` (100 שורות).
- [x] אחריות ברורה לכל מודול (db client/tenant helper/schema barrel נפרדים; tRPC context/trpc init/routers נפרדים).
- [x] file structure תואם לתוכנית ב-spec.

### B. Type Safety
- [x] שני `any` מוצדקים בלבד — שניהם ב-`packages/db/src/with-tenant.ts:11,34` (Drizzle generics resolved at call site) עם `biome-ignore` comment שמסביר. Drizzle 0.36 דורש את ה-pattern הזה כש-schema רוקן (Round 7a).
- [x] שני `any` נוספים ב-`with-tenant.test.ts:71,97` — לטסט fake; מסומנים ב-`biome-ignore`.
- [x] אין `as Foo` casts לא מתועדים. `as const` מותר ובשימוש כשנכון (`'ok' as const` ב-`health.ts:14`).
- [x] tRPC procedures עוברות דרך `t.procedure` (אין boundary ב-7a בלי input — `health.check` הוא query בלי input, וזה תקין).
- [x] `noUncheckedIndexedAccess: true` ב-`tsconfig.base.json` — נוקשה.

### C. Error Handling
- [x] אין `catch` ריק / מבולע.
- [x] ה-`createDb` זורק כשconnectionString חסר עם הודעה ברורה (`client.ts:28`).
- [x] ה-`withTenant` זורק כשtenantId ריק עם הודעה ברורה (`with-tenant.ts:39`).
- [x] ה-MCP entry point (`mcp/server/src/index.ts:56-61`) תופס שגיאות ב-main, כותב ל-stderr ויוצא עם exit code 1 — actionable.

### D. Database Queries
- [x] Drizzle בשימוש דרך ה-`sql` template tag — parameterized.
- [x] N+1 — N/A ב-7a (אין queries אמיתיים).
- [x] אין `service-role` client בקוד — `createDb` מקבל connection string ולא מקודד service-role.
- [x] transaction-mode pooling: `prepare: false` נכון ב-`client.ts:33`.

### E. Performance
- N/A ב-7a — אין נתיב חם.

### F. Tests
- [x] `withTenant` — 2 cases: happy path (tx + SET LOCAL + parameterized) ו-rejection של empty tenantId. שניהם בודקים behavior, לא implementation. ה-flatten helper הוא assertion על SQL contract, לא על internals.
- [x] `health.check` — בודק status + ISO timestamp + Date.parse round-trip.
- [x] `mcp` initialize handshake — בודק שה-server identity וה-empty capabilities מועברים. גם בודק שלא הוסיפו capabilities ב-future ללא registering tools (regression guard).
- [x] tests מאמתים behavior. אין mock-ים שמסתירים integration bugs.
- 🟢 ה-Playwright "1+1=2" placeholder ב-`e2e/smoke.spec.ts` הוא פשרה מודעת לדרישת spec (`pnpm e2e` exits 0). מקובל; ה-spec-reviewer אישר.

### G. Comments
- [x] ה-comments בקוד הזה מסבירים WHY (ADR refs, future-proofing, edge cases) — לא מתארים את ה-WHAT.
- [x] אין TODO/FIXME ללא בעלים.
- [x] אין JSDoc ריק.

### H. Dead Code / Half-Implemented
- [x] ה-`apps/web/src/lib/trpc/client.ts` מודה במפורש ב-comment שהוא לא בשימוש ב-7a ושה-Provider יבוא ב-7b. זה לא dead code — זו entry-point preparation מתועדת.
- [x] `packages/core/src/index.ts` placeholder ריק עם comment ברור.
- [x] schema barrel ריק עם comment ברור.
- [x] אין `if (false)` או commented-out blocks.

## Security Checklist

### 1. Auth (ADR 005)
- N/A — אין קוד auth ב-7a. ה-`TRPCContext.userId` כ-`null` הוא במפורש "לא authenticated" — לא הסתכמה כברירת מחדל מסוכנת.

### 2. Multi-Tenancy (ADR 002)
- [x] `withTenant` פותח transaction לפני שמריץ את ה-`fn` של ה-caller (`with-tenant.ts:42`).
- [x] `SET LOCAL app.current_tenant = ${tenantId}` נשלח **לפני** ה-`fn` (`with-tenant.ts:46-47`) — ה-RLS policy תראה את ה-GUC כש-fn ירוץ.
- [x] tenantId הוא parameter, לא string interpolation — ה-test (`with-tenant.test.ts:85-88`) מאמת.
- [x] tenantId ריק נדחה עם error (`with-tenant.ts:38-40`).
- [x] אין escape hatch — אין overload ל-`withTenant(null, ...)` או דומה.
- [x] אין service-role client בקוד.
- [x] ה-`Db` type מיוצא, אבל `createDb` דורש connection string מפורש (לא singleton אוטומטי) — בקרה עוברת ל-caller, אבל אין סיכון פעיל ב-7a.

### 3. RBAC (ADR 005)
- N/A — אין mutation procedures ב-7a. `health.check` הוא query בלי side effects שמחזיר `{status: 'ok', timestamp}` בלבד.

### 4. Agent Actions (ADR 006)
- [x] MCP server לא חושף tools ב-7a — `capabilities: {}` במפורש. ה-test מאמת זאת כ-regression guard.
- [x] אין `audit_log` בקוד עדיין; אין mutations שצריכים אותו ב-7a. הציפייה: 7b+ יוסיף `withAudit` לפני שיגיעו tools.

### 5. Secrets
- [x] אין API key hard-coded — חיפוש regex `(sk-|eyJ|password=)` החזיר רק `pnpm-lock.yaml` (false-positive: integrity hashes; אין credentials בלוקפיל).
- [x] אין secret ב-log/error message — הודעות השגיאה מתייחסות לשמות פרמטרים בלבד (`'createDb: connectionString is required'`, `'withTenant: tenantId is required and must be non-empty'`).
- [x] `.env` ב-`.gitignore` (`.gitignore:13-15`), `!.env.example` exception ב-`.gitignore:16` — הקבצים tracked עם placeholders ריקים בלבד.
- [x] `.env.example` ו-`apps/web/.env.example` — כל הערכים ריקים אחרי `=`. אין connection string אמיתי, אין project URL אמיתי, אין JWT.
- [x] `supabase/config.toml` — כל secrets-fields משתמשים ב-`env(VAR_NAME)` substitution. ה-`project_id = "super-meshine"` הוא local-dev identifier בלבד, לא סודי.
- [x] `SUPABASE_SERVICE_ROLE_KEY` מופיע רק ב-`.env.example` (placeholder). אין import של service-role בקוד.
- [x] `ANTHROPIC_API_KEY` — אותו דבר.

### 6. Input Validation
- [x] `health.check` הוא query בלי input — אין surface לאמת.
- [x] `withTenant` מאמת tenantId (non-empty) לפני בנייה של SQL.
- [x] SQL — Drizzle `sql` template tag בלבד, אין string concat.
- [x] אין `fetch` חיצוני, אין command execution, אין file uploads ב-7a.

### 7. OWASP Quick Scan
- [x] **XSS** — ה-page Server Component משתמש ב-React rendering בלבד; אין `dangerouslySetInnerHTML`.
- [x] **SSRF** — אין fetch ל-URLs מ-user input.
- [x] **IDOR** — N/A (אין resource endpoints).
- [x] **Broken auth** — ה-`publicProcedure` בשימוש על `health.check` בלבד, שזו liveness probe ללא side effects. תקין.
- [x] **Sensitive data exposure** — `health.check` מחזיר `{status: 'ok', timestamp: ISO}`. אין flow שחושף DB rows.
- [x] **Logging** — `mcp/server/src/index.ts:42-45,57-59` כותב signal/fatal ל-stderr; אין credentials בלוגים.
- [x] **Build/runtime env leak** — `next.config.ts` לא מגדיר env passthrough; `turbo.json:9` מגביל את ה-env של build ל-`DATABASE_URL` + `NEXT_PUBLIC_*` — נכון (לא חושף service-role לבילד).

## Issues

### 🔴 Critical (Block merge)
אין.

### 🟡 Important (Should fix)
אין.

### 🟢 Nits

1. **`apps/web/src/lib/trpc/client.ts:18` — `unknown` במקום `Record<string, unknown>` ב-generic השני**
   - הקוד משתמש ב-`CreateTRPCReact<AppRouter, unknown>` כדי להימנע מ-TS2742. זה תקין אבל מקוצרת. אם ה-tRPC docs ממליצים על `Record<string, unknown>` או על TRPCClientError shape, אפשר ליישר ב-7b. לא חוסם.

2. **`packages/api/src/context.ts:26` — `_opts?: { req?: RequestLike }`**
   - הפרמטר לא בשימוש ב-7a (רק ה-shape שמור ל-7b). שם `_opts` תקין לקונבנציית "intentionally unused", אבל בלי הקוטב הזה יהיה אפשר אולי `// @ts-expect-error 7b will use this`. סטיילי בלבד.

3. **`packages/db/src/with-tenant.ts:11,34` — שני `any` עם `biome-ignore`**
   - מוצדק (Drizzle generics עם schema ריק); ה-comment מסביר. ב-7b כש-schema יתמלא אפשר להחליף ל-generic מפורש כמו `withTenant<T, S extends Record<string, unknown>>(db: PostgresJsDatabase<S>, ...)`. לא חוסם — Round 7b refactor.

## ⚠️ Judgment-Needed
אין.

## הערכה כללית

ה-diff נוגע במספר security-relevant zones (ה-multi-tenant seam, DB client, tRPC context, env hygiene, Supabase config, MCP boundary) — והוא מטפל בכולם נכון. ה-`withTenant` מבוצע במלואו בצורה בטוחה: parameterized SQL, transaction, rejection של empty tenantId, ואפילו test שמאמת את ה-binding-vs-interpolation contract. ה-context shape מכריזה במפורש על ה-3 שדות כ-`null` ב-7a כך שאי אפשר לצרוך אותם בטעות כ-authenticated. ה-MCP server לא חושף capabilities. ה-`.env.example` files ריקים, `.gitignore` נכון, ו-Supabase config משתמש ב-`env(...)` substitution לכל הסודות. Quality wise — naming ברור, error handling actionable, types מהודקים (שני `any` מוצדקים ומתועדים בלבד), אין dead code ולא features חצי-מיושמות. שלושת ה-Nits הם נקודות לטווח ארוך, לא חוסמים. ✅ Approved.

---
