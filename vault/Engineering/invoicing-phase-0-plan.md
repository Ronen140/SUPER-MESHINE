# Engineering Work Plan: Invoicing & Receipts — Phase 0 (Scaffold + Backend Engine)

**Date:** 2026-08-30 14:30
**Revised:** 2026-08-30 (Revision 1 — Amendment A מה-architect ל-ADR-INV-001 יושמה; ראו `## Plan Revisions` בתחתית הקובץ)
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
- [[001-data-model-and-rls]] (ADR-INV-001) — **Amended (Amendment A, 2026-08-30)** בעקבות ה-escalation שלי (ראו למטה). schema מלא (13 טבלאות + 9 enums), RLS על `business_id` דרך `business_members`, `app.current_business_ids()`/`app.has_role()`/`app.create_business()` כ-`SECURITY DEFINER` (whitelist סגור של 7 פונקציות), `FORCE ROW LEVEL SECURITY` **על `business_signing_keys` בלבד** (לא גורף — תוקן ב-Amendment A), 4 roles, 3 נתיבי `service_role` סגורים.
- [[002-immutability-and-numbering]] (ADR-INV-002) — `document_counters` + `UPDATE...RETURNING` (לא `SEQUENCE`), `app.issue_document()` כנתיב הפקה יחיד, trigger immutability עם whitelist default-deny, snapshots, מכונת מצבים `draft→issued/cancelled`.
- [[003-pdf-signing-storage]] (ADR-INV-003) — buckets+policies, `business_signing_keys` + `api/keygen.py` (RSA-3072+X.509 self-issued+envelope encryption) **ב-Phase 0**; צינור הרינדור/חתימה (Chromium+pyHanko) **הוא Phase 1** ולא נכלל כאן. עותק חוץ מוצפן + keepalive — Phase 0.
- `invoicing-receipts/docs/plan.md` — Phase 0 DoD מקורי: "משתמש נרשם, יוצר עסק, מחליף בין עסקים; RLS מוכח בבדיקה."
- ADR-002 / ADR-006 של הבית (multi-tenancy, audit) — **לא** ADR מחייב כאן; ADR-INV-001 §D6 סוטה במודע מ-ADR-006 (audit ב-triggers בלבד, אושר ע"י CEO).

**Codebase state check:**
- `invoicing-receipts/` מכיל היום רק `README.md` + `docs/` (requirements, plan, 3 ADRs). **אין קוד, אין `package.json`, אין `src/`, אין `supabase/`.** Greenfield מוחלט.
- אין node/pnpm/supabase CLI מותקנים בסביבה (לפי תקדים `2026-05-07-1700-bootstrap-dev-env-7a-plan.md` בהקמת ה-ERP — נניח את אותו מצב, backend-builder יתקין).
- `vault/Engineering/` קיים. אין work plan קודם לפרויקט הזה.
- **תקדים רלוונטי:** `vault/Engineering/2026-05-07-1700-bootstrap-dev-env-7a-plan.md` — אותה גישה של scaffold תשתית ל-backend-builder לפני קוד עסקי; משמש מודל לרמת הפירוט כאן.
- **הבדל stack מהותי מה-ERP:** אין Drizzle/tRPC בפרויקט הזה. ה-ADRs כותבים SQL גולמי + Supabase CLI migrations + Postgres functions (`SECURITY DEFINER`) ישירות — זו בחירת הארכיטקט המחייבת (לא שלי). `api/keygen.py` הוא **Python** (Vercel Python runtime) — חריג יחיד מה-TypeScript הרגיל של backend-builder; מתועד כסיכון הנדסי למטה.
- **סטטוס נכון להיום:** backend-builder נמצא באמצע B1-B4 (scaffold + extensions/enums + טבלאות). **B1-B4 אינן מושפעות מ-Amendment A** — ה-RLS מתחיל רק ב-B5, ו-B1-B4 עוסקות בסכמה גרידא ללא policies. אין סתירה, אין צורך ב-rework על מה שכבר בעבודה.

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
| A-4 | **⚠️ פער שלא דווחתי:** `FORCE ROW LEVEL SECURITY` הגורף מ-§D3 המקורי שובר את **כל** דפוס ה-`SECURITY DEFINER` של ה-ADR | §D3.2 (חדש): **FORCE יורד מכל הטבלאות פרט ל-`business_signing_keys`**. תחת FORCE, גם בעלת הטבלה (`postgres`, שרצות תחתיה כל פונקציות ה-definer) כפופה ל-policies — ומכיוון ש-`postgres` אינו חבר ב-`authenticated`, שום policy לא הייתה חלה עליו, והתוצאה הייתה **דחייה גורפת**: `app.current_business_ids()` הייתה מחזירה 0 שורות (נעילת המערכת), `app.issue_document()` לא הייתה יכולה לכתוב ל-`document_counters`, וה-audit trigger לא היה יכול לכתוב ל-`audit_log`. `business_signing_keys` היא החריג הנכון כי הקורא הלגיטימי היחיד שלה הוא `service_role` (`BYPASSRLS`, גובר על FORCE) — אף פונקציית definer לא נוגעת בה. **בדיקת CI (ב) התהפכה:** FORCE חייב להיות מוחל על **בדיוק** `business_signing_keys** ועל שום טבלה אחרת. |
| A-5 | (קוסמטי) D7 הניחה טבלת `_migrations` | הוסרה — Supabase CLI כותב ל-`supabase_migrations.schema_migrations`, מחוץ ל-`public`. פותר את Open Question #4 שהעליתי בגרסה הקודמת של התוכנית. |

**Whitelist סגור של `SECURITY DEFINER` functions (בדיקת CI חדשה, (ה)):** `app.current_business_ids()`, `app.has_role(uuid,member_role[])`, `app.create_business(text,entity_type,text,text,text)`, `app.issue_document(uuid,date)`, `app.set_start_number(uuid,document_type,integer,bigint)`, `app.send_document(uuid,text[])` (שמורה ל-Phase 1, מותר שלא תהיה קיימת עדיין), `app.audit_trigger()`. **כל פונקציית definer חדשה שלא ברשימה = build fail.** זהו ה-control האמיתי נגד דילוג-RLS, כי FORCE כבר לא ממלא את התפקיד הזה.

**השפעה על התוכנית:** B9 ו-F3 משוחררות. B6 (RLS policies) עודכן במלואו. B7/B8/B12/B14 עודכנו לצורך עקביות מספור/whitelist. **נתגלה תוך כדי הסנכרון פער חמישי משלי:** התוכנית המקורית לא כללה subtask נפרד ל-storage buckets+policies (ADR-INV-003 §D5) למרות שזה היה ברשימת ה-"must-have" של ה-CEO — נוסף עכשיו כ-**B10 חדש**, עם הזזת מספור B10-B13 הישנות ל-B11-B14.

## Decomposition

**עקרון סדר:** backend-builder עובד בשרשרת רציפה (B1→B14, תואם עכשיו את מספור ה-migrations הרשמי של ADR-INV-001 §Implementation Notes #1: 0001→0011) כי אלו migrations ממוספרות שכל אחת בונה על הקודמת (עובד יחיד — אין תועלת ב"מקבילי" בין המשימות שלו). frontend-builder עובד ב-4 משימות שרובן יכולות לרוץ **במקביל** לעבודת ה-backend, עם 3 נקודות סנכרון בלבד (F2 צריך B3, F3 צריך B9, F4 צריך F3). Overall: **14** backend subtasks + 4 frontend subtasks = **18**.

**הכרעת גבול Phase 0/1 עבור frontend (התבקשתי להכריע, ללא שינוי מהגרסה הקודמת):** כלול ב-Phase 0 שלד אפליקציה מינימלי + auth + יצירת עסק + business switcher — **ולא** יותר מזה. נימוק: DoD המקורי של Phase 0 ב-`plan.md` ("משתמש נרשם, יוצר עסק, מחליף בין עסקים; RLS מוכח בבדיקה") הוא UI-facing במפורש. עורך המסמכים, קטלוג הפריטים, הדשבורד, ורינדור ה-PDF **נשארים Phase 1** במלואם.

---

### Subtask B1 — Project scaffold & tooling

*(ללא שינוי מה-Amendment — עודכן רק להערת סטטוס למעלה)*

- **Assignee:** `backend-builder`
- **Spec:** אתחול פרויקט pnpm עצמאי ב-`invoicing-receipts/`: Next.js 15 (App Router, TypeScript strict), Tailwind v4 בסיסי, Biome (format+lint), Vitest, Supabase CLI (`supabase init` — **לא** Drizzle, לפי בחירת הארכיטקט ב-ADRs). מבנה תיקיות: `src/app/`, `src/lib/supabase/`, `src/server/service-role/` (עם ESLint `no-restricted-imports` שחוסם import של המודול הזה מכל מקום חוץ מעצמו — אכיפת ADR-INV-001 §D5), `supabase/migrations/`, `api/` (ל-Python functions עתידיות), `tests/`. `.env.example` עם שמות המשתנים מה-ADRs (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SIGNING_MASTER_KEK_V1`, `INTERNAL_PIPELINE_SECRET`) ללא ערכים. `package.json` scripts: `dev`, `build`, `test`, `lint`, `typecheck`, `format`, `db:start` (`supabase start`), `db:reset`, `db:migrate`.
- **Files (predicted):**
  - `invoicing-receipts/package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `.nvmrc`, `.gitignore` (new)
  - `invoicing-receipts/.env.example` (new)
  - `invoicing-receipts/supabase/config.toml` (new — `supabase init`)
  - `invoicing-receipts/src/app/layout.tsx`, `src/app/page.tsx` (new — hello world)
  - `invoicing-receipts/.eslintrc` או biome-lint plugin config עם ה-`no-restricted-imports` rule ל-`src/server/service-role`
  - `invoicing-receipts/README.md` (עדכון — "איך מריצים")
- **Acceptance criteria:**
  - `pnpm install` ב-`invoicing-receipts/` יוצא exit code 0.
  - `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format --check` כולם exit 0 על ה-scaffold הריק.
  - `supabase start` מרים Postgres+Auth+Storage מקומי בהצלחה (exit 0), `supabase status` מציג את כל השירותים כ-running.
  - ניסיון import מבחוץ ל-`src/server/service-role/` בקובץ בדיקה (`src/app/page.tsx` לדוגמה) גורם ל-`pnpm lint` להיכשל עם השגיאה הצפויה; import מבפנים לא נכשל.
  - `pnpm dev` מרים את Next.js על `localhost:3000`.
- **Dependencies:** none — ראשון.
- **Invariants applied:** N/A (אין קוד עסקי עדיין).

### Subtask B2 — Migrations 0001-0002: extensions + enums

*(ללא שינוי מה-Amendment)*

- **Assignee:** `backend-builder`
- **Spec:** מיגרציית Supabase CLI ראשונה: `pgcrypto`, `citext`. מיגרציה שנייה: 9 ה-enums לפי ADR-INV-001 §D2 בדיוק כפי שנכתבו (`entity_type`, `document_type`, `document_status`, `payment_method`, `vat_treatment`, `member_role`, `pdf_status`, `consent_channel`, `actor_type`).
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0001_extensions.sql` + `supabase/migrations_down/0001_extensions_down.sql`
  - `invoicing-receipts/supabase/migrations/0002_enums.sql` + מקביל down
