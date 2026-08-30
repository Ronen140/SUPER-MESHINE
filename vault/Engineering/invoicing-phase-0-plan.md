# Engineering Work Plan: Invoicing & Receipts — Phase 0 (Scaffold + Backend Engine)

**Date:** 2026-08-30 14:30
**Revised:** 2026-08-30 (Revision 1 — Amendment A מה-architect ל-ADR-INV-001 יושמה; Revision 2 — ניסיון (שגוי) ליישר מספור migrations; **Revision 3** — תיקון עובדתי מה-CEO: הקבצים בפועל הם `0003a`/`0003b`, לא `0003`/`0004` — מספור B5+ חוזר למצב Revision 1. ראו `## Plan Revisions` בתחתית הקובץ)
**Project:** `invoicing-receipts/` — independent pnpm project, outside the SUPER-MESHINE ERP workspace.

**Source task (CEO brief, verbatim):**
> תכנון Phase 0 של פרויקט invoicing-receipts — מערכת חשבוניות וקבלות עצמאית ב-`/home/user/SUPER-MESHINE/invoicing-receipts/` (פרויקט pnpm עצמאי, מחוץ ל-workspace של ה-ERP).
>
> הרשימה "חייב להיכנס ל-Phase 0" מה-architect: schema מלא כולל עמודות Phase 2/3, RLS+FORCE+helpers+בדיקות בידוד (12 assertions ב-CI), מונים+issue_document()+טריגרי immutability+audit, יצירת מפתח חתימה בהקמת עסק+KEK, buckets+policies, ג'וב גיבוי חוץ+keepalive, בדיקת race של מספור (20 הפקות מקביליות).
>
> אילוצי סביבה: אין פרויקט Supabase חי — סביבת פיתוח מקומית (Postgres/Supabase CLI local) כך שכל migrations/RLS/tests רצים ב-CI/מקומית; חיבור ה-cloud project הוא שלב נפרד עם המייסד. Stack נעול: Next.js 15 + TypeScript, Tailwind v4 + shadcn/ui, Supabase (Postgres+Auth+Storage), Vitest, Biome. ג'וב הגיבוי (R2/B2) דורש credentials שאין — קוד+תיעוד עם mock ב-CI.
>
> תוצר: פירוק לתתי-משימות (רוב backend-builder; frontend-builder רק אם יש צורך אמיתי — להחליט את הגבול Phase0/1), AC מדידים, קבצים צפויים, תלויות, סדר ביצוע, סיכונים הנדסיים (escalation לארכיטקט אם יש קונפליקט עם ה-ADR — לא לפתור לבד), ו-DoD כולל CI.

