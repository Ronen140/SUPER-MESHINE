# Code Quality Review: Invoicing & Receipts — F1-F2 (App Shell + Auth Flow)

**תאריך:** 2026-08-30 10:12
**Base SHA:** ae24c22~1 (f30cc89)
**Head SHA:** b8602d3
**Spec:** `vault/Engineering/invoicing-phase-0-plan.md` (Subtask F1, F2) + `vault/Discovery/2026-08-30-invoicing-ui-design-research.md` + `invoicing-receipts/docs/adr/001-data-model-and-rls.md` §D5
**Spec-reviewer:** ✅ (round #2, `vault/Reviews/spec/2026-08-30-invoicing-f1-f2.md`)
**סבב code-quality-reviewer:** #1
**Security checklist:** הופעל — ה-diff נוגע ב-auth (login/signup/logout/middleware/session refresh)

## תוצאה: ✅ approved

**Severity counts:** 🔴 0 | 🟡 4 | 🟢 2

**בדיקות שהורצו (כולן ירוקות):**
- `pnpm typecheck` → exit 0, אין שגיאות.
- `pnpm lint` → `Checked 46 files in 30ms. No fixes applied.`
- `pnpm test` → `Test Files 11 passed (11)`, `Tests 39 passed (39)` (עומד בדרישת "37+").
- `pnpm build` → `✓ Compiled successfully`, כולל `Generating static pages (6/6)`. `/login` ו-`/signup` מסומנים `ƒ` (dynamic, כצפוי — `searchParams`/session), `/` מסומן `○` (static shell).

## Strengths

- **`getUser()` ולא `getSession()` ב-middleware** — `invoicing-receipts/src/lib/supabase/middleware.ts:44` קורא ל-`supabase.auth.getUser()`, שמאמת את ה-JWT מול שרתי Supabase בפועל, לא רק מפענח cookie מקומי. זה בדיוק דפוס ה-`@supabase/ssr` המומלץ ל-server-side auth checks (בניגוד ל-`getSession()` שניתן לזייף cookie מקומי בלי לתפוס).
- **הגנת open-redirect אמיתית** — `invoicing-receipts/src/app/(auth)/login/page.tsx:12-15` (`safeRedirect`) חוסם `?next=` שאינו מתחיל ב-`/` וגם חוסם `//evil.com` (protocol-relative redirect) — הגנה נכונה שלא הייתה מפורשת ב-AC אבל קריטית ברגע שיש פרמטר redirect נשלט ע"י query string.
- **regression test אמיתי ל-`noRestrictedImports`** — `invoicing-receipts/tests/no-restricted-imports.test.ts` לא בודק את ה-config בעל-פה אלא מריץ בפועל `biome lint` על fixture זמני שמייבא מ-`service-role`, ומוודא כישלון + control-case שמייבוא לא-קשור לא נכשל. זה סוגר בדיוק את סוג הפער ש-ADR-INV-001 §D5 דורש למנוע ("ESLint/Biome rule חוסם import... נבדק ידנית" בסבב 1 → הפך ל-CI-enforced אוטומטי בסבב זה).
- **client factories נבדקים אמיתית, לא מוקמים** — `invoicing-receipts/src/lib/supabase/browser.test.ts` ו-`server.test.ts` מריצים `createClient()` האמיתי (import ישיר, לא `vi.mock`), כולל שני נתיבי ה-`throw` על env חסר ומסלול ה-cookie adapter האמיתי (`server.test.ts:47-48` — קורא ל-`client.auth.getSession()` ומוודא ש-`getAllMock` נקרא בפועל). זה סוגר את הפער מסבב 1 בצורה שממש בודקת את הקוד, לא רק מדמה אותו.
- **error mapping לא מדליף פרטי implementation** — `invoicing-receipts/src/lib/supabase/auth-errors.ts` ממפה הודעות Supabase (תמיד באנגלית, לא חוזה מתועד) להודעות עברית ידידותיות עם fallback גנרי ל-לא-מזוהה — לא מחזיר לעולם את הודעת השגיאה הגולמית של הספק ללקוח.

## Quality Checklist

### A. Naming & Structure
- [x] שמות תיאוריים לאורך כל ה-diff (`isPublicPath`, `mapAuthError`, `safeRedirect`, `updateSession`) — ברור מה כל פונקציה עושה בלי לקרוא implementation.
- [x] גודל קבצים — כל קובץ חדש קטן מ-130 שורות (`signup-form.tsx` הכי ארוך, 126 שורות). אין צורך בפיצול.
- [x] אחריות ברורה: `public-paths.ts` (policy טהורה, ניתנת ל-unit test בלי request), `middleware.ts` (session refresh בלבד), `src/middleware.ts` (החלטת redirect) — הפרדה נכונה בין "מה מותר" ל"מה קורה אם אסור".
- [x] מבנה תיקיות עוקב אחרי ה-plan: `src/lib/supabase/{browser,server,middleware}.ts`, `src/lib/auth/public-paths.ts`, `src/app/(auth)/{login,signup}`, `src/components/{auth,layout,ui}` — תואם `Files (predicted)` ב-F1/F2.

### B. Type Safety
- [x] אין `any` בכל ה-diff (grep מלא על `src/` — 0 תוצאות מחוץ ל-`import type * as React`/`* as LabelPrimitive`, שהם namespace imports לגיטימיים, לא `any`).
- [x] אין `as Foo` casts לא-מוסברים (grep על `as [A-Z]`/`as unknown` — 0 תוצאות).
- [x] Zod בכל form boundary — `login-form.schema.ts`, `signup-form.schema.ts`, עם `z.infer` לטיפוס משותף (`LoginInput`/`SignupInput`) — לא מוגדר פעמיים.
- [x] `updateSession` מחזיר טיפוס מפורש (`Promise<{ response: NextResponse; user: { id: string } | null }>`) — לא `any`/מוסק implicitly.

### C. Error Handling
- [ ] **🟡 חסר `try/catch` סביב קריאות Supabase Auth ב-3 טפסים** — ראה Issues #1.
- [x] `updateSession` תופס timeout/network exception (`catch` ב-`middleware.ts:46-49`) עם הערה מפורשת למה זה בטוח (fail-to-unauthenticated, לא 500).
- [x] הודעות שגיאה בעברית actionable (לא רק "שגיאה") — `mapAuthError` תמיד מחזיר משפט מלא עם הנחיה ("נסו שוב", "פנו לתמיכה").
- [x] `role="alert"` על כל שגיאת form/auth — נתפס ע"י screen readers.

### D. Database Queries
- N/A לגמרי — F1/F2 אינם נוגעים ב-DB queries ישירות (Supabase Auth API בלבד; `business_id`/RLS queries מתחילים ב-F3/B9, מחוץ לסקופ).

### E. Performance
- [x] אין לולאות/N+1 — אין קריאות רשת חוזרות. `updateSession` רץ פעם אחת לכל request דרך `matcher`.
- [x] `matcher` ב-`middleware.ts:24-31` חוסם `_next/static`/`_next/image`/סיומות תמונה — לא מריץ session-refresh על assets סטטיים.

### F. Tests
- [x] 39/39 ירוקים (`pnpm test`), עומד ביעד "37+".
- [x] בדיקות מאמתות behavior (`toHaveBeenCalledWith`, `toBeInTheDocument`, `toHaveTextContent`) — לא internal implementation details.
- [x] מוקים ממוקדים בגבול הנכון — `vi.mock("@/lib/supabase/browser")` בטסטים של קומפוננטות UI (login/signup/logout/sidebar) הוא נכון: בודקים את התנהגות ה-component, לא את Supabase עצמו. הקוד שבתוך `browser.ts`/`server.ts` עצמם נבדק בנפרד בלי מוק (ראה Strengths) — זה בדיוק החלוקה הנכונה, לא "מוק שמסתיר integration bug".
- [x] `sidebar.test.tsx` בודק היעדרות (`queryByRole("link", {name: /מסמכים/}).not.toBeInTheDocument()`) — סוגר רגרסיה קונקרטית מסבב 1 (scope creep).

### G. Comments
- [x] JSDoc בכל קובץ lib מסביר WHY לא WHAT — לדוגמה `middleware.ts:4-13` מסביר את החלטת ה-fail-open ומפנה ל-Open Question #3 ב-plan; `browser.ts:4-7`/`server.ts:4-9` מפנים ל-ADR-INV-001 §D5.
- [x] אין TODO/FIXME יתומים (grep מלא — 0 תוצאות).

### H. Dead Code / Half-Implemented
- [x] `BusinessSwitcherPlaceholder` ו-`UPCOMING_NAV_ITEMS` מתועדים במפורש כ-placeholder ל-F4/Phase 1, עם comment שמפנה ל-plan, ולא מחוברים ל-route שלא קיים — לא "half-feature" סמוי.
- [ ] 🟢 ראה Nits #1 (טקסט "טוען עסקים…" קבוע).

## Security Checklist

### 1. Auth
- [x] JWT validated לפני שימוש — `middleware.ts:44` (`getUser()`, לא `getSession()`).
- [~] Refresh/access token ב-cookie, לא ב-`localStorage`/`sessionStorage` — מאומת: grep מלא על `src/` ל-`localStorage`/`sessionStorage` = 0 תוצאות; `createBrowserClient`/`createServerClient` (`@supabase/ssr`) מנהלים session אך ורק דרך cookies. **הסתייגות:** cookies אלו, לפי דפוס `@supabase/ssr` הרשמי ל-Next.js App Router, אינם `HttpOnly` (ה-browser client צריך גישת JS ישירה ל-refresh) — זו התנהגות הפלטפורמה המתועדת של `@supabase/ssr`, לא סטייה של ה-implementer, וכבר אושרה כהחלטת ארכיטקט (spec review round 1, item #19: "Supabase Auth ישירות מהדפדפן בלי tRPC"). לא ✅/❌ מלא — ראה ⚠️ Judgment-Needed.
- [x] Logout מבטל session בשרת — `logout-button.tsx:19` קורא `supabase.auth.signOut()` (לא רק ניקוי client state).
- [x] Password hashing — Supabase native בלבד; אין קוד hashing עצמאי בכל ה-diff.
- [x] אין credentials logged — grep על `console.` ב-`src/` (חדש/שונה) = 0 תוצאות; `mapAuthError` לא מדפיס דבר, רק ממפה למחרוזת מוצגת.

### 2. Multi-Tenancy
- n/a — F1/F2 לא נוגעים ב-DB queries עם `business_id`. Multi-tenancy מתחיל ב-F3 (`app.create_business()`, מחוץ לסקופ הביקורת הזו).

### 3. RBAC
- n/a — אין permission/role checks ב-F1/F2 (כל משתמש מאומת רואה את ה-shell; RBAC לפי `business_members.role` מתחיל ב-Phase 1 UI).

### 4. Agent Actions
- n/a — הפרויקט כולו ללא Process Agents (מתועד ב-ADR-INV-001 Context: "אין כאן סוכני AI ואין פעולות מטעם").

### 5. Secrets
- [x] אין API key hard-coded — grep על `sk-`/`eyJ`/מחרוזות hex ארוכות = 0 תוצאות רלוונטיות.
- [x] אין secret ב-log/error — מאומת.
- n/a Sentry scrubbing — Sentry עוד לא מחווט בפרויקט הזה.
- [x] `.env`/`.env.local`/`.env.*.local` ב-`.gitignore`.
- [x] `SUPABASE_SERVICE_ROLE_KEY` לא מופיע בשום קובץ שהשתנה ב-diff הזה (`browser.ts`/`server.ts`/`middleware.ts` קוראים רק `NEXT_PUBLIC_SUPABASE_ANON_KEY`); `src/server/service-role/` עצמו לא נגע בקומיטים האלה.

### 6. Input Validation
- [x] כל form boundary עובר zod (`login-form.schema.ts`, `signup-form.schema.ts`) לפני קריאה ל-Supabase.
- n/a tRPC — אין tRPC בפרויקט (בחירת ארכיטקט מתועדת).
- n/a fetch חיצוני / file upload — לא קיימים ב-diff זה.
- n/a SQL — אין שאילתות SQL ב-diff זה.

### 7. OWASP Quick Scan
- [x] **XSS:** אין `dangerouslySetInnerHTML` בכל ה-diff; כל טקסט מרונדר דרך React.
- n/a **SSRF:** אין fetch עם URL ממשתמש.
- [x] **IDOR:** n/a ישיר (אין `resource_id` queries עדיין), אבל `safeRedirect` סוגר וקטור דומה (open-redirect) ב-`?next=` — ראה Strengths.
- [x] **Broken auth:** `isPublicPath` הוא allow-list סגור (`/login`, `/signup`, `/auth`) עם ברירת מחדל "מוגן" — נבדק ב-`public-paths.test.ts:21-23` שגם prefix דומה (`/login-history`) לא נתפס בטעות כ-public.
- [x] **Sensitive data exposure:** שום קובץ לא מחזיר `password_hash`/internal tenant IDs של גורם אחר.

## Issues

### 🟡 Important (Should fix)

1. **אין `try/catch` סביב קריאות Supabase Auth ב-3 הטפסים — כישלון רשת/exception לא-צפוי נעלם בשקט**
   - Files: `invoicing-receipts/src/app/(auth)/login/login-form.tsx:27-39`, `invoicing-receipts/src/app/(auth)/signup/signup-form.tsx:27-43`, `invoicing-receipts/src/components/auth/logout-button.tsx:15-29`
   - מה: כל שלושת ה-handlers מניחים ש-`signInWithPassword`/`signUp`/`signOut` תמיד resolve עם `{ error }` — ואם ה-promise עצמו נדחה (network throw לא-מטופל ע"י supabase-js, או `createClient()` שזורק סינכרונית כש-env חסר), react-hook-form תופס את זה (`isSubmitting` מתאפס כראוי — נבדק ב-`node_modules/react-hook-form` source), אבל אף `setFormError`/`setError` לא נקרא. המשתמש רואה כפתור שחוזר לפעיל בלי שום הודעה — כישלון שקט.
   - למה זה חשוב: לא production-blocking (supabase-js בדרך כלל עוטף כשלי fetch ל-`{error}`), אבל זה בדיוק תבנית ה-error-swallowing שמצטברת ל-tech debt — ברגע שיתווסף מסלול חדש (network flaky, CORS, proxy) המשתמש יתקע בלי הסבר ו-support יקבל "זה סתם לא עבד".
   - איך לתקן: לעטוף את גוף ה-`onSubmit`/`handleLogout` ב-`try { ... } catch (err) { setFormError(mapAuthError(err)) }` — `mapAuthError` כבר מטפל ב-`unknown`, כך שזה שינוי מקומי קטן בכל אחד משלושת הקבצים.

2. **Signup לא בודק `data.session` — לא מטפל בזרימת אימות-אימייל**
   - File: `invoicing-receipts/src/app/(auth)/signup/signup-form.tsx:30-42`
   - מה: `const { error } = await supabase.auth.signUp(...)` מתעלם מ-`data` ומנווט מיידית ל-`/` בכל הצלחה. אם בפרויקט ה-Supabase החי "Confirm email" מופעל (ברירת המחדל של Supabase לפרויקט חדש) — `signUp()` מחזיר `error: null` אבל `data.session === null` (אין session עד אישור המייל). `router.push("/")` ירוץ, ה-middleware יראה `user === null` (`getUser()` נכשל, אין session), ו-`/` יופנה חזרה ל-`/login` — לולאת bounce שקטה, בלי שום הודעה שמסבירה "יש לאשר את המייל".
   - למה זה חשוב: זה בדיוק הרגע שבו "Live Supabase round-trips נדחו לסוף הפאזה" (מצוין ב-commit message) יתגלה — כרגע נבדק רק מול mock/jsdom+Playwright על UI סטטי, לא מול הגדרת Auth אמיתית. אם ההגדרה בפרויקט החי היא Confirm-Email-On, הרשמה תיראה "שבורה" למשתמש הראשון בלי שגיאה.
   - איך לתקן: לבדוק `data.session` אחרי `signUp()` המוצלח: אם `null`, להציג הודעה "נשלח מייל אימות, בדקו את תיבת הדואר" במקום לנווט; אם קיים session — לנווט כרגיל. שווה גם לתאם עם ה-founder/architect מה הגדרת "Confirm email" בפועל בפרויקט ה-Supabase החי לפני חיבורו (open item, לא רק קוד).

3. **Fail-open ב-`updateSession` על env חסר — ללא לוגינג**
   - File: `invoicing-receipts/src/lib/supabase/middleware.ts:19-23`
   - מה: אם `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` חסרים, הפונקציה מחזירה `{ response, user: null }` בלי שום `console.error`/`console.warn` (ולא Sentry — עוד לא מחווט). זה מתועד כהתנהגות מכוונת (JSDoc) לסביבת פיתוח בלי פרויקט חי, וזה **בטוח** (fail-to-unauthenticated, לא bypass) — אבל אין שום סימן production אם זה יקרה בטעות אחרי דיפלוי אמיתי (למשל env var נמחק ב-Vercel).
   - למה זה חשוב: בלי log, "כל המשתמשים מקבלים login redirect" ייראה כמו סטטוס נורמלי, לא כמו תקלת קונפיגורציה — MTTR גרוע.
   - איך לתקן: `console.error("[middleware] Supabase env vars missing — failing open to unauthenticated")` (זמני, עד שיש Sentry) לפני ה-`return` ב-שורה 22.

4. **אותה בעיה ב-`catch` הרשתי** — `invoicing-receipts/src/lib/supabase/middleware.ts:46-49`
   - מה: `catch { return { response, user: null } }` בולע את השגיאה לגמרי, בלי `console.error(error)`.
   - למה זה חשוב: אם ה-Supabase project ה-live יהיה unreachable (DNS/outage), כל בקשה תתפרש כ"לא מחובר" בלי שום עקבה ל-debug — לא ניתן להבחין בין "המשתמש התנתק" ל"השרת נופל".
   - איך לתקן: להוסיף `console.error` (או Sentry `captureException` כשיחווט) בתוך ה-`catch` לפני ה-return.

### 🟢 Nits

1. **`BusinessSwitcherPlaceholder` מציג "טוען עסקים…" תמידית**
   - File: `invoicing-receipts/src/components/layout/business-switcher-placeholder.tsx:20`
   - זה placeholder מתועד (disabled, מחכה ל-F4) — אבל הטקסט "טוען עסקים…" מרמז על מצב loading זמני, בעוד שהוא סטטי לצמיתות עד F4. טקסט כמו "בחירת עסק (בקרוב)" יהיה מדויק יותר ויימנע בלבול אם מישהו יראה את זה ב-staging ויחשוב שיש spinner תקוע.

2. **גודל מגע כפתורים מתחת ל-44px** (Discovery §8: "גדלי מגע 44px במובייל")
   - File: `invoicing-receipts/src/components/ui/button.tsx:24-28`
   - `size: default` הוא `h-10` (40px), `size: sm` (בשימוש ב-`LogoutButton`) הוא `h-9` (36px). זה design-system-wide token, לא ספציפי ל-F1/F2, ולא היה AC מפורש ב-F1/F2 — מסומן ל-מודעות בלבד, לא חוסם.

## הערכה כללית

המימוש נקי, טוב-מובנה, ועם type-safety מלאה (0 `any`, 0 casts לא-מוסברים). הנקודה החזקה ביותר היא ה-testing discipline: התיקונים מסבב 1 (client factories, ווידוא דפדפן, sidebar scope) לא רק "סגרו סעיף" אלא הוסיפו בדיקות שבאמת מריצות את הקוד האמיתי — כולל regression test ל-`noRestrictedImports` שמריץ `biome` בפועל במקום לסמוך על קונפיג שלא ישבר. שכבת ה-auth עצמה תואמת את דפוס `@supabase/ssr` המומלץ (`getUser()` לא `getSession()`, session רק ב-cookies, logout שרתי אמיתי) וכוללת הגנת open-redirect שלא הייתה מפורשת ב-AC. הליבה של הביקורת היא ארבעה 🟡 סביב error-handling: שלושה טפסים בלי `try/catch` שמשתיקים כשל רשת/exception לא-צפוי, וזרימת signup שלא מתמודדת עם תרחיש אימות-אימייל — כולם non-blocking ל-merge כי ה-happy path מאומת (Chromium headless + 39 בדיקות), אבל צריך תיקון מהיר בסבב הבא לפני שיש פרויקט Supabase חי, כי זה בדיוק הרגע שהתרחישים האלה יתגלו לראשונה.

## ⚠️ Judgment-Needed (למודעות architect — לא חוסם)

**Refresh-token cookies אינם `HttpOnly`** — ה-checklist דורש `HttpOnly; Secure; SameSite=Lax` מלא לכל refresh token. `@supabase/ssr`'s `createBrowserClient` (הדפוס הרשמי היחיד לאימות Supabase מ-Next.js App Router בלי backend נפרד) מנהל cookies נגישים ל-JS בצד הלקוח כי ה-browser client עצמו צריך לקרוא/לרענן אותם. זו לא סטייה של ה-implementer — זו תוצאה ישירה של ההחלטה הארכיטקטונית "Supabase Auth ישירות מהדפדפן בלי tRPC/backend session layer" שכבר אושרה (spec review round 1, item #19; `vault/Engineering/invoicing-phase-0-plan.md:25`). מומלץ שה-architect יאשר במפורש שזה trade-off מקובל (הוא כן ה-best-practice המתועד של Supabase עצמם ל-Next.js, ומגודר ע"י RLS + short-lived tokens), או יחליט על שכבת session נפרדת אם ה-risk profile של מערכת חשבונאית מצדיק את זה. לא חוסם merge של F1/F2 — זו החלטה שכבר התקבלה ברמת הפרויקט, לא באג בקוד הזה.

---