- **Acceptance criteria:**
  - `supabase db reset` (או `migration up`) מריץ את שתי המיגרציות בהצלחה על DB ריק.
  - `select typname from pg_type where typname in (9 השמות)` מחזיר 9 שורות.
  - down script מריץ `drop type` ל-9 ה-enums (בסדר תלות נכון) ומחזיר DB למצב שלפני 0002; `select typname ...` מחזיר 0 שורות אחרי down.
- **Dependencies:** B1.
- **Invariants applied:** N/A.

### Subtask B3 — Migration 0003a: core tables (global + business + membership + signing key + catalog + consent)

*(ללא שינוי מה-Amendment; מספור `0003a`/`0003b` הוא sub-split פנימי שלי לניהול-ביקורת נוח יותר של מיגרציית ה-0003 היחידה ב-ADR — לא מתנגש עם המספור 0004+ שהוזז)*

- **Assignee:** `backend-builder`
- **Spec:** יצירת `users` (כולל **trigger `on auth.users insert` שמכניס שורת `public.users` תואמת**), `vat_rates` (+ seed 2 השורות מה-ADR — **הערה:** ה-ADR מציע seed נפרד ב-`0011_seed_vat_rates`; אני משאיר את ה-seed מאוחד כאן עם יצירת הטבלה מטעמי פרקטיות builder-level — פונקציונלית שקול, לא סוטה מה-ADR מבחינת schema/RLS), `businesses`, `business_members` (+ trigger "לפחות owner אחד" מ-D4), `business_signing_keys`, `customers`, `items`, `customer_document_consents` — כל העמודות, CHECK constraints, ואינדקסים בדיוק כפי שמופיעים ב-ADR-INV-001 §Schema (כולל עמודות Phase 2: `withholding_tax_rate` על `customers`).
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0003a_core_tables.sql` + down מקביל
- **Acceptance criteria:**
  - כל 8 הטבלאות קיימות עם העמודות המדויקות מה-ADR (`\d+ <table>` תואם); `vat_rates` מכיל 2 שורות seed (17.00 עד 2024-12-31, 18.00 מ-2025-01-01).
  - `tax_id_digits`, `tax_id_uk`, `items_name_uk`, `customers_taxid_uk`, `consent_active_uk` וכל שאר ה-constraints/indexes מה-ADR קיימים (נבדק ב-`pg_constraint`/`pg_indexes`).
  - טריגר `on auth.users` יוצר שורת `public.users` תואמת תוך כדי הרשמת משתמש בדיקה — נבדק ב-Vitest אינטגרציה מול Supabase local.
  - נסיון `DELETE` שמותיר `business_members` בלי אף `owner` נכשל עם exception.
  - down script מסיר את כל 8 הטבלאות + הטריגר + seed, בסדר תלות נכון.
- **Dependencies:** B2.
- **Invariants applied:** multi-tenancy ✅ (schema בלבד בשלב זה, RLS ב-B6), audit N/A עדיין, agent gating N/A, migration rollback ✅.

### Subtask B4 — Migration 0003b: document tables (documents, lines, payments, counters, allocation, public links, audit_log)

*(ללא שינוי מה-Amendment)*

- **Assignee:** `backend-builder`
- **Spec:** יצירת `documents`, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `audit_log` — כל העמודות (כולל Phase 2/3: `allocation_number`, `allocation_request_id`, `withholding_rate`, `withholding_amount`), כל ה-CHECK constraints (`doc_type_allowed_for_entity`, `patur_has_no_vat`, `credit_needs_parent`, `credited_within_total`, `ils_only_phase1`, וכו'), עמודת ה-`generated always as` (`signed_total`), וכל האינדקסים כולל ה-partial indexes, בדיוק כפי שמופיעים ב-ADR-INV-001 §Schema.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0003b_document_tables.sql` + down מקביל
- **Acceptance criteria:**
  - כל 7 הטבלאות קיימות עם העמודות/constraints/indexes המדויקים (כולל `documents_number_uk` ה-partial unique index).
  - בדיקת CHECK: ניסיון INSERT ל-`documents` עם `business_entity_type='patur'` ו-`type='tax_invoice'` נכשל (`doc_type_allowed_for_entity`); ניסיון עם `vat_amount>0` ו-`business_entity_type='patur'` נכשל (`patur_has_no_vat`).
  - `signed_total` מחושב נכון: שורת `credit_note` עם `total_amount=100` מניבה `signed_total=-100`; שורה רגילה עם `total_amount=100` מניבה `100`.
  - down script מסיר את כל 7 הטבלאות בסדר תלות נכון (FK-aware).
