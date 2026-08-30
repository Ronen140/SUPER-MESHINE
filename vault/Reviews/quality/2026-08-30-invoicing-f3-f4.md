# Code Quality Review: Invoicing & Receipts — F3-F4 (Business Creation Form + Business Switcher)

**תאריך:** 2026-08-30 16:20
**Base SHA:** `ae24c22` (F1-F2, last commit already quality-reviewed and accepted)
**Head SHA:** `f0ea0a5` (current HEAD)
**Scope note:** per the CEO's explicit instruction, the final on-disk state was reviewed, not individual commit titles — this includes `d560bf0` (the actual origin of `business-form.tsx`, `page.tsx`, `dropdown-menu.tsx` despite its "storage isolation suite" title), `2381657`, `cd88b62`, `543d5cd`, `6809463`, `bd04cbe`. Batch-3 backend work (`0011`-`0017`, `create_business()`/keygen/audit-log) already went through its own dedicated quality review (`quality/2026-08-30-invoicing-phase0-batch3.md` + the pending `0017` fix) and is **out of scope here** — this review covers only the files listed in the task brief (F3 form, F4 switcher, and the 4 F1-F2 error-handling fixes).
**Spec:** `vault/Engineering/invoicing-phase-0-plan.md` (Subtask F3, F4), `invoicing-receipts/docs/adr/001-data-model-and-rls.md` §D3.1/§D10, `vault/Discovery/2026-08-30-invoicing-ui-design-research.md`
**Spec-reviewer:** ✅ (round #2 effectively — round #1 found one gap [address-field over-build], fixed in `bd04cbe`; `vault/Reviews/spec/2026-08-30-invoicing-f3-f4.md`)
**סבב code-quality-reviewer:** #1 (first time F3/F4 goes through this gate — confirmed via `vault/Engineering/invoicing-phase-0-acceptance.md`, "Process gaps" #1)
**Security checklist:** הופעל — ה-diff נוגע ב-`tenant`-adjacent ownership check (`business_id` via RLS), cookie/session write (`active_business_id`), ותיקוני auth-error-handling (login/signup/logout)

## תוצאה: ✅ approved

**Severity counts:** 🔴 0 | 🟡 5 | 🟢 1

**בדיקות שהורצו (כולן ירוקות, `invoicing-receipts/`):**
- `pnpm typecheck` → exit 0, `tsc --noEmit` — no output, no errors.
- `pnpm lint` → `biome lint .` — `Checked 73 files in 40ms. No fixes applied.`
- `pnpm test` → `vitest run` — `Test Files 26 passed (26)`, `Tests 126 passed (126)`.
- `pnpm build` → `next build` — `✓ Compiled successfully`, `✓ Generating static pages (8/8)`. `/businesses/new` is `ƒ` (dynamic, correct — reads cookies via the `(app)` layout), first-load JS 151 kB (matches the spec-reviewer's noted post-address-field-removal drop from 219 kB).

## Strengths

- **IDOR defense done right, and tested for it** — `src/app/(app)/businesses/actions.ts:20-29` re-verifies ownership via an RLS-scoped `SELECT` before ever writing the cookie, relying on `businesses_read`'s `id in (select app.current_business_ids())` policy (confirmed directly in `supabase/migrations/0005_rls_policies.sql:55-56`) rather than trusting the client-supplied `businessId`. All three outcomes (not-a-member, query error, real owner) have dedicated tests in `actions.test.ts:28-59` — including the exact "not mine" case the security checklist asks for.
- **Stale/foreign cookie handling is genuinely tested, not just asserted** — `get-active-business.ts:25-27` explicitly treats a cookie pointing at a business the user is no longer a member of as equivalent to "no cookie," with a dedicated test (`get-active-business.test.ts:43-51`) naming exactly this scenario. This directly answers the task brief's item #2.
- **Cookie hygiene** — `actions.ts:32-38`: `httpOnly: true`, `sameSite: "lax"`, `secure` gated on `NODE_ENV === "production"` (correct pattern — avoids breaking `secure` cookies over plain HTTP in local dev), `path: "/"`. Never read by client JS (confirmed: `constants.ts:1-6` documents this by design, and a grep for `document.cookie`/reading `active_business_id` client-side returns nothing).
- **Real, non-tautological tests throughout** — `business-form.test.tsx` covers the golden path, an `INV_TAX_ID_EXISTS`/`INV_BUSINESS_LIMIT` mapping, the keygen-retry banner, and a genuine network-throw case (`fetchMock.mockRejectedValue(new TypeError(...))`), all asserting on rendered text/`role="alert"` content — not on internal call details. Same discipline in `business-switcher.test.tsx` (double-submit-adjacent case: "does not call the switch action when re-selecting the already-active business").
- **The 4 F1-F2 🟡 fixes are real, not cosmetic** — `login-form.tsx`, `signup-form.tsx`, `logout-button.tsx` now wrap the Supabase call in `try/catch` with a comment citing the exact prior review issue; `signup-form.tsx:39-49` now checks `data.session` and shows a confirm-email message instead of bounce-looping through the middleware; `middleware.ts:22-24,49-51` now logs both fail-open paths. Each has a dedicated regression test reproducing the original failure mode (e.g. `signup-form.test.tsx`'s "succeeds without a session" test).
- **`getUserBusinesses`/`getActiveBusinessContext` correctly distinguish Next's own control-flow signals from real failures** — the *intent* here (never swallow `redirect()`/`notFound()`/`DYNAMIC_SERVER_USAGE` inside a fail-to-`[]` catch) is exactly right and is the kind of subtle Next App Router correctness issue that's easy to get wrong; see Issues for one concrete gap in the current implementation of that intent.

## Quality Checklist

### A. Naming & Structure
- [x] Names are descriptive throughout (`getActiveBusinessContext`, `isNextControlFlowError`, `setActiveBusinessId`, `businessLabel`) — clear from the name alone what each does.
- [x] File sizes reasonable — largest new file is `business-form.tsx` at 246 lines; no new file crosses 400.
- [x] Clear single responsibility per file: `constants.ts` (cookie name only), `get-user-businesses.ts` (RLS-scoped read), `get-active-business.ts` (cookie-vs-list reconciliation), `actions.ts` (the one write path) — matches the predicted F3/F4 file layout in the plan.
- [ ] 🟡 See Issue #1 — the switcher (F4) and the creation form (F3) are structurally well separated but **not wired together**: nothing in the create-business flow calls the switcher's own `setActiveBusinessId`.

### B. Type Safety
- [x] No `any` anywhere in the reviewed files (full grep across all 10 files — zero hits outside legitimate `import type * as React`/`import * as DropdownMenuPrimitive` namespace imports).
- [x] `as const` usage is fine (`business-form.tsx:16,21`, entity-type option literals).
- [ ] 🟡 See Issue #4 — `payload as {...}` casts on the raw fetch response in `business-form.tsx:35,37,83` are not backed by any zod `safeParse`, unlike every other boundary in this project (`business.ts`'s own form schema, `route.ts`'s `bodySchema`).
- [ ] 🟡 See Issue #4 (same root cause) — `get-user-businesses.ts`'s `Promise<BusinessListItem[]>` return type is an unenforced assumption about the Supabase client's response shape (no `Database` generic is passed to `createServerClient` anywhere in `src/lib/supabase/server.ts`, so `.select(...)`'s `data` is implicitly `any`).
- [x] `ActiveBusinessContext`/`BusinessListItem` types are explicit and shared correctly across `get-user-businesses.ts` → `get-active-business.ts` → `business-switcher.tsx` → `sidebar.tsx`.

### C. Error Handling
- [x] All 3 auth forms + the business form now wrap their async call in `try/catch` and map to a Hebrew message — no silent failures on network/env-throw paths (verified with real rejected-promise tests in each).
- [x] `get-user-businesses.ts:32-35` logs the real Supabase error before failing open — not a silent swallow.
- [ ] 🟡 See Issue #3 — `isNextControlFlowError`'s prefix list includes a value (`NEXT_NOT_FOUND`) that does not match what the installed Next.js version actually throws, meaning the "never swallow Next's own signals" guarantee this function exists to provide is not fully correct today, not just fragile against future versions.
- [x] `setActiveBusinessId` returns a typed `{ ok: boolean; error?: string }` result object rather than throwing across the server-action boundary — appropriate given the project has no tRPC layer (documented architecture choice, not a gap).

### D. Database Queries
- [x] All new/changed queries go through the RLS-scoped `createClient()` (anon key + user cookies) — no `service_role` usage anywhere in this diff (grep confirmed).
- [x] No N+1 — `getUserBusinesses`/`getActiveBusinessContext` each run exactly one query per request, and are wrapped in React's `cache()` so two Server Components sharing a request (`layout.tsx` + `page.tsx`) issue it only once — correctly documented as the reason for the double `cache()` wrap.
- [x] Field selection is scoped (`id, legal_name, display_name, entity_type, accent_color`), not `select *` — no over-fetching of sensitive columns (`tax_id`, `created_by`, etc. are not returned to the switcher).
- [x] No transaction needed here — this diff has no multi-statement mutation; the one write (`cookieStore.set`) isn't a DB write at all.

### E. Performance
- [x] No loops over user input, no unbounded queries. Switcher renders `businesses.map(...)` over an already-capped list (max 10 per `INV_BUSINESS_LIMIT`).
- [x] `router.refresh()` is the correct mechanism for "switch without leaking state" — re-runs Server Components, doesn't do a full page reload.

### F. Tests
- [x] 126/126 green, covering the golden path, all mapped `INV_*` errors relevant to this scope, the 0/1/2+ business states, and the stale-cookie fallback.
- [x] Tests assert on rendered output (`toHaveTextContent`, `toBeInTheDocument`, `getByRole`) — not on internal implementation details.
- [x] Mocks are scoped correctly — `business-switcher.test.tsx` mocks `setActiveBusinessId` (the actual server boundary) and asserts the component's *behavior* around it, not the server action's internals.
- [ ] 🟢 No test exists for the F3→F4 integration gap in Issue #1 (unsurprising — it's a gap, not a covered behavior) — flagging so the fix in the next round comes with a regression test.

### G. Comments
- [x] Comments consistently explain *why*, not *what* — e.g. `next-control-flow-error.ts:1-12`, `get-user-businesses.ts:39-42`, `actions.ts:7-16` all reference the specific ADR section or prior review finding driving the design.
- [x] No orphaned TODO/FIXME in any reviewed file (grep confirmed).

### H. Dead Code / Half-Implemented
- [ ] 🟡 See Issue #1 — this is exactly the "feature feels half-connected" pattern: F4's `setActiveBusinessId` exists, is well-tested, and is never called from F3's own creation flow, which is the one place a new business is most likely to need to *become* the active one.
- [x] No unreachable branches, no commented-out code in any reviewed file.

## Security Checklist

### 1. Auth
- n/a direct — no JWT/session-issuing code in this diff's scope; the 4 F1-F2 fixes only add `try/catch`/logging around existing calls, they don't change how tokens are issued/stored (already reviewed and accepted in `quality/2026-08-30-invoicing-f1-f2.md`, including the documented ⚠️ on non-`HttpOnly` Supabase session cookies — unchanged here, not re-litigated).
- [x] Logout still calls `supabase.auth.signOut()` server-invalidating the session (unchanged logic, only wrapped in `try/finally` now — `logout-button.tsx:19-37`).
- [x] No credentials logged anywhere in the diff (grep on `console.` across all 10 files — the only `console.error` calls are the two new middleware ones and `get-user-businesses.ts`'s Supabase-error log, none logging secrets/tokens).

### 2. Multi-Tenancy
- [x] Every new query against a business-scoped table (`businesses`) relies on RLS (`businesses_read`, `app.current_business_ids()`), matching this project's documented "RLS is the only enforcement boundary" pattern (ADR-INV-001 — no app-layer `tenant_id` filter exists anywhere in this codebase by design, unlike the main ERP's `SET LOCAL app.current_tenant` pattern from ADR-002/005; the two projects use different, each-independently-approved architectures).
- n/a `SET LOCAL app.current_tenant` — not this project's pattern (see above); the equivalent mechanism (`app.current_business_ids()` reading `auth.uid()` via `SECURITY DEFINER`) was already verified in the B5/B6 quality reviews.
- [x] No cross-tenant query anywhere in this diff (grep for `service_role`/unscoped queries — zero hits).
- [x] No `service_role` client used in any of the 10 reviewed files — confirmed by direct read of every file, all use `createClient()` from `src/lib/supabase/server.ts` (anon key).
- n/a new tables — this diff adds no schema.

### 3. RBAC
- n/a role-based permission check — the operation gated here is "ownership of a specific business," not a role within one; correctly enforced by `businesses_read`'s RLS, not a role table lookup. No project role/permission table is touched in this scope.
- [x] `setActiveBusinessId` fails closed (`{ ok: false }`) on both "no row" and "query error," never optimistically trusts the client's `businessId`.

### 4. Agent Actions
- n/a — this project has no Process Agents (documented repeatedly across every prior review of this codebase).

### 5. Secrets
- [x] No hard-coded keys/tokens in any reviewed file (grep for `sk-`/`eyJ`/long hex strings — zero hits).
- [x] No secret in any log statement (`console.error` calls only log Supabase's own `error.message`/generic strings, never tokens/cookies).
- n/a Sentry — not wired into this project yet (unchanged from F1-F2's finding).
- [x] `SUPABASE_SERVICE_ROLE_KEY` not referenced by any of the 10 files in this diff.

### 6. Input Validation
- [x] `businessSchema` (`schemas/business.ts`) validates the create-business form client-side, mirroring `route.ts`'s server-side `bodySchema` (already-reviewed file, unchanged here).
- [ ] 🟢 See Nit #1 — `setActiveBusinessId(businessId: string)` has no shape validation (e.g. `z.string().uuid()`) before use. Not exploitable (RLS backstops any malformed/foreign value as a clean "0 rows" rejection, and it's a parametrized Supabase query, not string-built SQL) — but it's a step below the zod-at-every-boundary discipline the rest of the project follows.
- [ ] 🟡 See Issue #4 — the `POST /api/businesses` fetch *response* in `business-form.tsx` is not zod-validated before its fields are used (contrast with the *request* body, which is fully zod-validated both client- and server-side).
- n/a file upload — none in this diff.
- n/a SQL string concatenation — all queries go through Supabase's parametrized query builder or RPC parameter binding.

### 7. OWASP Quick Scan
- [x] **XSS:** no `dangerouslySetInnerHTML` in any reviewed file; all text goes through React's default escaping, including business names/legal names sourced from user input elsewhere.
- n/a **SSRF:** no user-controlled URL passed to `fetch` (the two `fetch` calls in `business-form.tsx` hit fixed, relative, same-origin paths).
- [x] **IDOR:** this is the core focus of the review and it's implemented correctly — see Strengths. `setActiveBusinessId` cannot be used to pin a foreign/nonexistent business id.
- [x] **Broken auth:** no `publicProcedure`-equivalent skip; an unauthenticated caller hitting `setActiveBusinessId` runs the query as `anon`, which `businesses_read`'s `to authenticated` clause rejects outright (0 rows → `ok:false`).
- [x] **Sensitive data exposure:** `getUserBusinesses`'s column list excludes `tax_id`, `created_by`, and every other business's data is excluded by RLS before it ever reaches the app.

## Issues

### 🟡 Important (Should fix)

1. **Creating a business does not make it the active one — F3 and F4 are functionally disconnected**
   - Files: `invoicing-receipts/src/app/(app)/businesses/new/business-form.tsx:94` (golden path) and `:121` (keygen-retry path); root cause confirmed against `invoicing-receipts/src/lib/businesses/get-active-business.ts:25-27`.
   - מה: after a successful `POST /api/businesses` (and after a successful keygen retry), the form calls `router.push("/")` / `router.refresh()` but never calls `setActiveBusinessId(business.id)`. `getActiveBusinessContext` resolves the active business from the `active_business_id` cookie first, falling back to `businesses[0]` only when the cookie is absent/stale. For a user's **first** business this happens to work (no cookie exists yet, and there's only one business to fall back to) — but for anyone creating a **second or later** business, the cookie still points at whatever was active before, so the home page (`src/app/(app)/page.tsx:6,28`) shows "העסק הפעיל: <the old business>" immediately after the user just created a new one.
   - למה זה חשוב: this is the exact multi-business flow F3+F4 exist to support (the plan explicitly frames F3 as "אפשר להוסיף עסקים נוספים בכל שלב"), and it silently lands the user in the wrong business context with no error or indication anything is off. It's not exploitable as a security/data-integrity issue *today* because Phase 0 has no document-creation UI yet ("עדיין אין כאן מסמכים" on the dashboard) — but the moment Phase 1 wires up document creation, this becomes a real risk of a user believing they're working in their newly-created business while actually still scoped to the old one.
   - איך לתקן: call `setActiveBusinessId(business.id)` (already exists, already tested, already wired into `business-switcher.tsx`) right before/instead of `router.push("/")` in both the golden path and the keygen-retry path — and add a regression test asserting the cookie/active-business changes to the new business's id after creation.

2. **`DropdownMenuTrigger`'s `aria-label` hides the active business name from screen reader users**
   - File: `invoicing-receipts/src/components/layout/business-switcher.tsx:97-109`
   - מה: the trigger `<button aria-label="בחירת עסק פעיל" ...>` also visually renders the active business's name as its text content (`{businessLabel(active)}`, line 105-107). Per the accessible-name computation spec, an explicit `aria-label` **overrides** the element's text content entirely for assistive tech — so a screen reader announces only "בחירת עסק פעיל, button" and never the actual active business name that a sighted user sees right there on the button.
   - למה זה חשוב: this is a real, measurable accessibility regression specific to the new dropdown component the task asked to scrutinize — screen reader users get strictly less information than sighted users about which business is currently active, in exactly the control designed to communicate that.
   - איך לתקן: either drop the static `aria-label` and let the button's own text content (business name + visually-hidden "לבחירת עסק אחר" suffix, or similar) serve as the accessible name, or make the label dynamic: `` aria-label={`עסק פעיל: ${businessLabel(active)}. לחיצה לבחירת עסק אחר.`} ``.

3. **`isNextControlFlowError`'s `NEXT_NOT_FOUND` prefix does not match the installed Next.js version's actual digest**
   - File: `invoicing-receipts/src/lib/next-control-flow-error.ts:13`
   - מה: verified directly against `node_modules/next` (installed version `15.5.24`): `grep -rl "NEXT_NOT_FOUND" node_modules/next/dist/` returns **zero matches** anywhere in the framework. `notFound()` in this Next version actually throws with digest `NEXT_HTTP_ERROR_FALLBACK;404` (confirmed in `node_modules/next/dist/client/components/http-access-fallback/http-access-fallback.js:41`, also shared by the newer `forbidden()`/`unauthorized()` helpers, which are already exported — unused so far — from `next/navigation` in this same version). `DYNAMIC_SERVER_USAGE` and `NEXT_REDIRECT` are still correct as written.
   - למה זה חשוב: this isn't a hypothetical future-Next-version risk — it's already incorrect for the exact Next.js this project ships with. The function's own JSDoc states it exists precisely so that a broad `catch` (like `get-user-businesses.ts`'s) never swallows Next's internal control-flow signals; today it would silently swallow a real `notFound()` if one were ever thrown inside such a `catch` (not currently exploitable, because no code path in this diff calls `notFound()` inside a wrapped `catch` yet — but the utility is documented and positioned for exactly that reuse). Separately: Next.js ships an **official, public function for this exact purpose** — `unstable_rethrow`, exported from `next/navigation` in this same installed version (confirmed via `node_modules/next/navigation.d.ts` → `navigation.react-server`) — so this hand-rolled prefix list is reimplementing (incorrectly, in one case) something the framework already provides and maintains.
   - איך לתקן: replace the body of `isNextControlFlowError`/its call sites with Next's own `unstable_rethrow(error)` (it rethrows if internal, no-ops otherwise — matches the intended usage exactly), or at minimum fix the prefix to `NEXT_HTTP_ERROR_FALLBACK` and add a regression test that pins it against the actual installed Next version rather than a hardcoded string, so a future Next upgrade fails the test instead of silently drifting again.

4. **API-response boundaries in `business-form.tsx` are cast, not validated — no zod at this fetch boundary (unlike the rest of the project)**
   - Files: `invoicing-receipts/src/app/(app)/businesses/new/business-form.tsx:35,37,83`; related root cause: `invoicing-receipts/src/lib/businesses/get-user-businesses.ts:24,27-37` (`Promise<BusinessListItem[]>` is an unenforced type annotation — no `Database` generic is passed to `createServerClient` anywhere in `src/lib/supabase/server.ts`, so `.select(...)`'s `data` is implicitly `any` and flows straight through).
   - מה: `extractApiErrorMessage` casts `payload as { error: unknown }` / `payload as { error: string }`, and the golden path does `const { business, signingKeyError } = payload as { business: CreatedBusiness; signingKeyError: string | null }` — all on the raw, unvalidated `unknown` result of `response.json()`. This project validates the *request* body twice (client `businessSchema` + server `bodySchema` in `route.ts`) but never validates the *response* shape on the way back.
   - למה זה חשוב: if the API route's response shape ever drifts from this cast (a bug, a future refactor, a differently-shaped error response from an intermediary), the cast will not catch it — `pendingKeyBusiness.legal_name`/`.id`/`.tax_id` would silently become `undefined` and get rendered/sent as such (e.g. the keygen-retry request body would include `business_id: undefined`), rather than failing loudly at the boundary the way a `safeParse` would.
   - איך לתקן: define a small zod schema for the two known response shapes (`{ business: {...}, signingKeyError }` and `{ error: string }`) and `safeParse` the JSON payload before destructuring, falling back to the existing generic error message on parse failure. Longer-term (out of this diff's scope, flagging for awareness): pass a generated `Database` type into `createServerClient`/`createBrowserClient` so Supabase query results stop being implicitly `any` project-wide.

5. **`mapAuthError` (an auth-domain-named function) is now the generic network-error fallback for a non-auth form**
   - File: `invoicing-receipts/src/app/(app)/businesses/new/business-form.tsx:12,97,124` (imports and calls `mapAuthError` from `@/lib/supabase/auth-errors`)
   - מה: `mapAuthError`'s own JSDoc (`auth-errors.ts:26-30`) says it "translates Supabase Auth error messages" — but it's now called from the business-creation form's `catch` blocks, which have nothing to do with Supabase Auth (they wrap a `fetch("/api/businesses")`/`fetch("/api/keygen")` call). It happens to produce a correct result today only because its pattern list includes a generic `fetch failed|failed to fetch|networkerror` match that isn't auth-specific at all.
   - למה זה חשוב: this is exactly the kind of naming drift that compounds — a future reader of `business-form.tsx` will reasonably wonder why a business-creation form is importing "auth errors," and the next non-auth form that needs a network-error fallback will likely copy this same import rather than question it, spreading the mislabeling further.
   - איך לתקן: extract the network-detection logic (or just the `NETWORK_MESSAGE` pattern match) into a domain-neutral helper — e.g. `toFriendlyNetworkError` in `@/lib/errors` (which already exists and already owns the `INV_*` → Hebrew mapping used by the same two files) — and have `mapAuthError` delegate to it for its own network case if needed, rather than the reverse.

### 🟢 Nits

1. **`setActiveBusinessId`'s `businessId` parameter has no shape validation**
   - File: `invoicing-receipts/src/app/(app)/businesses/actions.ts:17-19`
   - RLS fully backstops this (a malformed or foreign id simply returns 0 rows → clean rejection), so this is not a security gap — but a `z.string().uuid().safeParse(businessId)` guard at the top would match the zod-at-every-boundary discipline used one file away in `route.ts`, and would turn a malformed client bug into an explicit 400-style rejection instead of a generic "not found" message.

## הערכה כללית

הליבה הביטחונית של F3-F4 — האם אפשר לקבע עסק זר דרך ה-cookie — מיושמת נכון ונבדקת נכון: `setActiveBusinessId` באמת מאמת בעלות מחדש דרך RLS לפני כתיבה, ה-cookie הוא `httpOnly`/`sameSite=lax`/`secure`-בפרודקשן, ומצב ה-cookie-שהתיישן (עסק שכבר לא שייך למשתמש) מטופל ונבדק במפורש. שכבת ה-error-handling שהתווספה ל-F1-F2 (try/catch ב-3 טפסי auth, בדיקת `data.session`, לוגים ב-middleware) אמיתית ונבדקת מחדש עם תרחישי כישלון של ממש, לא רק תיעוד. אין 🔴 בסבב הזה. חמשת ה-🟡 הם באמת "should fix" ולא "must fix": פער אינטגרציה אמיתי בין F3 ל-F4 (עסק חדש לא הופך לפעיל — לא מסוכן היום כי אין עדיין יצירת מסמכים בפאזה 0, אבל יהיה משמעותי ברגע ש-Phase 1 יגיע), רגרסיית נגישות קונקרטית ב-dropdown החדש (`aria-label` שמסתיר את שם העסק הפעיל ממשתמשי screen reader), פער עמידות אמיתי (לא רק תיאורטי) ב-`next-control-flow-error.ts` שאומת ישירות מול קוד ה-Next המותקן, היעדר זוד ב-boundary של תגובת ה-fetch (בניגוד לכל שאר גבולות ה-API בפרויקט), ושם מטעה (`mapAuthError`) שמתפשט מעבר לדומיין המקורי שלו. שום ממצא לא פוגע ב-multi-tenancy, ב-audit, או ב-data-integrity בפועל — לכן ✅ approved, עם המלצה חמה לסבב תיקון קצר וממוקד (הכי דחוף מביניהם: #1, כי הוא היחיד עם פוטנציאל השפעה עתידית על נכונות נתונים ברגע ש-Phase 1 יתחבר).

---