**Relevant ADRs (כולם `invoicing-receipts/docs/adr/`, Status: Accepted for Phase 0 build; 17 פריטים A/B/C עדיין דורשים חוו"ד רו"ח/מייסד לפני production — לא חוסמים בנייה):**
- [[001-data-model-and-rls]] (ADR-INV-001) — **Amended (Amendment A, 2026-08-30)** בעקבות ה-escalation שלי. schema מלא (13 טבלאות + 9 enums), RLS על `business_id` דרך `business_members`, `app.current_business_ids()`/`app.has_role()`/`app.create_business()` כ-`SECURITY DEFINER` (whitelist סגור של 7 פונקציות), `FORCE ROW LEVEL SECURITY` **על `business_signing_keys` בלבד** (לא גורף — תוקן ב-Amendment A), 4 roles, 3 נתיבי `service_role` סגורים.
- [[002-immutability-and-numbering]] (ADR-INV-002) — `document_counters` + `UPDATE...RETURNING` (לא `SEQUENCE`), `app.issue_document()` כנתיב הפקה יחיד, trigger immutability עם whitelist default-deny, snapshots, מכונת מצבים `draft→issued/cancelled`.
- [[003-pdf-signing-storage]] (ADR-INV-003) — buckets+policies, `business_signing_keys` + `api/keygen.py` (RSA-3072+X.509 self-issued+envelope encryption) **ב-Phase 0**; צינור הרינדור/חתימה (Chromium+pyHanko) **הוא Phase 1** ולא נכלל כאן. עותק חוץ מוצפן + keepalive — Phase 0.
- `invoicing-receipts/docs/plan.md` — Phase 0 DoD מקורי: "משתמש נרשם, יוצר עסק, מחליף בין עסקים; RLS מוכח בבדיקה."
- ADR-002 / ADR-006 של הבית (multi-tenancy, audit) — **לא** ADR מחייב כאן; ADR-INV-001 §D6 סוטה במודע מ-ADR-006 (audit ב-triggers בלבד, אושר ע"י CEO).

**Codebase state check:**
- `invoicing-receipts/` — **B1-B4 בוצעו ואומתו** ע"י backend-builder (ראו `vault/Meeting Notes/invoicing-receipts-system.md` session "Phase 0 Batch 1"): scaffold מלא, 4 migrations ראשונות בשמות בפועל **`0001_extensions.sql`, `0002_enums.sql`, `0003a_core_tables.sql`, `0003b_document_tables.sql`** (אומת מול `ls` בדיסק — ראו Revision 3), 15 טבלאות, 9 enums, seed `vat_rates`, `businesses_protect_identity_trg`, owner-guard trigger. **B5-B13 (RLS ואילך, migrations `0004`-`0010`) ו-F1-F4 עדיין לא בוצעו.**
- **הבדל stack מהותי מה-ERP:** אין Drizzle/tRPC בפרויקט הזה. ה-ADRs כותבים SQL גולמי + Supabase CLI migrations + Postgres functions (`SECURITY DEFINER`) ישירות — זו בחירת הארכיטקט המחייבת. `api/keygen.py` הוא **Python** — חריג יחיד מה-TypeScript הרגיל של backend-builder.
- **⚠️ אין Docker בסביבת הפיתוח בפועל (לא רק ב-CI היפותטי):** backend-builder דיווח ש-`dockerd` לא עולה (הרשאות `ulimit` בסביבת ה-sandbox). B1-B4 אומתו מול Postgres 16 מקומי (apt) + stub ידני **זמני, לא ל-commit** ל-`auth.users`/`auth.uid()`. זה הספיק ל-B1-B4 כי הן היו זקוקות רק לקיום FK ל-`auth.users` — **B5 ואילך זקוקות ל-`auth.uid()` שמחזיר את המשתמש הנכון *per session/JWT*, לא רק לטבלה קיימת.** זהו סיכון מוגבר (הועלה ל-Open Questions #3).

## ✅ Escalation — RESOLVED (Amendment A, 2026-08-30)

### הבקשה המקורית (לרשומה)

בקריאת ADR-INV-001 מצאתי **שני פערי spec** ו**סתירה אחת** ב-RLS design שלא היו בסמכותי לפתור:
1. אין RLS policy מוגדרת לטבלת `businesses` עצמה.
2. סתירה בבדיקת ה-CI של D7 — `businesses` חסרת `business_id` ואינה ברשימה הסגורה, כלומר הבדיקה כפי שהוגדרה תמיד הייתה נכשלת עליה.
3. בעיית ביצה-ותרנגולת ב-`bm_manage` policy — אין מנגנון bootstrap ל-owner ראשון ב-`business_members` בעת יצירת עסק חדש.

### תשובת הארכיטקט — Amendment A (Amendment Log בראש ADR-INV-001)

הארכיטקט אישר את שלושת הפערים **וזיהה פער רביעי חמור יותר** מאותו סעיף שלא דיווחתי עליו:

| # | הפער | התיקון |
|---|---|---|
| A-1 | אין RLS policies ל-`businesses` | §D3.1: `businesses_read` (SELECT לחברים דרך `app.current_business_ids()`), `businesses_update` (UPDATE ל-owner בלבד דרך `app.has_role`). **אין policy ל-INSERT ואין ל-DELETE — במכוון.** trigger `businesses_protect_identity_trg` חוסם שינוי ב-`created_by`/`tax_id`/`entity_type` גם דרך ה-UPDATE policy. |
| A-2 | סתירת ה-CI ב-D7 | §D7 נכתב מחדש כ**מפת scoping בת 4 קטגוריות**: (1) Business-scoped [`business_id`] — כל שאר הטבלאות כולל `business_signing_keys`/`audit_log`/`business_members`; (2) Scope-root [`id`] — `businesses` בלבד; (3) Self-scoped [`id=auth.uid()`] — `users`; (4) Reference data גלובלי — `vat_rates`. קטגוריות 2-4 הן רשימה סגורה, הוספה אליהן מחייבת עדכון ADR. |
| A-3 | ביצה-ותרנגולת ב-`bm_manage` | אושר **`app.create_business()`** ב-`SECURITY DEFINER` (§D10, פירוט מלא ב-subtask B9 למטה). אין policy bootstrap, אין נתיב service_role רביעי. |
| A-4 | **⚠️ פער שלא דווחתי:** `FORCE ROW LEVEL SECURITY` הגורף מ-§D3 המקורי שובר את **כל** דפוס ה-`SECURITY DEFINER` של ה-ADR | §D3.2 (חדש): **FORCE יורד מכל הטבלאות פרט ל-`business_signing_keys`**. תחת FORCE, גם בעלת הטבלה (`postgres`, שרצות תחתיה כל פונקציות ה-definer) כפופה ל-policies — ומכיוון ש-`postgres` אינו חבר ב-`authenticated`, שום policy לא הייתה חלה עליו, והתוצאה הייתה **דחייה גורפת**: `app.current_business_ids()` הייתה מחזירה 0 שורות (נעילת המערכת), `app.issue_document()` לא הייתה יכולה לכתוב ל-`document_counters`, וה-audit trigger לא היה יכול לכתוב ל-`audit_log`. `business_signing_keys` היא החריג הנכון כי הקורא הלגיטימי היחיד שלה הוא `service_role` (`BYPASSRLS`, גובר על FORCE) — אף פונקציית definer לא נוגעת בה. **בדיקת CI (ב) התהפכה:** FORCE חייב להיות מוחל על **בדיוק** `business_signing_keys` ועל שום טבלה אחרת. |
| A-5 | (קוסמטי) D7 הניחה טבלת `_migrations` | הוסרה — Supabase CLI כותב ל-`supabase_migrations.schema_migrations`, מחוץ ל-`public`. |

**Whitelist סגור של `SECURITY DEFINER` functions (בדיקת CI חדשה, (ה)):** `app.current_business_ids()`, `app.has_role(uuid,member_role[])`, `app.create_business(text,entity_type,text,text,text)`, `app.issue_document(uuid,date)`, `app.set_start_number(uuid,document_type,integer,bigint)`, `app.send_document(uuid,text[])` (שמורה ל-Phase 1, מותר שלא תהיה קיימת עדיין), `app.audit_trigger()`. **כל פונקציית definer חדשה שלא ברשימה = build fail.**

**השפעה על התוכנית:** B9 ו-F3 משוחררות. B6 עודכן במלואו. **פער חמישי משלי שהתגלה תוך כדי הסנכרון:** לא היה subtask ל-storage buckets+policies למרות שזה היה ב-"must-have" של ה-CEO — נוסף כ-B10 (Revision 1). **פער שישי (לא architect-level):** ניסיתי ב-Revision 2 ליישר מספור migrations מול מה שחשבתי שבוצע בפועל, אך התבססתי על מידע חלקי/מיושן מה-vault — **תוקן ב-Revision 3** לפי בדיקה ישירה של הדיסק ע"י ה-CEO. מספור B5-B13 חזר בפועל להיות זהה למה שנקבע ב-Revision 1.

## Decomposition

**עקרון סדר:** backend-builder עובד בשרשרת רציפה (B1→B14) — מספור ה-migrations **תואם את מה שנוצר בפועל בדיסק** (`0001_extensions`, `0002_enums`, `0003a_core_tables`, `0003b_document_tables`) **וממשיך** עם `0004_rls_helpers` → `0005_rls_policies` → `0006_audit` → `0007_immutability` → `0008_issue_function` → `0009_create_business` → `0010_storage_buckets`. frontend-builder עובד ב-4 משימות שרובן יכולות לרוץ **במקביל** לעבודת ה-backend, עם 3 נקודות סנכרון (F2 צריך B3, F3 צריך B9/`0009_create_business`, F4 צריך F3). Overall: **14** backend subtasks + 4 frontend subtasks = **18**.

**הכרעת גבול Phase 0/1 עבור frontend (ללא שינוי):** שלד אפליקציה מינימלי + auth + יצירת עסק + business switcher — **ולא** יותר. עורך המסמכים, קטלוג הפריטים, הדשבורד, ורינדור ה-PDF **נשארים Phase 1** במלואם.

---

### Subtask B1 — Project scaffold & tooling — **✅ DONE**

- **Assignee:** `backend-builder`
- **Status:** בוצע ואומת. ראו `vault/Meeting Notes/invoicing-receipts-system.md` § "Phase 0 Batch 1" לפרטי ביצוע מלאים.
- **מה בוצע בפועל (לרשומה):** Next.js 15.5.24, Tailwind v4, Biome 2.5.11, Vitest 4, `supabase` CLI כ-devDependency. **תוספת שלא הייתה ב-spec המקורי:** `pnpm-workspace.yaml` מקומי נדרש כי בלעדיו `pnpm install` "מטפס" ל-workspace של שורש ה-ERP — תועד כ-side-effect ל-כל פרויקט עצמאי עתידי מתחת לשורש. `noRestrictedImports` על `**/service-role/**` נבדק ידנית (חוסם import חיצוני, מתיר יחסי-פנימי).
- **Files (actual):** `package.json`, `pnpm-workspace.yaml` (חדש, לא היה ב-plan המקורי), `tsconfig.json`, `biome.json`, `vitest.config.ts`, `.env.example`, `src/app/layout.tsx`/`page.tsx`, `src/server/service-role/client.ts` (POC).
- **Acceptance — verified:** `pnpm install`/`build`/`typecheck`/`lint`/`check`/`format`/`test` (3/3) כולם exit 0; `pnpm dev` מגיב 200 על `localhost:3000`; `noRestrictedImports` נבדק ועובד.
- **Dependencies:** none.
- **Invariants applied:** N/A.

### Subtask B2 — Migrations 0001-0002: extensions + enums — **✅ DONE**

- **Assignee:** `backend-builder`
- **Status:** בוצע ואומת. `0001_extensions.sql` (`pgcrypto`, `citext`), `0002_enums.sql` (9 enums) + down מקבילים — עלו/ירדו נקי על Postgres 16 מקומי.
- **Files (actual):** `invoicing-receipts/supabase/migrations/0001_extensions.sql`, `0002_enums.sql` + downs.
- **Dependencies:** B1.
- **Invariants applied:** N/A.

### Subtask B3 — Migration 0003a: core tables (global + business + membership + signing key + catalog + consent) — **✅ DONE**

**עדכון מספור (Revision 3, מתקן את Revision 2 השגוי):** בוצע בפועל כ-`0003a_core_tables.sql` — בדיוק כפי שתוכנן ב-Revision 1. Revision 2 טעה בהנחה שזה קובץ `0003_core_tables.sql` יחיד; ה-CEO אימת מול הדיסק שהשם הנכון הוא `0003a`. `businesses_protect_identity_trg` (מ-Amendment A §D3.1) נוסף כבר כאן, כי ה-Amendment התפרסם תוך כדי העבודה על ה-batch הזה — ה-RLS policies עצמן (D3.1 SELECT/UPDATE) עדיין לא, אלו ב-B6.

- **Assignee:** `backend-builder`
- **Status:** בוצע ואומת. 8 טבלאות: `users`+`on_auth_user_created` trigger, `vat_rates`+seed, `businesses`+**`businesses_protect_identity_trg`**, `business_members`+owner-guard trigger (`INV_NO_OWNER`), `business_signing_keys`, `customers`, `items`, `customer_document_consents`. `set_updated_at()` trigger (plpgsql פשוט, במקום extension `moddatetime` שה-ADR מציע ב-Implementation Note #4 — שקול פונקציונלית, החלטת builder-level).
- **Files (actual):** `invoicing-receipts/supabase/migrations/0003a_core_tables.sql` + down.
- **Acceptance — verified:** 8 טבלאות + כל ה-constraints/indexes קיימים; owner-guard נכשל כצפוי (3/3 מקרים כולל UPDATE ל-editor); `businesses_protect_identity_trg` חוסם `created_by`/`tax_id`/`entity_type` (3/3) ומתיר `legal_name` (control חיובי); `on_auth_user_created` יוצר `public.users` נכון כולל fallback לשם מ-email.
- **Dependencies:** B2.
- **Invariants applied:** multi-tenancy ✅ (schema בלבד, RLS ב-B6), migration rollback ✅.

### Subtask B4 — Migration 0003b: document tables (documents, lines, payments, counters, allocation, public links, audit_log) — **✅ DONE**

**עדכון מספור (Revision 3, מתקן את Revision 2 השגוי):** בוצע בפועל כ-`0003b_document_tables.sql` — בדיוק כפי שתוכנן ב-Revision 1, לא `0004_document_tables.sql` כפי שכתבתי בטעות ב-Revision 2.

- **Assignee:** `backend-builder`
- **Status:** בוצע ואומת. 7 טבלאות, **ללא שום RLS statement** (גם לא ה-RLS ה"פנימי" ל-`business_signing_keys`/`document_counters`/`audit_log` שה-ADR מציג inline בסקשן ה-Schema) — decision מתועדת: `document_counters` הייתה תלויה ב-`app.current_business_ids()` שלא קיימת עד B5, אז כל ה-RLS (enable/force/policies) הועבר במלואו ל-migration אחת אטומית (B6, `0005_rls_policies.sql`).
- **Files (actual):** `invoicing-receipts/supabase/migrations/0003b_document_tables.sql` + down.
- **Acceptance — verified:** 15 טבלאות סה"כ (עם B3) קיימות; `signed_total` מחושב נכון (רגיל=118→118, credit_note=100→-100); `doc_type_allowed_for_entity`/`patur_has_no_vat` נאכפים; down/up roundtrip מלא מאומת פעמיים (per-migration + roundtrip מלא).
- **Dependencies:** B3.
- **Invariants applied:** multi-tenancy ✅ (עמודות `business_id`+FK מורכב, RLS בפועל ב-B6), migration rollback ✅.

### Subtask B5 — Migration 0004: RLS helper functions

**מספור (Revision 3 — חזרה ל-Revision 1):** `0004_rls_helpers.sql`. **הבא בתור לביצוע — פנוי, אין קובץ `0004` קיים בדיסק.**

- **Assignee:** `backend-builder`
- **Spec:** יצירת schema `app` (revoke מ-`anon`/`authenticated`), `app.current_business_ids()` ו-`app.has_role(uuid, member_role[])` בדיוק כפי שמוגדרות ב-ADR-INV-001 §D3 — `SECURITY DEFINER`, `STABLE`, `set search_path = public, pg_temp`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0004_rls_helpers.sql` + down מקביל
- **Acceptance criteria:**
  - `select proname, prosecdef, provolatile from pg_proc where proname in ('current_business_ids','has_role')` מראה `prosecdef=true` ו-`provolatile='s'` לשתיהן.
  - `grant`/`revoke` על schema `app` נבדק: `anon`/`authenticated` **לא** יכולים `select`/`execute` ישירות על אובייקטים ב-`app`.
  - **⚠️ בדיקת יחידה קריטית (ראו Open Question #3):** משתמש בדיקה A עם חברות בעסק X → `app.current_business_ids()` מחזיר `{X}` בלבד. **זו הבדיקה הראשונה שבאמת תלויה ב-`auth.uid()` שמחזיר ערך נכון per-session** — ה-stub הפשוט שהספיק ל-B1-B4 (קיום שורה ב-`auth.users`) **לא מספיק כאן**. backend-builder צריך פתרון stub/local-Supabase שמדמה `set_config('request.jwt.claims', ...)` או מקביל, ולתעד אותו ב-PR לפני שממשיכים ל-B6+.
- **Dependencies:** B3 (`business_members`).
- **Invariants applied:** multi-tenancy ✅ (זו תשתית האכיפה).

### Subtask B6 — Migration 0005: RLS policies (**עודכן במלואו — Amendment A**)

**מספור (Revision 3 — חזרה ל-Revision 1):** `0005_rls_policies.sql`.

- **Assignee:** `backend-builder`
- **Status:** משוחרר (Amendment A).
- **Spec:** `enable row level security` על **כל** הטבלאות ב-`public` (**ללא `force`** — Amendment A-4, §D3.2). `force row level security` **רק** על `business_signing_keys`. יישום policies:
  - תבנית `customers_read`/`customers_write` (ואותה תבנית ל-`items`, `customer_document_consents`, `documents`, `document_lines`, `payments`, `allocation_requests`, `document_public_links`).
  - `business_members`: `bm_self`, `bm_peers`, `bm_manage` (D3) — `bm_manage` דורשת owner קיים; ה-bootstrap ל-owner הראשון עובר ב-`app.create_business()` (B9/`0009_create_business`), לא כאן.
  - `document_counters` — SELECT בלבד, **אין** policy כתיבה.
  - `audit_log` — SELECT בלבד, **אין** policy INSERT/UPDATE/DELETE כלל.
  - `business_signing_keys` — enable+**force**, **אפס policies**.
  - **`businesses` (D3.1, Amendment A-1):** `businesses_read` (SELECT ל-`id in (select app.current_business_ids())`), `businesses_update` (UPDATE ל-`app.has_role(id, ['owner'])`), **ללא** INSERT, **ללא** DELETE. **`businesses_protect_identity_trg` כבר קיים מ-B3/`0003a` — B6 לא יוצר אותו מחדש, רק מוסיף את ה-policies שמסתמכות עליו.**
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0005_rls_policies.sql` + down מקביל
- **Acceptance criteria:**
  - `select relrowsecurity from pg_class where relname in (<כל 15 הטבלאות>)` = `true` לכולן.
  - **`select relname, relforcerowsecurity from pg_class where relname in (<כל 15>)` מראה `force=true` אך ורק ל-`business_signing_keys`; כל שאר ה-14 מראות `force=false`.**
  - `business_signing_keys`: `select count(*) from pg_policies where tablename='business_signing_keys'` = 0.
  - `businesses`: `select cmd from pg_policies where tablename='businesses'` מחזיר בדיוק `{SELECT, UPDATE}`.
  - `document_counters`, `audit_log`: policy SELECT בלבד.
  - `UPDATE businesses SET tax_id='000000000'` (owner) נכשל בגלל הטריגר הקיים; `UPDATE businesses SET display_name='...'` מצליח.
  - בדיקת non-recursion: `bm_peers` — 100 שאילתות רצופות, כולן < 100ms.
  - `INSERT INTO businesses` ישיר מ-`authenticated` נכשל; `DELETE FROM businesses` נכשל.
- **Dependencies:** B4, B5.
- **Invariants applied:** multi-tenancy ✅ (מלא — כולל `businesses`).

### Subtask B7 — Migrations 0006+0007: audit trigger + immutability triggers

**מספור (Revision 3 — חזרה ל-Revision 1):** `0006_audit.sql` + `0007_immutability.sql`.

- **Assignee:** `backend-builder`
- **Spec:** (א, `0006_audit.sql`) `app.audit_trigger()` — קוראת `auth.uid()`, `current_setting('request.jwt.claims', true)` ל-email, `current_setting('app.request_id', true)`; מוחלת על כל טבלה עם `business_id` **וגם על `businesses`**, **חוץ מ**-`business_signing_keys`/`audit_log`; `app.enforce_audit(regclass)` helper. `audit_log_immutable_trg`. (ב, `0007_immutability.sql`) `app.documents_immutable()` לפי ADR-INV-002 §D3 (whitelist default-deny, הסרת שדות PDF כש-`pdf_status='ready'`). `documents_immutable_trg`. `app.child_rows_locked()` על `document_lines`/`payments`. Trigger נעילה על `allocation_requests`. Trigger `BEFORE INSERT ON documents` שממלא `business_entity_type` snapshot.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0006_audit.sql` + down
  - `invoicing-receipts/supabase/migrations/0007_immutability.sql` + down
- **Acceptance criteria:**
  - `app.enforce_audit()` הוחל על כל הטבלאות ה-business_id-bearing **וגם על `businesses`**, חוץ מ-2 החריגים.
  - `UPDATE businesses SET display_name='X'` יוצר שורת `audit_log`.
  - `UPDATE audit_log SET action='x'` נכשל, גם תחת `service_role`.
  - מסמך `issued`: שינוי שדה לא-whitelisted נכשל (`INV_IMMUTABLE_FIELDS`); `paid_amount` מצליח; DELETE נכשל (`INV_IMMUTABLE_DELETE`).
  - `pdf_status='ready'`: שדות PDF ננעלים.
  - `INSERT INTO document_lines` על מסמך `issued` נכשל.
  - `business_entity_type` snapshot אוטומטי נכון.
- **Dependencies:** B4, B5, B6.
- **Invariants applied:** audit log ✅ (כולל `businesses`), migration rollback ✅.

### Subtask B8 — Migration 0008: `app.issue_document()` + `app.seed_for()` + `app.set_start_number()`

**מספור (Revision 3 — חזרה ל-Revision 1):** `0008_issue_function.sql`. חתימת הפונקציה חייבת להיות מדויקת מילה-במילה — נבדקת מול whitelist סגור ב-B13.

- **Assignee:** `backend-builder`
- **Spec:** מימוש מדויק של ADR-INV-002 §D1-D2: הקצאת מספר ב-`UPDATE document_counters ... RETURNING`, `app.seed_for()` (continuous/yearly), 11 הצעדים המלאים (נעילת מסמך, אימות חברות/role, אימות draft, רענון `business_entity_type`, אימותי תוכן כולל `business_signing_keys` פעיל [`INV_NO_SIGNING_KEY`], חישוב מחדש מ-`document_lines`+`vat_rates`, snapshots, הקצאת מספר+`display_number`, מעבר סטטוס, עדכון `credited_amount` באב, audit_log מפורש). `app.set_start_number()` — `SECURITY DEFINER`, רק כש-`next_number=start_number`, רק owner. מיפוי `INV_*` ל-`src/lib/errors.ts`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0008_issue_function.sql` + down
  - `invoicing-receipts/src/lib/errors.ts` (new)
- **Acceptance criteria:** *(ללא שינוי מהותי)*
  - `issue_document()` תקינה → `document_number=1`, `status='issued'`, snapshots מלאים; שנייה → `document_number=2`.
  - `INV_ALREADY_ISSUED`/`INV_NO_SIGNING_KEY`/`INV_PAYMENTS_MISMATCH`/`INV_CREDIT_EXCEEDS_PARENT` נבדקים.
  - סכומים תמיד נגזרים מ-`document_lines`.
  - `set_start_number` על סדרה פעילה נכשל.
- **Dependencies:** B7, B3 (vat_rates seed).
- **Invariants applied:** audit log ✅, migration rollback ✅.

### Subtask B9 — Migration 0009 + `api/keygen.py` + `POST /api/businesses` (**עודכן במלואו — משוחרר, Amendment A**)

**מספור (Revision 3 — חזרה ל-Revision 1):** `0009_create_business.sql`.

- **Assignee:** `backend-builder`
- **Status:** משוחרר. `app.create_business()` כתובה במלואה ב-ADR-INV-001 §D10.
- **Spec:**
  1. **`0009_create_business.sql`** — `app.create_business(p_legal_name text, p_entity_type entity_type, p_tax_id text, p_tax_id_type text default 'vat', p_display_name text default null) returns businesses`, `SECURITY DEFINER`. בדיוק לפי §D10: `INV_UNAUTHENTICATED`, `INV_NO_PROFILE`, מגבלת 10 עסקים למשתמש (`INV_BUSINESS_LIMIT`), `INV_BAD_TAX_ID`, INSERT ל-`businesses` עם `exception when unique_violation` → `INV_TAX_ID_EXISTS`, INSERT ל-`business_members(role='owner')`, INSERT מפורש ל-`audit_log`. `revoke ... from public, anon; grant ... to authenticated`.
  2. **`api/keygen.py`** (Python) — RSA-3072, X.509 self-issued (ADR-INV-003 §D4), envelope encryption (DEK+`SIGNING_MASTER_KEK_V1`), INSERT ל-`business_signing_keys`.
  3. **`POST /api/businesses`** — קורא ל-`supabase.rpc('create_business', {...})`, ורק אחרי הצלחה קורא בנפרד ל-`api/keygen.py` (Implementation Note #10 — לא לאחד).
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0009_create_business.sql` + down
  - `invoicing-receipts/api/keygen.py` (new)
  - `invoicing-receipts/requirements.txt` (new)
  - `invoicing-receipts/src/app/api/businesses/route.ts` (new)
  - `invoicing-receipts/src/lib/errors.ts` (edit — מוסיף `INV_UNAUTHENTICATED`, `INV_NO_PROFILE`, `INV_BUSINESS_LIMIT`, `INV_BAD_TAX_ID`, `INV_TAX_ID_EXISTS`, `INV_NO_SIGNING_KEY`)
- **Acceptance criteria:**
  - `create_business()` מוצלחת יוצרת בדיוק 2 שורות באטומיות; כשל מלאכותי אחרי ה-INSERT הראשון ⇒ 0 שורות + `tax_id` פנוי.
  - קריאה 11 מאותו `created_by` נכשלת עם `INV_BUSINESS_LIMIT`.
  - `tax_id` כפול נכשל עם `INV_TAX_ID_EXISTS` (לא `unique_violation` גולמי).
  - `POST /api/businesses` תקין: RPC ואז keygen נפרד; שורת `business_signing_keys(is_active=true)` תוך ≤5 שניות.
  - `certificate_pem` תקף (X.509, `notAfter`≈+10y); אין מפתח פרטי גלוי בעמודות ה-ciphertext.
  - כשל ב-keygen לא מפיל את יצירת העסק ולא יוצר שורת מפתח חלקית.
- **Dependencies:** B6, B8 (סדר migrations).
- **Invariants applied:** multi-tenancy ✅, audit ✅.

### Subtask B10 — Migration 0010: Storage buckets + policies **(חדש — נוסף ב-Revision 1)**

**מספור (Revision 3 — חזרה ל-Revision 1):** `0010_storage_buckets.sql`.

- **Assignee:** `backend-builder`
- **Spec:** bucket `documents` (פרטי, SELECT בלבד ל-`authenticated` לפי `(storage.foldername(name))[1]::uuid in (select app.current_business_ids())`, ללא INSERT/UPDATE/DELETE), bucket `business-assets` (SELECT+INSERT ל-owner). `chromium` **לא** נכלל (Phase 1).
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0010_storage_buckets.sql` + down
- **Acceptance criteria:**
  - שני ה-buckets `public=false`.
  - policies מדויקות: 1 SELECT ל-`documents`, SELECT+INSERT ל-`business-assets`, אין UPDATE/DELETE על אף אחד.
  - בדיקת בידוד: SELECT חוצה-עסק על `documents` נכשל.
- **Dependencies:** B9.
- **Invariants applied:** multi-tenancy ✅.

### Subtask B11 — Isolation test suite (**עודכן — Amendment A, 17 assertions**)

- **Assignee:** `backend-builder`
- **Spec:** שני משתמשי בדיקה (A, B), שני עסקים (X, Y): 12 assertions בסיסיות (CRUD חוצה-עסק על `customers`/`items`/`documents`) + 2 חדשות (SELECT/UPDATE ישיר על `businesses` של B) + 3 Amendment-A (INSERT ישיר ל-`businesses` נכשל, DELETE נכשל, `create_business()` אטומית).
- **Files (predicted):**
  - `invoicing-receipts/tests/isolation.test.ts` (new)
- **Acceptance criteria:**
  - **17/17 assertions** ירוקות.
  - הבדיקה נכשלת (red) אם FORCE מוסר מ-`business_signing_keys`.
  - < 10 שניות.
- **Dependencies:** B6, B9, B10.
- **Invariants applied:** multi-tenancy ✅.

### Subtask B12 — Numbering race test (20 concurrent issues)

- **Assignee:** `backend-builder`
- **Spec:** 20 טיוטות תקינות, 20 קריאות מקבילות ל-`issue_document()`. מזריק `business_signing_keys` דמה ישירות (בלי keygen.py אמיתי).
- **Files (predicted):**
  - `invoicing-receipts/tests/numbering-race.test.ts` (new)
- **Acceptance criteria:**
  - `count(distinct document_number)=20`, `max-min=19`, `next_number` הסופי נכון, המשכיות ברצף בהרצה חוזרת.
- **Dependencies:** B8.
- **Invariants applied:** N/A ישיר.

### Subtask B13 — CI pipeline (GitHub Actions) (**עודכן — 5 בדיקות מטא**)

- **Assignee:** `backend-builder`
- **Spec:** `ci.yml` — מריץ את כל ה-migrations בסדר (`0001`, `0002`, `0003a`, `0003b`, `0004`-`0010` — 11 קבצים סה"כ), down/up roundtrip, **5** בדיקות מטא: (א) RLS מופעל בכל טבלה; (ב) **FORCE בדיוק על `business_signing_keys`**; (ג) **scoping map 4 קטגוריות**; (ד) audit trigger על כל טבלה רלוונטית כולל `businesses`; (ה) **whitelist סגור של 7 `SECURITY DEFINER` functions** (`app.send_document` מותר שלא קיים עדיין). מריץ B11 (17 assertions) + B12 (race). מריץ lint/typecheck/test/build.
- **Files (predicted):**
  - `invoicing-receipts/.github/workflows/ci.yml`, `scripts/ci-schema-checks.sql`, `scripts/migrate-down-up-roundtrip.sh`
- **Acceptance criteria:**
  - 5/5 שאילתות CI מחזירות 0 שורות.
  - roundtrip מלא כולל `0009_create_business`/`0010_storage_buckets`.
  - B11+B12 ירוקות ב-CI; workflow < 8 דקות.
  - **⚠️ תלוי בהחלטת Open Question #3 (סביבת Docker):** אם ה-CI runner גם הוא ללא Docker, backend-builder צריך אסטרטגיה חלופית ל-`auth.uid()`/`auth.users` תואמת-התנהגות — לא רק stub-קיום-שורה.
- **Dependencies:** B1-B12.
- **Invariants applied:** כל 4 ה-invariants.

### Subtask B14 — Ops jobs: daily keepalive + weekly encrypted backup + monthly restore-test skeleton

- **Assignee:** `backend-builder`
- **Spec:** `keepalive.yml` (cron יומי), `backup.yml` (`pg_dump`+`age`+R2, dry-run ב-CI), `restore-test.yml` (skeleton). `docs/ops-runbook.md`.
- **Files (predicted):**
  - `invoicing-receipts/.github/workflows/keepalive.yml`, `backup.yml`, `restore-test.yml`, `scripts/backup.sh`, `docs/ops-runbook.md`
- **Acceptance criteria:**
  - workflows תקפים ורצים ב-CI (מדומה) exit 0; `backup.sh` round-trip אמיתי; runbook עם רשימת secrets מדויקת.
- **Dependencies:** B13.
- **Invariants applied:** N/A ישיר (תשתית DR).

---

### Subtask F1 — App shell: shadcn/ui init + RTL layout + Supabase client wiring

*(ללא שינוי)*

- **Assignee:** `frontend-builder`
- **Spec:** `shadcn/ui` init, layout `dir="rtl" lang="he"`, logical properties, טוקן צבע בסיסי. `src/lib/supabase/browser.ts`+`server.ts`.
- **Files (predicted):** `src/app/layout.tsx`, `src/components/ui/*`, `src/lib/supabase/{browser,server}.ts`, `tailwind.config.ts`/`globals.css`.
- **Acceptance criteria:** RTL תקין, אין logical-property violations, client factories מכוסים בבדיקות, ווידוא דפדפן.
- **Dependencies:** B1.
- **Invariants applied:** N/A.

### Subtask F2 — Auth flow: signup/login/logout

*(ללא שינוי)*

- **Assignee:** `frontend-builder`
- **Spec:** `/login`, `/signup`, middleware הפניה, logout.
- **Files (predicted):** `src/app/(auth)/{login,signup}/page.tsx`, `src/middleware.ts`, `src/components/auth/logout-button.tsx`.
- **Acceptance criteria:** הרשמה יוצרת `auth.users`+`public.users`; הפניות נכונות; logout מנקה session.
- **Dependencies:** F1, B3.
- **Invariants applied:** N/A.

### Subtask F3 — Business creation form (**עודכן — משוחרר, Amendment A**)

- **Assignee:** `frontend-builder`
- **Status:** משוחרר.
- **Spec:** טופס `/businesses/new` (react-hook-form+zod), שולח ל-`POST /api/businesses` (B9/`0009_create_business`) — **ה-route קורא RPC ואז keygen, לא ה-frontend**. Spinner עד מוכן. שגיאות `INV_*` בעברית ידידותית.
- **Files (predicted):** `src/app/(app)/businesses/new/page.tsx`, `src/lib/schemas/business.ts`.
- **Acceptance criteria:** יצירה מוצלחת מנווטת נכון; `tax_id` לא תקין נחסם client-side; עסק 11 מציג `INV_BUSINESS_LIMIT`; `tax_id` כפול מציג `INV_TAX_ID_EXISTS`; p95<5s.
- **Dependencies:** F2, B9.
- **Invariants applied:** N/A ישיר.

### Subtask F4 — Business switcher

*(ללא שינוי)*

- **Assignee:** `frontend-builder`
- **Spec:** Dropdown עסקים (`business_members` דרך RLS), ניווט מנקה state.
- **Files (predicted):** `src/components/business-switcher.tsx`, `src/app/(app)/[businessId]/layout.tsx`.
- **Acceptance criteria:** 2 עסקים מוצגים נכון; החלפה ללא דליפה; עסק יחיד ללא dropdown מיותר.
- **Dependencies:** F3.
- **Invariants applied:** multi-tenancy ✅ (UI proof).

---

## Open questions / risks

1. ~~RLS ל-`businesses` + bootstrap owner~~ — **נפתר (Amendment A).**
2. **Python בתוך backend-builder:** `api/keygen.py` הוא Python. סיכון תזמון, לא חסימה.
3. **אין Docker כלל בסביבת הפיתוח הנוכחית** (לא רק שאלת-CI) — `dockerd` נכשל, `supabase start` לא רץ בפועל. B1-B4 עקפו זאת עם Postgres 16 מקומי + stub טבלאי ל-`auth.users`. **B5 ואילך זקוקות ל-`auth.uid()` נכון per-session** (לא רק לטבלה קיימת) — stub טבלאי בלבד לא מספיק. backend-builder חייב לפתור זאת (למשל `set_config('request.jwt.claims', ..., true)` + פונקציית `auth.uid()` תואמת) **לפני** שממשיך ל-B5, ולתעד את הפתרון ב-PR. אותה שאלה חוזרת ב-B13 (CI runner) — אם גם שם אין Docker, נדרשת אותה אסטרטגיה.
4. ~~`_migrations` whitelist ב-D7~~ — **נפתר (Amendment A-5).**
5. **בחירת R2 על פני B2** (B14) — החלטת builder-level שלי.
6. **היקף frontend Phase 0** — הכרעתי לכלול F1-F4 מינימלי. נקודת יידוע ל-CEO/מייסד, לא חסימה.
7. **משמעת ה-SECURITY DEFINER whitelist הסגור** — כל פונקציה חדשה עם `SECURITY DEFINER` (גם accidental) תיפול ב-CI (ה) עד עדכון ADR. מכוון, לא לעקוף.
8. ~~מספור migrations לא תאם בין ה-plan למה שבוצע בפועל~~ — **נפתר סופית ב-Revision 3** (אומת ישירות מול `ls` בדיסק ע"י ה-CEO: `0003a`/`0003b` בפועל, לא `0003`/`0004`). Revision 2 שלי טעה כי הסתמך על ניסוח לא-חד-משמעי ב-vault Meeting Notes ("קובץ יחיד `0003_core_tables.sql`") במקום לבדוק את הדיסק ישירות. **לקח קבוע:** future revisions הנוגעות לשמות קבצים בפועל — לוודא מול `ls`/`git show`, לא רק מול תיאור טקסטואלי ב-vault.
9. **commit אוטומטי `wip(...)` (`416c9bc`)** נוצר ע"י מנגנון checkpoint של הסביבה, לא ע"י backend-builder במכוון — ה-CEO צריך להיות מודע לפני commit/push סופי של ה-batch.

## Escalations needed

- [x] **לארכיטקט — נפתר (Amendment A, 2026-08-30):** RLS ל-`businesses`, סתירת D7, bootstrap owner, FORCE הגורף. ראו סעיף ✅ Escalation למעלה.
- אין escalation פתוח נוסף לארכיטקט.
- אין escalation ל-CEO/מייסד שחוסם. פריט #6 (היקף frontend) נשאר נקודת יידוע. פריט #9 (commit אוטומטי) — יידוע טכני ל-CEO לפני push.

## Estimated rounds

- **Workers:** ~6-8 rounds נותרו — backend-builder: B5-B8 (RLS+audit+immutability+issue_function, migrations `0004`-`0008`) כ-2-3 batches, B9-B11 (create_business+keygen+storage+tests, migrations `0009`-`0010`) כ-2 batches, B13-B14 (CI+ops) batch אחרון. frontend-builder: F1-F2 (יכולים לרוץ כבר עכשיו, במקביל, לא תלויים ב-B5+), F3-F4 אחרי B9.
- **Total estimated wall-clock through review:** 3-5 ימי עבודה. הסיכון היחיד שעלול להאט: סוגיית ה-Docker/`auth.uid()` (Open Question #3) אם היא תתגלה כחוסמת יותר מהצפוי ב-B5.

## Plan Revisions

### Revision 1 — 2026-08-30 — Amendment A applied

**טריגר:** תשובת הארכיטקט ל-escalation שהעליתי ב-Phase 1 (RLS ל-`businesses`, סתירת D7, bootstrap owner) — ADR-INV-001 עודכן עם Amendment Log + §D3.1/§D3.2/§D7 (מחדש)/§D10, וזוהה גם פער רביעי (FORCE גורף שובר SECURITY DEFINER).

**מה השתנה:** B6 (RLS policies) נכתב מחדש; B7 (audit) — כולל `businesses`; B9 (create_business+keygen) שוחרר מ-BLOCKED; B10 (חדש) — storage buckets, פער שזוהה תוך כדי סנכרון; B11 (isolation) עודכן מ-12 ל-17 assertions; B13 (CI) עודכן מ-4 ל-5 בדיקות מטא; F3 שוחרר מ-BLOCKED. B1-B4 לא שונו. מספור migrations שנקבע כאן: `0001`, `0002`, `0003a`, `0003b`, `0004_rls_helpers`, `0005_rls_policies`, `0006_audit`, `0007_immutability`, `0008_issue_function`, `0009_create_business`, `0010_storage_buckets`.

### Revision 2 — 2026-08-30 — Migration numbering "sync" (שגוי — בוטל ב-Revision 3)

**טריגר:** בקריאת `vault/Meeting Notes/invoicing-receipts-system.md` (session log של backend-builder) הבנתי בטעות ש-B3/B4 בוצעו כקבצים `0003_core_tables.sql`/`0004_document_tables.sql` יחידים (לא `0003a`/`0003b`), והזחתי את כל מספרי ה-migrations מ-B5 ואילך ב-+1 בהתאם.

**מה קרה בפועל:** הניסוח ב-vault Meeting Notes היה מטעה/מצב-ביניים — ה-CEO בדק ישירות מול הדיסק ואישר שהקבצים הם `0003a_core_tables.sql`/`0003b_document_tables.sql`, בדיוק כפי שתוכנן ב-Revision 1. **כל ההזחה שביצעתי ב-Revision 2 הייתה מיותרת ושגויה — בוטלה במלואה ב-Revision 3.**

**לקח:** כשמידע מ-vault (טקסט חופשי, נכתב ע"י סוכן אחר) סותר-לכאורה תכנון קודם, יש לאמת מול מקור ראשוני (`ls`, `git show`, `cat`) **לפני** שמבצעים שינוי מספור שמשפיע על 6+ subtasks — לא להסתמך על תיאור טקסטואלי בלבד.

### Revision 3 — 2026-08-30 — CEO factual correction: actual files are `0003a`/`0003b`; B5+ numbering reverted to Revision 1

**טריגר:** ה-CEO בדק ישירות בדיסק ובקומיט ואישר שהקבצים בפועל הם `0003a_core_tables.sql` ו-`0003b_document_tables.sql` — כלומר `0004` **פנוי**, וההזחה שביצעתי ב-Revision 2 הייתה מבוססת על מידע שגוי.

**מה השתנה:**
- B3, B4 — שמות הקבצים תוקנו בחזרה ל-`0003a_core_tables.sql`/`0003b_document_tables.sql` (בוטלה הטעות מ-Revision 2).
- B5-B10 — **כל מספרי המיגרציה חזרו למה שנקבע ב-Revision 1** (לא ל-Revision 2): `0004_rls_helpers`, `0005_rls_policies`, `0006_audit`, `0007_immutability`, `0008_issue_function`, `0009_create_business`, `0010_storage_buckets`.
- כל ההפניות הצולבות (B6→B9, B9→F3, B13 roundtrip) עודכנו למספור הנכון.
- שום שינוי מהותי אחר ל-scope/AC/dependencies של אף subtask — כפי שהתבקש במפורש.

**מה לא השתנה:** B1-B2 (מספור תמיד היה נכון). F1-F4 ללא שינוי. הכרעת גבול frontend Phase0/1 ללא שינוי. Amendment A עצמו (התוכן המהותי של B6/B7/B9/B10/B11/B13) ללא שינוי — רק מספרי הקבצים.

**לקח מצטבר (משתי הטעויות ברצף):** בכל שינוי שנוגע למספור/שמות קבצים בפועל, המקור הראשוני היחיד המהימן הוא הדיסק/git (`ls`, `git show`) — לא תיאור טקסטואלי ב-vault, ולא הנחה מדיספאץ' קודם. מעכשיו: לפני כל revision שנוגעת ל-migration numbering, להריץ `ls supabase/migrations/` ישירות.