- **Dependencies:** B3 (FK ל-`businesses`, `customers`, `business_signing_keys`).
- **Invariants applied:** multi-tenancy ✅ (עמודות `business_id` בכל טבלה, FK מורכב), audit N/A עדיין, migration rollback ✅.

### Subtask B5 — Migration 0004: RLS helper functions

**עדכון קל (מספור בלבד):** קובץ המיגרציה משתנה מ-`0005_rls_helpers.sql` ל-**`0004_rls_helpers.sql`** כדי להתאים למספור הרשמי של ADR-INV-001 §Implementation Notes #1 (זו הייתה טעות מספור שלי מהגרסה הקודמת, לא קשורה ל-Amendment A — מתוקנת עכשיו כדי למנוע התנגשות עם `0009_create_business` החדש). אין שינוי ב-scope/AC.

- **Assignee:** `backend-builder`
- **Spec:** יצירת schema `app` (revoke מ-`anon`/`authenticated`), `app.current_business_ids()` ו-`app.has_role(uuid, member_role[])` בדיוק כפי שמוגדרות ב-ADR-INV-001 §D3 — `SECURITY DEFINER`, `STABLE`, `set search_path = public, pg_temp`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0004_rls_helpers.sql` + down מקביל
- **Acceptance criteria:**
  - `select proname, prosecdef, provolatile from pg_proc where proname in ('current_business_ids','has_role')` מראה `prosecdef=true` (definer) ו-`provolatile='s'` (stable) לשתי הפונקציות.
  - `grant`/`revoke` על schema `app` נבדק: `anon`/`authenticated` **לא** יכולים `select`/`execute` ישירות על אובייקטים ב-`app` מלבד דרך grant מפורש על הפונקציות עצמן.
  - בדיקת יחידה: משתמש בדיקה A עם חברות בעסק X → `app.current_business_ids()` מחזיר `{X}` בלבד (לא רקורסיה, לא timeout).
- **Dependencies:** B3 (`business_members`).
- **Invariants applied:** multi-tenancy ✅ (זו תשתית האכיפה).

### Subtask B6 — Migration 0005: RLS policies (**עודכן במלואו — Amendment A**)

- **Assignee:** `backend-builder`
- **Status:** **משוחרר** (בעבר "חוץ מ-`businesses`/bootstrap" — עכשיו מלא).
- **Spec:** `enable row level security` על **כל** הטבלאות ב-`public` (**ללא `force`** — Amendment A-4, §D3.2). `force row level security` **רק** על `business_signing_keys`. יישום policies:
  - תבנית `customers_read`/`customers_write` (ואותה תבנית ל-`items`, `customer_document_consents`, `documents`, `document_lines`, `payments`, `allocation_requests`, `document_public_links`).
  - `business_members`: `bm_self`, `bm_peers`, `bm_manage` (D3) — **`bm_manage` נכתבת כפי שהיא ב-ADR (דורשת owner קיים)**; ה-bootstrap ל-owner הראשון עובר ב-`app.create_business()` (B9), לא כאן.
  - `document_counters` — SELECT בלבד, **אין** policy כתיבה.
  - `audit_log` — SELECT בלבד, **אין** policy INSERT/UPDATE/DELETE כלל.
  - `business_signing_keys` — enable+**force**, **אפס policies** (default deny מוחלט; זו הטבלה היחידה עם force).
  - **חדש (D3.1, Amendment A-1):** `businesses_read` (SELECT ל-`id in (select app.current_business_ids())`), `businesses_update` (UPDATE ל-`app.has_role(id, ['owner'])`), **ללא** policy INSERT ו-**ללא** policy DELETE לעולם. **חדש:** trigger `businesses_protect_identity_trg` (`before update on businesses`) שחוסם שינוי ב-`created_by`, `tax_id`, `entity_type` גם דרך ה-UPDATE policy התקין.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0005_rls_policies.sql` + down מקביל
