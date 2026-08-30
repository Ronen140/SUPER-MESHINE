# Code Quality Review: Invoicing & Receipts — Phase 0 Batch 1 (B1-B4)

**תאריך:** 2026-08-30 16:10
**Base SHA:** 416c9bc~1 (ec96c57)
**Head SHA:** 18e079d
**Commits בסקירה:** `416c9bc`, `144b5a3`, `18e079d`
**Spec:** `vault/Engineering/invoicing-phase-0-plan.md` (B1-B4) + `invoicing-receipts/docs/adr/001-data-model-and-rls.md`
**Spec-reviewer:** ✅ (round #2 — round #1 היה ❌ על פער `moddatetime` יחיד, תוקן ב-`18e079d`)
**סבב code-quality-reviewer:** #1
**Security checklist:** הופעל — ה-diff נוגע ב-auth-sync trigger (`handle_new_auth_user` על `auth.users`), service-role client/guard, ו-secrets handling (`.env.example`, `SUPABASE_SERVICE_ROLE_KEY`)

## תוצאה: ✅ approved

**Severity counts:** 🔴 0 | 🟡 0 | 🟢 2

## Strengths

- **DDL תואם ADR שורה-שורה, מאומת בפועל.** השוויתי את `0003a_core_tables.sql` ו-`0003b_document_tables.sql` מול `docs/adr/001-data-model-and-rls.md §Schema` — עמודות, CHECK constraints, אינדקסים (כולל partial indexes ו-`generated always as`) זהים למקור. אין float לכספים בשום מקום (`numeric(14,2)`/`numeric(5,2)`/`numeric(18,6)` בלבד), `timestamptz` בכל מקום שצריך, `citext` על שדות email בלבד.
- **Idempotency נכונה, לא מסתירה באגים.** `create extension if not exists` (בטוח לחזרה), אבל `create table`/`create type`/`create index` **בלי** `if not exists` — בדיוק כמו שצריך במיגרציות שה-CLI עוקב אחריהן; `if not exists` שם היה מסווה הרצה כפולה בטעות.
- **Down migrations נכונים ובטוחים.** `drop table`/`drop type` פשוטים ללא `CASCADE`, בסדר תלות FK-aware הפוך (`0003b` down לפני `0003a` down, ובתוך כל קובץ — טבלאות ילדות לפני הוריות). אימתתי ידנית: אין CASCADE מסוכן בשום קובץ down.
- **ה-service-role import guard נבדק בפועל ועובד**, לא רק מוגדר. הרצתי `biome lint` נגד fixture חדש עם import אסור דרך alias (`@/server/service-role/client`) ודרך relative path (`../../server/service-role/client`) — שניהם נתפסו ונחסמו עם הודעת שגיאה ברורה. `client.test.ts` בודק 3 מקרי אמת (חסר URL, חסר key, קונפיג תקין מחזיר client אמיתי) — לא tautology.
- **בידוד ה-workspace אומת.** `pnpm-workspace.yaml` בשורש כולל רק `apps/*`, `packages/*`, `mcp/*` — `invoicing-receipts/` לא נכלל, כך שהוא באמת workspace עצמאי כפי שה-README טוען.
- **`vat_rates` seed נכון:** `(17.00, 2015-10-01, 2024-12-31)`, `(18.00, 2025-01-01, null)` — תואם שיעור המע"מ הנוכחי בישראל (18%, בתוקף מ-2025-01-01).
- **תיקון `moddatetime` (`18e079d`) נקי ומלא** — הוסר `public.set_updated_at()` וגם שורת ה-`drop function` המקבילה ב-down, בלי שיירים. אימתתי ש-`create extension if not exists moddatetime` נוסף ב-`0001` וש-`drop extension` נוסף ב-`0001_down` בסדר הנכון (reverse).
- **תיעוד יוצא דופן ברמת ה-migration עצמה** — כל קובץ מסביר *למה* RLS לא כלול כאן, למה המספור `0003a/0003b` ולא `0003`/`0004`, ומה חסום ל-batch הבא. זה בדיוק המקום הנכון לתעד scope boundary כזה.

## Quality Checklist

### A. Naming & Structure
- [x] שמות טבלאות/עמודות/אינדקסים עקביים (`snake_case`, סיומות `_idx`/`_uk`/`_trg` אחידות בכל 4 קבצי המיגרציה).
- [x] גודל קבצים סביר — הגדול ביותר `0003a_core_tables.sql` (320 שורות), בתוך תחום סביר למיגרציית DDL עם הרבה קומנטרי.
- [x] אחריות ברורה: `0001`=extensions, `0002`=enums, `0003a`=core/global/membership, `0003b`=documents. חלוקה נקייה, מתועדת ב-header comment של כל קובץ.
- [x] המימוש עוקב אחרי ה-plan/ADR במדויק, כולל שינוי המספור `0003→0003a/0003b` שתועד כ-Revision 1 של הפלאן.

### B. Type Safety
- [x] אין `any` בקוד TS (`client.ts`, `client.test.ts`) — `SupabaseClient` טיפוסי מלא.
- [x] אין `as` casts לא-מוסברים.
- [x] `tsc --noEmit` רץ נקי (אומת ישירות, ראה Health Checks).
- n/a exhaustive switch / generics — אין enum handling ב-TS side עדיין בבאץ' הזה.

### C. Error Handling
- [x] `client.ts` זורק שגיאות actionable עם שם הפונקציה + שם המשתנה החסר + הפניה ל-`.env.example` (`"createServiceRoleClient: NEXT_PUBLIC_SUPABASE_URL is not set. See .env.example."`) — בדיוק הרמה המבוקשת (לא `throw new Error('foo failed')` גנרי).
- [x] טריגרי ה-DB (`protect_business_identity`, `enforce_business_min_owner`) זורקים עם קוד `INV_*` + `errcode = 'P0001'` וההודעה כוללת את השורה הרלוונטית — עקבי עם מיפוי השגיאות שה-ADR מבקש ב-Implementation Notes #4.
- n/a TRPCError — אין tRPC endpoints בבאץ' הזה.

### D. Database Queries
- n/a — אין queries אפליקטיביים בבאץ' הזה, רק DDL.
- [x] אינדקסים תואמים דפוסי גישה מתועדים: `customers_lookup_idx(business_id, is_active, name)` לרשימת לקוחות, `items_recent_idx(business_id, last_used_at desc nulls last)` לבורר פריטים אחרונים, `documents_list_idx`/`documents_drafts_idx`/`documents_open_idx` (aging) — כולם partial/composite נכונים ולא-מיותרים.
- [x] `on delete restrict` בכל FK ל-`businesses`/`users`/`customers` (מונע מחיקה גורפת), `on delete cascade` רק מ-`document_lines`/`payments` ל-`documents` — מתועד למה זה בטוח (רק טיוטות ניתנות למחיקה, כי ה-immutability trigger שחוסם מחיקת מסמך שהופק מגיע ב-batch הבא).
- [x] `FOREIGN KEY (x_id, business_id) REFERENCES ... (id, business_id)` בכל מקום רלוונטי (`documents→parent`, `documents→customers`, `document_lines→documents/items`, `payments→documents`) — הגנת cross-tenant ברמת ה-DB, לא תלויה ב-RLS.

### E. Performance
- n/a — DDL בלבד, אין קוד עם לולאות/N+1 בבאץ' הזה.

### F. Tests
- [x] 3 בדיקות ב-`client.test.ts` בודקות behavior אמיתי: זריקת שגיאה כשחסר כל אחד מ-2 משתני הסביבה, והחזרת client אמיתי כשהם קיימים (`typeof client.from === 'function'`) — לא mock-קב את עצמו.
- [x] אימתתי בנוסף שה-guard (`noRestrictedImports`) אכן תופס imports דרך alias וגם דרך relative path (לא מתועד ב-test file, ראה 🟢 Nit #2 למטה).
- `pnpm test` (`vitest run`): 3/3 ירוקים (אומת ישירות).

### G. Comments
- [x] תיעוד ה-WHY מצוין לכל אורך הקוד — כל trigger/constraint מפנה לסעיף ADR הרלוונטי; אין JSDoc ריק.
- [x] אין TODO/FIXME ללא בעלים (`grep` על כל התיקייה — 0 תוצאות).

### H. Dead Code
- [x] אין קוד מת. `businesses_id_entity_uk unique(id, entity_type)` לא בשימוש עדיין ב-batch הזה, אבל מתועד במפורש כ"לשימוש עתידי בלבד" ותואם את ה-ADR — לא dead code אלא forward-declared constraint.
- [x] אין features חצי-מחוברים — ה-README וכל קובץ migration מציינים בבירור מה עדיין לא קיים (RLS, audit, immutability, `issue_document`, `create_business`).

## Security Checklist

### 1. Auth
- [x] אין JWT handling ידני בבאץ' הזה — Supabase Auth native בלבד.
- n/a Refresh token cookie / access token storage — אין client-side auth code בבאץ' הזה.
- [x] Password hashing — Supabase native בלבד; **אין** קוד bcrypt/scrypt custom בשום מקום.
- [x] `handle_new_auth_user()` (trigger על `auth.users`) — `security definer`, `set search_path = public, pg_temp` (מונע search_path hijacking), לא בונה SQL דינמי, לא חושף/כותב סוד כלשהו. משתמש רק ב-`raw_user_meta_data` הסטנדרטי של Supabase לצורך full_name/locale — לא נתיב הרשאות.
- [x] אין credentials ב-log/console — נבדק ב-`grep`.

### 2. Multi-Tenancy
- **n/a (במכוון, מתועד ב-plan וב-ADR) — RLS נדחה ל-`0004_rls_helpers`/`0005_rls_policies` בכוונה.** כל 4 קבצי המיגרציה מכריזים במפורש (header comments) שאין RLS בבאץ' הזה, כולל על `business_signing_keys`/`document_counters`/`audit_log` שה-ADR מציג עם RLS inline. זו לא סטייה שקטה — spec-reviewer כבר אימת (item #18) ש-0 הופעות של `row level security`/`create policy` בכל migration, ואין נתיב כתיבה לא-migration עד היום. **חובה: batch 2 (RLS helpers + policies) הוא ה-gate האמיתי ל-multi-tenancy — אין לאשר שום קוד אפליקטיבי שקורא/כותב לטבלאות האלה לפני שהוא עובר.**
- [x] אין service-role client בשום endpoint עדיין — `client.ts` מוגדר אך לא נקרא משום מקום עדיין (3 הנתיבים הלגיטימיים מיושמים ב-B9/B13, לא כאן).

### 3. RBAC
- n/a — אין permission checks / mutation procedures בבאץ' הזה (מגיע עם `app.has_role`/policies ב-batch הבא).

### 4. Agent Actions
- n/a — הפרויקט אינו כולל Process Agents (ADR-INV-001 §Context: invariants #3/#4 של CLAUDE.md אינם רלוונטיים כאן).

### 5. Secrets
- [x] `grep` על כל התיקייה (`sk-`, `eyJ`, מפתחות ארוכים) — 0 ממצאים אמיתיים; המחרוזת היחידה שעלתה היא `"service-role-test-key"` ב-test fixture, לא סוד אמיתי.
- [x] `.env.example` מכיל רק שמות משתנים, ללא ערכים.
- [x] `SUPABASE_SERVICE_ROLE_KEY` לא בקידומת `NEXT_PUBLIC_`; מתועד מפורשות ב-`.env.example`, ב-README, וב-`service-role/README.md` שהוא server-only.
- [x] `supabase/.gitignore` חוסם `.env.local`/`.env.*.local`; שורש `.gitignore` חוסם `.env`/`.env.local`/`.env.*.local`.
- [x] `SUPABASE_SERVICE_ROLE_KEY` נקרא רק בתוך `src/server/service-role/client.ts` — נתיב server-only יחיד, נאכף ע"י ה-lint rule (אומת ישירות עם fixture חיה, ראה Strengths).

### 6. Input Validation
- n/a — אין tRPC procedures / fetch calls / file uploads בבאץ' הזה (DDL + scaffold בלבד). `sql.raw`/string concat לא קיימים בשום מיגרציה — כל ה-SQL הוא DDL סטטי, לא query בזמן ריצה עם קלט משתמש.

### 7. OWASP Quick Scan
- n/a XSS/SSRF/IDOR — אין UI-with-data / fetch לדומיינים חיצוניים / resource-id endpoints בבאץ' הזה.
- [x] Broken auth — אין endpoint כלל, ולכן אין `publicProcedure` שמדלג על auth.
- [x] Sensitive data exposure — `business_signing_keys` (מפתחות פרטיים מוצפנים) לא נחשפת ב-API כלשהו; אין policy עליה עדיין (תיזכה ל-FORCE + ללא policies בכלל ב-batch הבא, לפי D3.2).

## Issues

אין 🔴 ואין 🟡.

### 🟢 Nits

1. **README מיושן במספור המיגרציות**
   - File: `invoicing-receipts/README.md:5`, `README.md:81-85`
   - מה: הטקסט אומר "migrations 0001-0004 (extensions, enums, טבלאות ליבה, טבלאות מסמכים)" — אבל בפועל אין קובץ `0004`, יש `0001`, `0002`, `0003a`, `0003b`. הפער נוצר כי לפני `144b5a3` הייתה מיגרציית `0003` יחידה ופוצלה ל-`0003a`/`0003b` בלי שה-README עודכן לשם החדש.
   - למה זה חשוב: מטעה קורא עתידי לגבי מה קיים בפועל בתיקיית `migrations/`; לא משפיע על production כי אין קוד שתלוי בטקסט הזה.
   - איך לתקן: להחליף ל-"migrations 0001-0003b".

2. **אין regression test אוטומטי ל-`noRestrictedImports` guard**
   - File: `invoicing-receipts/biome.json:39-51`
   - מה: הבדיקה שה-lint rule באמת תופס import אסור בוצעה ידנית בסקירה הזו (fixture חד-פעמי + `biome lint`), לא קיימת כ-test/CI step קבוע בריפו.
   - למה זה חשוב: זהו ה-control היחיד שאוכף את "3 הנתיבים הסגורים" ל-`service_role` (ADR-INV-001 §D5) — שווה regression coverage לפני שקוד אמיתי מתחיל לצרוך אותו (B9/B13), כדי שרפקטור עתידי ל-`biome.json` או להעברת התיקייה לא ישבור את האכיפה בשקט.
   - איך לתקן: fixture file (למשל ב-`tests/lint-fixtures/`) עם import אסור + script/CI step שמריץ `biome lint` על הפיצ'ר ומצפה לקוד יציאה שאינו 0. לא חוסם את ה-batch הנוכחי — אין עדיין קוד שצריך את ההגנה בפועל.

## הערכה כללית

הבאץ' הזה הוא DDL scaffold טהור, והוא נבדק שורה-שורה מול ADR-INV-001 §Schema — התאמה מדויקת, כולל עמודות Phase 2/3, כל ה-CHECK constraints, וכל האינדקסים. ה-scope boundary (בלי RLS/audit/immutability/issue_document/create_business) מתועד באופן חוזר ועקבי בכל קובץ, ולא מוסתר — כולל ב-spec-reviewer checklist (item #18) שאימת 0 הופעות RLS. תיקון ה-`moddatetime` מסבב הספק הקודם נקי לחלוטין, כולל ניקוי ה-down migration. שני הממצאים היחידים הם קוסמטיים/פרו-אקטיביים (🟢) ואינם חוסמים merge. **הערה לסבב הבא:** batch 2 (RLS helpers + policies, `0004`-`0005`) הוא ה-gate האמיתי של multi-tenancy עבור הפרויקט הזה — יש להריץ עליו את ה-security checklist במלואו כשהוא יגיע, כולל אימות ש-FORCE מוגבל אך ורק ל-`business_signing_keys` (Amendment A-4) וש-whitelist ה-`SECURITY DEFINER` נבדק ב-CI.

---