- **Acceptance criteria:**
  - `select relrowsecurity from pg_class where relname in (<כל 14 הטבלאות>)` = `true` לכולן.
  - **`select relname, relforcerowsecurity from pg_class where relname in (<כל 14>)` מראה `force=true` אך ורק ל-`business_signing_keys`; כל שאר ה-13 מראות `force=false`.** (זה בדיוק בדיקת CI (ב) ההפוכה — Amendment A-4.)
  - `business_signing_keys`: `select count(*) from pg_policies where tablename='business_signing_keys'` = 0.
  - `businesses`: `select cmd from pg_policies where tablename='businesses'` מחזיר בדיוק `{SELECT, UPDATE}` — אין `INSERT`, אין `DELETE`.
  - `document_counters`, `audit_log`: יש policy SELECT בלבד, `select count(*) from pg_policies where tablename in (...) and cmd != 'SELECT'` = 0.
  - `UPDATE businesses SET tax_id='000000000' WHERE id=<X>` (ע"י owner של X) נכשל בגלל `businesses_protect_identity_trg`; `UPDATE businesses SET display_name='...'` **מצליח**.
  - בדיקת non-recursion: query על `business_members` דרך `bm_peers` לא תלוי ב-timeout/stack overflow (100 שאילתות רצופות, כולן < 100ms).
  - `INSERT INTO businesses (...) VALUES (...)` ישיר מלקוח `authenticated` (לא דרך `app.create_business()`) נכשל — אין policy INSERT.
  - `DELETE FROM businesses WHERE id=<X>` נכשל — אין policy DELETE, לעולם.
- **Dependencies:** B4, B5.
- **Invariants applied:** multi-tenancy ✅ (מלא — כולל `businesses`, אין עוד escalation פתוח).

### Subtask B7 — Migrations 0006+0007: audit trigger + immutability triggers

**עדכון:** מחולק לשני קבצים (`0006_audit.sql` + `0007_immutability.sql`) בהתאם למספור הרשמי של ה-ADR, ונוסף סעיף AC: audit trigger חייב לחול **גם על `businesses`** (scope-root — Implementation Note #5 המתוקן).

- **Assignee:** `backend-builder`
- **Spec:** (א, `0006_audit.sql`) `app.audit_trigger()` — קוראת `auth.uid()`, `current_setting('request.jwt.claims', true)` ל-email, `current_setting('app.request_id', true)`; מוחלת על כל טבלה עם `business_id` **וגם על `businesses`** (scope-root), **חוץ מ**-`business_signing_keys`/`audit_log`; `app.enforce_audit(regclass)` helper. `audit_log_immutable_trg` — מעלה exception על כל UPDATE/DELETE. (ב, `0007_immutability.sql`) `app.documents_immutable()` — **בדיוק** לפי ADR-INV-002 §D3: whitelist מפורש, default-deny על שאר השדות, הסרת שדות ה-PDF מה-whitelist כש-`pdf_status='ready'`, בדיקת מעבר status מוגבל. `documents_immutable_trg` (`before update or delete ... when (old.status <> 'draft')`). `app.child_rows_locked()` על `document_lines`/`payments`. Trigger נעילה על `allocation_requests` (UPDATE אחרי `responded_at is not null`, DELETE תמיד). Trigger `BEFORE INSERT ON documents` שממלא `business_entity_type` snapshot מ-`businesses`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0006_audit.sql` + down מקביל
  - `invoicing-receipts/supabase/migrations/0007_immutability.sql` + down מקביל
- **Acceptance criteria:**
  - `app.enforce_audit()` הוחל על כל הטבלאות ה-business_id-bearing **וגם על `businesses`**, חוץ מ-2 החריגים (`business_signing_keys`, `audit_log`) — נבדק בשאילתת CI (ראו B13, בדיקה (ד)).
  - `UPDATE businesses SET display_name='X'` יוצר שורת `audit_log` עם `table_name='businesses'`.
  - `UPDATE audit_log SET action='x' WHERE id=1` נכשל עם exception, **גם תחת `service_role`**.
  - מסמך מדומה עם `status='issued'`: `UPDATE documents SET total_amount = total_amount + 1` נכשל עם `INV_IMMUTABLE_FIELDS`; `UPDATE documents SET paid_amount = 50` **מצליח** (whitelist); `DELETE FROM documents WHERE status='issued'` נכשל עם `INV_IMMUTABLE_DELETE`.
  - כש-`pdf_status='ready'`: `UPDATE documents SET pdf_status='pending'` נכשל (הוסר מה-whitelist).
  - `INSERT INTO document_lines` על מסמך `issued` נכשל.
  - INSERT חדש ל-`documents` מקבל `business_entity_type` תואם ל-`businesses.entity_type` אוטומטית.
- **Dependencies:** B4, B5, B6 (audit trigger על `businesses` צריך את הטבלה+policies קיימות; אין תלות פונקציונלית הדוקה ב-B6 אך נשמר סדר ה-migrations הרשמי).
- **Invariants applied:** audit log ✅ (על כל mutation, כולל `businesses`), migration rollback ✅.

### Subtask B8 — Migration 0008: `app.issue_document()` + `app.seed_for()` + `app.set_start_number()`

*(ללא שינוי תפקודי מה-Amendment; רק הערה שהחתימה המדויקת `app.issue_document(uuid,date)` ו-`app.set_start_number(uuid,document_type,integer,bigint)` חייבת להיות מדויקת מילה-במילה כי היא נבדקת מול whitelist סגור ב-B13 בדיקה (ה) — פרמטר עודף/שם טיפוס שונה = build fail)*

- **Assignee:** `backend-builder`
- **Spec:** מימוש מדויק של ADR-INV-002 §D1-D2: הקצאת מספר ב-`UPDATE document_counters ... RETURNING` (לא `SEQUENCE`), `app.seed_for()` (continuous/yearly לפי D9 ב-ADR-001), הרצף המלא של 11 הצעדים ב-D2 (נעילת מסמך, אימות חברות/role, אימות draft, רענון `business_entity_type`, אימותי תוכן כולל בדיקת `business_signing_keys` פעיל [`INV_NO_SIGNING_KEY`], חישוב מחדש של סכומים מ-`document_lines`+`vat_rates`, snapshots, הקצאת מספר+`display_number`, מעבר סטטוס ל-`issued`, עדכון `credited_amount` באב, audit_log מפורש `action='issue'`). `app.set_start_number()` — `SECURITY DEFINER`, מותר רק כש-`next_number=start_number`, רק ל-owner. `grant execute` על `issue_document`/`set_start_number` ל-`authenticated` בלבד; `revoke` מ-`anon`. מיפוי קודי שגיאה `INV_*` ל-`src/lib/errors.ts`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0008_issue_function.sql` + down מקביל
  - `invoicing-receipts/src/lib/errors.ts` (new — מילון `INV_*` → הודעת עברית; **יורחב ב-B9** עם קודים נוספים)
- **Acceptance criteria:** *(ללא שינוי — ראו גרסה קודמת)*
  - קריאה ל-`issue_document()` על טיוטה תקינה מייצרת `document_number=1`, `status='issued'`, `issued_at`/`issue_date` מלאים, snapshots לא null.
  - קריאה שנייה על אותו עסק/סוג/שנה מייצרת `document_number=2`.
  - קריאה על מסמך `status='issued'` נכשלת עם `INV_ALREADY_ISSUED`; ללא מפתח חתימה פעיל נכשלת עם `INV_NO_SIGNING_KEY`; תשלומים לא תואמים נכשלת עם `INV_PAYMENTS_MISMATCH`; זיכוי חורג נכשל עם `INV_CREDIT_EXCEEDS_PARENT`.
  - הסכומים הסופיים תמיד נגזרים מ-`document_lines` (דורס קלט שגוי מהלקוח).
  - `set_start_number` על סדרה שכבר הופק בה מסמך נכשל.
- **Dependencies:** B7, B3 (vat_rates seed).
- **Invariants applied:** audit log ✅, agent gating N/A, migration rollback ✅.

### Subtask B9 — Migration 0009 + `api/keygen.py` + `POST /api/businesses` (**עודכן במלואו — משוחרר, Amendment A**)

- **Assignee:** `backend-builder`
- **Status:** **משוחרר.** `app.create_business()` כתובה במלואה ב-ADR-INV-001 §D10 — מיושמת בדיוק כפי שהיא.
- **Spec:**
  1. **`0009_create_business.sql`** — `app.create_business(p_legal_name text, p_entity_type entity_type, p_tax_id text, p_tax_id_type text default 'vat', p_display_name text default null) returns businesses`, `SECURITY DEFINER`, `set search_path = public, pg_temp`. בדיוק לפי §D10: מאמתת `auth.uid()` לא null (`INV_UNAUTHENTICATED`), מאמתת פרופיל קיים ב-`users` (`INV_NO_PROFILE`), אוכפת **מגבלת 10 עסקים למשתמש** (`select count(*) from businesses where created_by=v_uid`, `INV_BUSINESS_LIMIT`), מאמתת פורמט `tax_id` (`INV_BAD_TAX_ID`), INSERT ל-`businesses` בתוך `begin/exception when unique_violation` הממופה ל-`INV_TAX_ID_EXISTS`, INSERT ל-`business_members(role='owner')`, INSERT מפורש ל-`audit_log` (`action='business_create'`). `revoke execute ... from public, anon; grant execute ... to authenticated`.
  2. **`api/keygen.py`** (Python, Vercel runtime) — RSA-3072 keypair, תעודת X.509 self-issued לפי ADR-INV-003 §D4 (CN/serialNumber/O/C, 10 שנות תוקף, KeyUsage/ExtendedKeyUsage כמפורט), envelope encryption (DEK אקראי 32B, AES-256-GCM, `wrapped_dek` מוצפן ב-`SIGNING_MASTER_KEK_V1`), INSERT ל-`business_signing_keys`.
  3. **`POST /api/businesses`** (Next.js route) — קורא ל-`supabase.rpc('create_business', {...})`, **ורק אחרי שהיא החזירה בהצלחה** קורא בנפרד ל-`api/keygen.py` (Implementation Note #10: **אסור** לאחד את שני השלבים לפונקציה אחת / קריאת HTTP מתוך Postgres). כשל ב-keygen משאיר עסק תקין ללא יכולת הפקה (`INV_NO_SIGNING_KEY` ב-`issue_document()` יתפוס זאת) — מצב מטופל, לא שבור; ה-UI (F3) מציג retry.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0009_create_business.sql` + down מקביל
  - `invoicing-receipts/api/keygen.py` (new)
  - `invoicing-receipts/requirements.txt` (new — `cryptography`, מוצמד בגרסה)
  - `invoicing-receipts/src/app/api/businesses/route.ts` (new)
  - `invoicing-receipts/src/lib/errors.ts` (edit — מוסיף `INV_UNAUTHENTICATED`, `INV_NO_PROFILE`, `INV_BUSINESS_LIMIT`, `INV_BAD_TAX_ID`, `INV_TAX_ID_EXISTS`, `INV_NO_SIGNING_KEY`)
- **Acceptance criteria:**
  - `app.create_business()` מוצלחת יוצרת **בדיוק שתי** שורות (`businesses` + `business_members` owner) באטומיות, ו-`app.current_business_ids()` מחזירה מיד את העסק החדש לאותו session.
  - כשל מלאכותי שמוזרק **אחרי** ה-INSERT הראשון (לדוגמה: constraint violation מכוון על ה-INSERT השני) ⇒ **אפס** שורות נותרות (גם `businesses` וגם `business_members`) ו-`tax_id` פנוי לניסיון חוזר — נבדק ישירות (Implementation Note #3, בדיקה חדשה).
  - קריאה 11 מאותו `created_by` נכשלת עם `INV_BUSINESS_LIMIT` (אחרי 10 עסקים מוצלחים).
  - `tax_id` כפול (כבר קיים במערכת, כל עסק) נכשל עם `INV_TAX_ID_EXISTS`, לא עם `unique_violation` גולמי.
  - `POST /api/businesses` עם payload תקין: `businesses`+`business_members` נוצרות דרך ה-RPC (לא INSERT ישיר), ותוך ≤5 שניות נוצרת בדיוק שורת `business_signing_keys(is_active=true)` אחת דרך `api/keygen.py` הנפרד.
  - ה-`certificate_pem` שנוצר תקף (parse-able כ-X.509, `notAfter` ≈ now+10y ±1 יום); `private_key_ciphertext`/`wrapped_dek`/`private_key_nonce` — none מהם מכיל מפתח פרטי בטקסט גלוי (בדיקת string-search שלילית).
  - כשל בקריאה ל-keygen (למשל KEK env חסר) לא מפיל את יצירת העסק (השלב הראשון כבר commit) ולא יוצר שורת `business_signing_keys` חלקית.
- **Dependencies:** B6 (RLS/policies על `businesses` — למרות ש-`create_business()` היא definer ולא תלויה ב-policies כדי לכתוב, ה-SELECT/UPDATE הבאים על העסק כן), B8 (סדר migrations רשמי).
- **Invariants applied:** multi-tenancy ✅ (מלא, אין עוד escalation), audit ✅ (`action='business_create'` + `action='key_create'` נכתבים ידנית).

### Subtask B10 — Migration 0010: Storage buckets + policies **(חדש — נוסף תוך כדי הסנכרון, לא היה ב-plan המקורי)**

- **Assignee:** `backend-builder`
- **Spec:** **פער שזיהיתי תוך כדי סנכרון ה-Amendment:** ה-plan המקורי לא כלל subtask ל-storage buckets למרות שזה היה ב-"must-have" המקורי של ה-CEO ("buckets+policies"). מוסיף עכשיו לפי ADR-INV-003 §D5: bucket `documents` (פרטי, policy SELECT בלבד ל-`authenticated` לפי `(storage.foldername(name))[1]::uuid in (select app.current_business_ids())`, **ללא** policy INSERT/UPDATE/DELETE — העלאה רק ב-service_role, Phase 1), bucket `business-assets` (SELECT+INSERT ל-`owner` של אותו עסק, לצורך לוגו — עתידי, אין UI ל-Phase 0 אך ה-bucket+policy נוצרים עכשיו). bucket `chromium` (ציבורי) **לא** נכלל — הוא משרת את צינור הרינדור של Phase 1 בלבד, אין טעם ליצור אותו ריק עכשיו.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0010_storage_buckets.sql` + down מקביל
- **Acceptance criteria:**
  - `select id, public from storage.buckets where id in ('documents','business-assets')` מחזיר `public=false` לשתיהן.
  - `select count(*) from pg_policies where tablename='objects' and schemaname='storage'` — יש בדיוק policy SELECT אחת ל-`documents` ו-2 policies (SELECT+INSERT) ל-`business-assets`; **אין** UPDATE/DELETE policy על אף אחד משתי ה-buckets.
  - בדיקת בידוד: משתמש חבר בעסק X מנסה SELECT על אובייקט תחת path של עסק Y ב-bucket `documents` — נכשל/0 שורות.
  - down script מסיר את שני ה-buckets + policies.
- **Dependencies:** B9 (businesses+RLS מלאים).
- **Invariants applied:** multi-tenancy ✅.

### Subtask B11 — Isolation test suite (**עודכן — Amendment A, יותר מ-12 assertions**)

*(היה B10 בגרסה הקודמת)*

- **Assignee:** `backend-builder`
- **Spec:** לפי ADR-INV-001 §Implementation Notes #3 (מעודכן): שני משתמשי בדיקה (A, B), שני עסקים (X בבעלות A, Y בבעלות B), ורשימת assertions:
  1. **12 assertions בסיסיות:** SELECT/INSERT/UPDATE/DELETE של A על כל אחת מ-`customers`, `items`, `documents` של B (3 טבלאות × 4 פעולות), כולל ניסיון INSERT ל-`documents` עם `business_id=Y` תחת session של A.
  2. **2 assertions חדשות (scope-root):** ניסיון `SELECT`/`UPDATE` ישיר של A על שורת `businesses` של B — שתיהן נכשלות/0 שורות.
  3. **3 assertions חדשות (Amendment A):** `INSERT INTO businesses` ישיר מ-A (לא דרך RPC) נכשל; `DELETE FROM businesses` נכשל (לעולם, גם ע"י owner עצמו); `app.create_business()` מוצלחת יוצרת בדיוק 2 שורות ומיד גלויה ל-`current_business_ids()`, וכשל מלאכותי אחריה משאיר 0 שורות + `tax_id` פנוי (בדיקת אטומיות — יכולה לחפוף עם ה-AC המקבילה ב-B9, לא כפילות מיותרת אלא double-coverage מכוון ברמת ה-suite).
  **כולן** חייבות להיכשל/להחזיר 0 שורות (למעט #3 השלישית שבודקת גם את מסלול ההצלחה).
- **Files (predicted):**
  - `invoicing-receipts/tests/isolation.test.ts` (new — Vitest, מריץ מול Supabase local עם 2 Supabase JS clients בעלי JWT שונים)
- **Acceptance criteria:**
  - **17/17 assertions** ירוקות ב-`pnpm test` (12 בסיסיות + 2 scope-root + 3 Amendment-A), רשימה מפורשת בקוד הבדיקה.
  - הבדיקה עצמה נכשלת (red) אם מריצים אותה נגד DB עם `force row level security` מוסר מ-`business_signing_keys` (הטבלה היחידה שאמורה להיות force) — מוודאת שהיא אכן בודקת RLS.
  - זמן ריצה כולל < 10 שניות.
- **Dependencies:** B6, B9, B10.
- **Invariants applied:** multi-tenancy ✅ — זו בדיקת ה-invariant עצמה, כולל `businesses` עכשיו.

### Subtask B12 — Numbering race test (20 concurrent issues)

*(היה B11 — ללא שינוי תפקודי, רק מספור subtask)*

- **Assignee:** `backend-builder`
- **Spec:** לפי ADR-INV-002 §Implementation Notes #2: 20 טיוטות תקינות של אותו עסק+סוג מסמך, ו-20 קריאות **מקבילות** ל-`issue_document()`. **פישוט מכוון:** הטסט מזריק שורת `business_signing_keys` דמה ישירות ל-DB (לא דרך `api/keygen.py`) כדי לספק את `INV_NO_SIGNING_KEY` precondition בלי תלות ב-B9.
- **Files (predicted):**
  - `invoicing-receipts/tests/numbering-race.test.ts` (new)
- **Acceptance criteria:**
  - 20 הקריאות מסתיימות ללא error בלתי-צפוי.
  - `count(distinct document_number) = 20` וגם `max - min = 19`.
  - `document_counters.next_number` הסופי = `min(document_number) + 20`.
  - הרצה חוזרת ממשיכה מהמספר הבא ברצף (`continuous`).
- **Dependencies:** B8.
- **Invariants applied:** multi-tenancy N/A (בדיקה חד-עסקית), audit N/A ישיר.

### Subtask B13 — CI pipeline (GitHub Actions) (**עודכן — 5 בדיקות מטא, לא 4**)

*(היה B12)*

- **Assignee:** `backend-builder`
- **Spec:** `ci.yml` — מריץ על כל push/PR: `supabase start` (או container Postgres תואם), מריץ את כל ה-up migrations בסדר (0001→0011), מריץ down-then-up roundtrip, מריץ את **5** בדיקות ה-CI המטא לפי ADR-INV-001 §Implementation Notes #2 (מעודכן):
  - (א) טבלה ב-`public` ללא RLS מופעל.
  - (ב) **[Amendment A-4] FORCE מוחל בדיוק על `business_signing_keys` ועל שום טבלה אחרת** — `c.relforcerowsecurity <> (c.relname = 'business_signing_keys')` מחזיר שורות ⇒ fail.
  - (ג) **[Amendment A-2] scoping map בת 4 קטגוריות** — טבלה שאינה `businesses`/`users`/`vat_rates` וגם אין לה עמודת `business_id` ⇒ fail.
  - (ד) טבלה עם `business_id` (או `businesses` עצמה) ללא audit trigger, חוץ מ-`business_signing_keys`/`audit_log`.
  - (ה) **[Amendment A-4, חדשה]** `SECURITY DEFINER` functions ב-`public`/`app` מול whitelist סגור של 7 חתימות מדויקות — פונקציה לא ברשימה ⇒ fail. **הערה:** `app.send_document(uuid,text[])` שמורה ברשימה ל-Phase 1 ומותר שלא תהיה קיימת עדיין — הבדיקה נכשלת רק על פונקציה **קיימת שאינה ברשימה**, לא על חוסר בפונקציה רשומה.
  מריץ B11 (isolation, 17 assertions) + B12 (race). מריץ `pnpm lint`/`typecheck`/`test`/`build`.
- **Files (predicted):**
  - `invoicing-receipts/.github/workflows/ci.yml` (new)
  - `invoicing-receipts/scripts/ci-schema-checks.sql` (new — **5** השאילתות המדויקות מ-ADR-INV-001 §Implementation Notes #2)
  - `invoicing-receipts/scripts/migrate-down-up-roundtrip.sh` (new)
- **Acceptance criteria:**
  - כל **5** שאילתות ה-CI מחזירות 0 שורות על DB אחרי כל המיגרציות (0001-0011).
  - `migrate-down-up-roundtrip.sh` מסתיים ב-exit 0 ו-schema `public` זהה (diff ריק) לפני ה-down ואחרי ה-up החוזר, כולל `0009_create_business`/`0010_storage_buckets`.
  - B11, B12 רצות בתוך ה-workflow ומדווחות ירוק ב-GitHub Checks.
  - workflow שלם רץ ב-CI < 8 דקות.
- **Dependencies:** B1-B12 (כל הקודמים — capstone).
- **Invariants applied:** כל 4 ה-invariants נבדקים כאן במפורש, כולל התיקון ל-multi-tenancy (FORCE ההפוך + whitelist ה-definer functions).

### Subtask B14 — Ops jobs: daily keepalive + weekly encrypted backup + monthly restore-test skeleton

*(היה B13 — ללא שינוי תפקודי, רק מספור subtask ותלות)*

- **Assignee:** `backend-builder`
- **Spec:** לפי ADR-INV-003 §D5: `keepalive.yml` — cron יומי שמאפס את מונה ההשעיה של Supabase. `backup.yml` — cron שבועי: `pg_dump` מלא + `age` encrypt + העלאה ל-**Cloudflare R2** (נבחר על B2, החלטת builder-level). ב-CI רץ dry-run מול endpoint מדומה. `restore-test.yml` (חודשי, skeleton) — פענוח + אימות `pdf_sha256` על מדגם (ריק בפועל ב-Phase 0). מתועד ב-`docs/ops-runbook.md`.
- **Files (predicted):**
  - `invoicing-receipts/.github/workflows/keepalive.yml`, `backup.yml`, `restore-test.yml` (new)
  - `invoicing-receipts/scripts/backup.sh` (new)
  - `invoicing-receipts/docs/ops-runbook.md` (new)
- **Acceptance criteria:**
  - `keepalive.yml`/`backup.yml` תקפים תחביריים ורצים ב-CI (credentials מדומים) exit 0.
  - `backup.sh` מריץ `pg_dump` אמיתי מול ה-DB המקומי ומייצר קובץ מוצפן ניתן-לפענוח (round-trip test).
  - `ops-runbook.md` כולל רשימת GitHub Secrets מדויקת שהמייסד צריך להזין לפני R2 אמיתי.
- **Dependencies:** B13.
- **Invariants applied:** N/A ישיר (תשתית DR, משרתת את חובת הארכיון 7 שנים).

---

### Subtask F1 — App shell: shadcn/ui init + RTL layout + Supabase client wiring

*(ללא שינוי מה-Amendment)*

- **Assignee:** `frontend-builder`
- **Spec:** `shadcn/ui` init (button, input, form, label, card, dialog, dropdown-menu, sonner/toast, avatar). Layout גלובלי עם `dir="rtl" lang="he"`, Tailwind v4 עם logical properties בלבד, טוקן צבע בסיסי (stone neutral + emerald primary אחד). `src/lib/supabase/browser.ts` + `src/lib/supabase/server.ts`.
- **Files (predicted):**
  - `invoicing-receipts/src/app/layout.tsx` (edit)
  - `invoicing-receipts/src/components/ui/*` (new — shadcn generated)
  - `invoicing-receipts/src/lib/supabase/browser.ts`, `server.ts` (new)
  - `invoicing-receipts/tailwind.config.ts` / `globals.css` (edit)
- **Acceptance criteria:**
  - עמוד ריק נטען עם `dir="rtl"` על `<html>`, פונט קריא בעברית.
  - grep על `src/` לא מוצא `margin-left`/`margin-right`/`padding-left`/`padding-right`/`text-align: left/right`.
  - שני ה-client factories טסט-מכוסים (URL/anon-key מ-env, שגיאה ברורה אם חסרים).
  - בדיקה בדפדפן: נטען ללא שגיאת console, ללא flash LTR.
- **Dependencies:** B1.
- **Invariants applied:** N/A.

### Subtask F2 — Auth flow: signup/login/logout

*(ללא שינוי מה-Amendment)*

- **Assignee:** `frontend-builder`
- **Spec:** דפי `/login`, `/signup` (Supabase Auth email+password), middleware מפנה לא-מחובר ל-`/login`, מחובר-בלי-עסק ל-`/businesses/new`. Logout button.
- **Files (predicted):**
  - `invoicing-receipts/src/app/(auth)/login/page.tsx`, `signup/page.tsx` (new)
  - `invoicing-receipts/src/middleware.ts` (new)
  - `invoicing-receipts/src/components/auth/logout-button.tsx` (new)
- **Acceptance criteria:**
  - הרשמה יוצרת `auth.users`+`public.users` (דרך trigger מ-B3).
  - התחברות מפנה ל-`/businesses/new` (אין עסקים).
  - route מוגן ללא session מפנה ל-`/login`.
  - Logout מנקה session.
- **Dependencies:** F1, B3.
- **Invariants applied:** N/A.

### Subtask F3 — Business creation form (**עודכן — משוחרר, Amendment A**)

- **Assignee:** `frontend-builder`
- **Status:** **משוחרר.**
- **Spec:** טופס `/businesses/new` (react-hook-form + zod): `legal_name`, `entity_type` (patur/murshe), `tax_id` (ולידציית 9 ספרות client-side), `tax_id_type`, `display_name` אופציונלי. שולח בקשה ל-`POST /api/businesses` (B9) — **ה-route בעצמו קורא ל-`supabase.rpc('create_business', {...})` ואז ל-keygen; ה-frontend לא קורא ל-RPC ישירות** (שומר את סדר השלבים המחייב מ-Implementation Note #10 בצד השרת, לא תלוי במשמעת client). מציג spinner "מכינים את חשבון החתימה שלך" עד שהעסק מוכן, ואז מפנה ל-`/[businessId]`. שגיאות `INV_TAX_ID_EXISTS`/`INV_BUSINESS_LIMIT`/`INV_BAD_TAX_ID` מוצגות בעברית ידידותית (לא stack trace).
- **Files (predicted):**
  - `invoicing-receipts/src/app/(app)/businesses/new/page.tsx` (new)
  - `invoicing-receipts/src/lib/schemas/business.ts` (new — zod schema)
- **Acceptance criteria:**
  - שליחת טופס תקין יוצרת עסק ומנווטת ל-`/[businessId]` שמציג את שם העסק.
  - `tax_id` לא תקין נחסם client-side לפני קריאת API.
  - עסק 11 מאותו משתמש (מבחן ידני: יוצרים 10 עסקים תקינים, מנסים ה-11) מציג הודעה ברורה למשתמש על `INV_BUSINESS_LIMIT` (לא crash).
  - `tax_id` כפול מציג הודעה ברורה (`INV_TAX_ID_EXISTS`), לא שגיאת DB גולמית.
  - זמן מ-submit ועד ניווט מוצלח: p95 < 5 שניות בסביבת פיתוח מקומית (כולל keygen).
- **Dependencies:** F2, B9.
- **Invariants applied:** N/A ישיר בצד frontend.

### Subtask F4 — Business switcher

*(ללא שינוי מה-Amendment)*

- **Assignee:** `frontend-builder`
- **Spec:** Dropdown בראש ה-sidebar שמציג את כל העסקים שהמשתמש חבר בהם (query על `business_members` דרך RLS). בחירת עסק מנווטת ל-`/[businessId]/...` ומנקה state קודם.
- **Files (predicted):**
  - `invoicing-receipts/src/components/business-switcher.tsx` (new)
  - `invoicing-receipts/src/app/(app)/[businessId]/layout.tsx` (new)
- **Acceptance criteria:**
  - משתמש עם 2 עסקים רואה שניהם ב-dropdown עם שם+`entity_type`.
  - בחירת עסק שונה מנווטת ומציגה רק נתוני אותו עסק (אין דליפה חזותית).
  - משתמש עם עסק יחיד לא רואה dropdown פעיל מיותר.
- **Dependencies:** F3.
- **Invariants applied:** multi-tenancy ✅ (UI proof, משלימה את B11).

---

## Open questions / risks

1. ~~RLS ל-`businesses` + bootstrap owner~~ — **נפתר (Amendment A).**
2. **Python בתוך backend-builder:** `api/keygen.py` (B9) הוא Python. סיכון תזמון, לא חסימה.
3. **סביבת CI ל-RLS:** בחירה בין `supabase start` (Docker, איטי) ל-stub ידני ל-`auth` schema (מהיר, סיכון drift) — בסמכות ביצוע backend-builder, לתעד ב-PR.
4. ~~`_migrations` whitelist ב-D7~~ — **נפתר (Amendment A-5, D7 נכתב מחדש כמפת scoping).**
5. **בחירת R2 על פני B2** (B14) — החלטת builder-level שלי, שתיהן שקולות ב-ADR.
6. **היקף frontend Phase 0** — הכרעתי לכלול F1-F4 מינימלי. נקודת יידוע ל-CEO/מייסד, לא חסימה.
7. **חדש: משמעת ה-SECURITY DEFINER whitelist הסגור.** כל פונקציה חדשה עם `SECURITY DEFINER` שתידרש בהמשך הפיתוח (גם בטעות, למשל refactor שמעביר לוגיקה לפונקציית עזר) **תיפול על בדיקת CI (ה)** עד עדכון ADR. זו אכיפה מכוונת (Amendment A-4) — לא לעקוף אותה בהוספת הפונקציה ל-whitelist בקוד הבדיקה בלי לחזור לארכיטקט קודם.
8. **חדש: פער שזיהיתי ותיקנתי בעצמי (לא architect-level) — subtask B10 (storage buckets) חסר מה-plan המקורי**, למרות שהיה ב-must-have. נוסף עכשיו. ראוי לציין ל-CEO כדוגמה לכך שכדאי checklist מול הבריף המקורי לפני שסבב תוכנית נסגר — לא טעות קריטית כי נתפסה לפני dispatch בפועל של B9-B14, אבל שיעור לתהליך.

## Escalations needed

- [x] **לארכיטקט — נפתר (Amendment A, 2026-08-30):** RLS ל-`businesses`, סתירת D7, bootstrap owner, וה-FORCE הגורף שהיה שובר את כל ה-SECURITY DEFINER paths. ראו סעיף ✅ Escalation למעלה.
- אין escalation פתוח נוסף לארכיטקט.
- אין escalation ל-CEO/מייסד שחוסם. פריט #6 ב-Open questions (היקף frontend) נשאר נקודת יידוע בלבד.

## Estimated rounds

- **Workers:** ~7-9 rounds — backend-builder כ-5 dispatch batches (B1-B4 בעבודה כרגע; B5-B8 RLS+audit+immutability+issue_document; B9-B10 create_business+keygen+storage; B11-B12 tests; B13-B14 CI+ops). frontend-builder כ-2-3 batches (F1-F2 מקביל לבקאנד המוקדם; F3-F4 אחרי B9, ללא חסימה יותר).
- **Total estimated wall-clock through review:** 3-5 ימי עבודה כולל סבבי spec-reviewer/code-quality-reviewer. אין יותר תלות בזמן תגובת ארכיטקט (Amendment A נסגר). מומלץ ל-qa-manager לשקול reviewer עם רקע חשבונאי/מס על B7-B9 (immutability/numbering/bootstrap) — הצעה, לא הכרעה שלי.

## Plan Revisions

### Revision 1 — 2026-08-30 — Amendment A applied

**טריגר:** תשובת הארכיטקט ל-escalation שהעליתי ב-Phase 1 (RLS ל-`businesses`, סתירת D7, bootstrap owner) — ADR-INV-001 עודכן עם Amendment Log + §D3.1/§D3.2/§D7 (מחדש)/§D10, וזוהה גם פער רביעי (FORCE גורף שובר SECURITY DEFINER) שלא דיווחתי עליו במקור.

**מה השתנה בתוכנית:**
- B6 (RLS policies) — נכתב מחדש: FORCE רק על `business_signing_keys` (לא גורף), נוספו policies ל-`businesses` (D3.1) + trigger הגנת זהות.
- B7 (audit+immutability) — נוסף: audit trigger חייב לחול גם על `businesses`.
- B9 (create_business+keygen) — **שוחרר מ-BLOCKED**, נכתב במלואו לפי §D10 (RPC מדויק, whitelist שגיאות, מגבלת 10 עסקים).
- B10 (חדש) — Storage buckets+policies, פער שזוהה תוך כדי הסנכרון (היה חסר מה-plan המקורי לגמרי, למרות שהיה ב-must-have של ה-CEO).
- B11 (היה B10, isolation test) — עודכן מ-12 ל-17 assertions (הוספת `businesses` scope-root + 3 בדיקות Amendment-A).
- B13 (היה B12, CI pipeline) — עודכן מ-4 ל-5 בדיקות מטא (FORCE הפוך + SECURITY DEFINER whitelist).
- B5, B8 — תיקוני מספור קבצים בלבד (0004/0008), ללא שינוי scope/AC, כדי ליישר עם המספור הרשמי 0001-0011 של ה-ADR.
- F3 — **שוחרר מ-BLOCKED**, עודכן לזרימת RPC-then-keygen בצד השרת.
- B12, B14 (מספור subtask בלבד, ללא שינוי תוכן).

**מה לא השתנה:** B1-B4 (backend-builder כרגע עובד עליהן) — ללא סתירה, ללא rework. F1, F2, F4 — ללא שינוי.
