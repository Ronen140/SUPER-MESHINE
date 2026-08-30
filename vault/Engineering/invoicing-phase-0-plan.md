# Engineering Work Plan: Invoicing & Receipts — Phase 0 (Scaffold + Backend Engine)

**Date:** 2026-08-30 14:30
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
- [[001-data-model-and-rls]] (ADR-INV-001) — schema מלא (13 טבלאות + 9 enums), RLS על `business_id` דרך `business_members`, `app.current_business_ids()`/`app.has_role()` כ-`SECURITY DEFINER`, `FORCE ROW LEVEL SECURITY`, 4 roles, 3 נתיבי `service_role` סגורים.
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

## ⚠️ Escalation נדרש לארכיטקט — לפני שמתחילים B6/B9 (לא חוסם התחלת עבודה על B1-B5)

בקריאת ADR-INV-001 מצאתי **שני פערי spec** ו**סתירה אחת** ב-RLS design שאינם בסמכותי לפתור (מפר את גבול "מודל multi-tenancy / RLS design" של הארכיטקט):

1. **אין RLS policy מוגדרת לטבלת `businesses` עצמה** בכל ה-ADR (בדקתי עם grep — אין `alter table businesses enable row level security` ואין policies). כל טבלה עסקית אחרת (`customers`, `documents`, וכו') מקבלת את התבנית האחידה מ-D3, אבל `businesses` היא הישות השורשית ואין לה `business_id` — היא לא יכולה לרשת את התבנית כמו שהיא. חסר: מי יכול SELECT (חברי העסק דרך `business_members`?), מי יכול INSERT (כל authenticated?), מי יכול UPDATE/DELETE (owner בלבד?).
2. **סתירה בבדיקת ה-CI (§Implementation Notes #2ג):** הבדיקה נכשלת על "טבלה ב-`public` ללא `business_id` שאינה ברשימה הסגורה [D7: `users`, `vat_rates`, `_migrations`]". `businesses` **אין לה** `business_id` (היא עצמה הישות) **ואינה** ברשימת D7 — כלומר הבדיקה כפי שמוגדרת תיכשל תמיד על `businesses` עצמה. ה-D7 whitelist חייב לכלול את `businesses`, או שהבדיקה צריכה לוגיקה מיוחדת לטבלת-שורש.
3. **בעיית ביצה-ותרנגולת ב-`bm_manage` policy:** ה-policy הכתובה (D3) על `business_members` ל-INSERT/UPDATE/DELETE דורשת `app.has_role(business_id, ['owner'])` — כלומר **כבר להיות owner** של אותו עסק. אבל ביצירת עסק חדש **אין עדיין אף owner** — השורה הראשונה ב-`business_members` (owner ראשון) לא יכולה להיכתב תחת ה-policy הזו. חסר מנגנון bootstrap: כנראה RPC נוסף `app.create_business()` ב-`SECURITY DEFINER` (באותו דפוס כמו `app.issue_document()`) שיוצר את שורת ה-`businesses` + שורת ה-`business_members(role='owner')` הראשונה באטומיות, ועוקף את ה-policy הרגיל באופן מבוקר.

**זו לא החלטה שאני מוסמך לקבל** — זה בדיוק "RLS design" ו-"multi-tenant safety" מטבלת הסמכויות של הארכיטקט. Subtasks B1-B5 (scaffold, extensions, enums, טבלאות, RLS helpers) **אינם תלויים** בתשובה ויכולים להתחיל מיד. B6 (RLS policies) יכול להתקדם על כל הטבלאות **חוץ מ**-`businesses`+`business_members` הבוטסטראפ, וB9 (יצירת עסק + keygen) **חסום** עד תשובת הארכיטקט. מומלץ: escalation קצרה לארכיטקט תוך כדי ש-backend-builder עובד על B1-B5 — לא צריך לעצור את כל הסבב.

## Decomposition

**עקרון סדר:** backend-builder עובד בשרשרת רציפה (B1→B13) כי אלו migrations ממוספרות שכל אחת בונה על הקודמת (עובד יחיד — אין תועלת ב"מקבילי" בין המשימות שלו). frontend-builder עובד ב-4 משימות שרובן יכולות לרוץ **במקביל** לעבודת ה-backend, עם 3 נקודות סנכרון בלבד (F2 צריך B3, F3 צריך B9, F4 צריך F3). Overall: 13 backend subtasks + 4 frontend subtasks = 17.

**הכרעת גבול Phase 0/1 עבור frontend (התבקשתי להכריע):** כלול ב-Phase 0 שלד אפליקציה מינימלי + auth + יצירת עסק + business switcher — **ולא** יותר מזה. נימוק: DoD המקורי של Phase 0 ב-`plan.md` ("משתמש נרשם, יוצר עסק, מחליף בין עסקים; RLS מוכח בבדיקה") הוא UI-facing במפורש, וזו הדרך היחידה שהמייסד בעצמו יוכל להריץ end-to-end acceptance עם משתמש אמיתי (ה-12 assertions ב-CI מוכיחים בידוד ברמת ה-DB עם משתמשי בדיקה סינתטיים — לא מחליפים בדיקת adoption אנושית). עורך המסמכים, קטלוג הפריטים, הדשבורד, ורינדור ה-PDF **נשארים Phase 1** במלואם — היקף frontend כאן הוא מכוון קטן: 4 מסכים בלבד (login/signup, יצירת עסק, switcher, ותפריט צד מינימלי).

---

### Subtask B1 — Project scaffold & tooling

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

- **Assignee:** `backend-builder`
- **Spec:** יצירת `users` (כולל **trigger `on auth.users insert` שמכניס שורת `public.users` תואמת** — נדרש לאפליקציה כדי שיהיה `full_name`/`locale` ל-משתמש חדש; לא מוזכר במפורש ב-ADR אך נגזר ישירות מ-D7 שמניח `users` קיימת), `vat_rates` (+ seed 2 השורות מה-ADR), `businesses`, `business_members` (+ trigger "לפחות owner אחד" מ-D4), `business_signing_keys`, `customers`, `items`, `customer_document_consents` — כל העמודות, CHECK constraints, ואינדקסים בדיוק כפי שמופיעים ב-ADR-INV-001 §Schema (כולל עמודות Phase 2: `withholding_tax_rate` על `customers`).
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0003_core_tables.sql` + down מקביל
- **Acceptance criteria:**
  - כל 8 הטבלאות קיימות עם העמודות המדויקות מה-ADR (`\d+ <table>` תואם); `vat_rates` מכיל 2 שורות seed (17.00 עד 2024-12-31, 18.00 מ-2025-01-01).
  - `tax_id_digits`, `tax_id_uk`, `items_name_uk`, `customers_taxid_uk`, `consent_active_uk` וכל שאר ה-constraints/indexes מה-ADR קיימים (נבדק ב-`pg_constraint`/`pg_indexes`).
  - טריגר `on auth.users` יוצר שורת `public.users` תואמת תוך כדי הרשמת משתמש בדיקה — נבדק ב-Vitest אינטגרציה מול Supabase local.
  - נסיון `DELETE` שמותיר `business_members` בלי אף `owner` נכשל עם exception (בדיקה: עסק עם owner יחיד, מנסים למחוק/לשנות role שלו ל-editor → נכשל).
  - down script מסיר את כל 8 הטבלאות + הטריגר + seed, בסדר תלות נכון.
- **Dependencies:** B2.
- **Invariants applied:** multi-tenancy ✅ (schema בלבד בשלב זה, RLS ב-B6), audit N/A עדיין, agent gating N/A, migration rollback ✅.

### Subtask B4 — Migration 0003b: document tables (documents, lines, payments, counters, allocation, public links, audit_log)

- **Assignee:** `backend-builder`
- **Spec:** יצירת `documents`, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `audit_log` — כל העמודות (כולל Phase 2/3: `allocation_number`, `allocation_request_id`, `withholding_rate`, `withholding_amount`), כל ה-CHECK constraints (`doc_type_allowed_for_entity`, `patur_has_no_vat`, `credit_needs_parent`, `credited_within_total`, `ils_only_phase1`, וכו'), עמודת ה-`generated always as` (`signed_total`), וכל האינדקסים כולל ה-partial indexes, בדיוק כפי שמופיעים ב-ADR-INV-001 §Schema.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0004_document_tables.sql` + down מקביל
- **Acceptance criteria:**
  - כל 7 הטבלאות קיימות עם העמודות/constraints/indexes המדויקים (כולל `documents_number_uk` ה-partial unique index).
  - בדיקת CHECK: ניסיון INSERT ל-`documents` עם `business_entity_type='patur'` ו-`type='tax_invoice'` נכשל (`doc_type_allowed_for_entity`); ניסיון עם `vat_amount>0` ו-`business_entity_type='patur'` נכשל (`patur_has_no_vat`).
  - `signed_total` מחושב נכון: שורת `credit_note` עם `total_amount=100` מניבה `signed_total=-100`; שורה רגילה עם `total_amount=100` מניבה `100`.
  - down script מסיר את כל 7 הטבלאות בסדר תלות נכון (FK-aware).
- **Dependencies:** B3 (FK ל-`businesses`, `customers`, `business_signing_keys`).
- **Invariants applied:** multi-tenancy ✅ (עמודות `business_id` בכל טבלה, FK מורכב), audit N/A עדיין, migration rollback ✅.

### Subtask B5 — Migration 0004: RLS helper functions

- **Assignee:** `backend-builder`
- **Spec:** יצירת schema `app` (revoke מ-`anon`/`authenticated`), `app.current_business_ids()` ו-`app.has_role(uuid, member_role[])` בדיוק כפי שמוגדרות ב-ADR-INV-001 §D3 — `SECURITY DEFINER`, `STABLE`, `set search_path = public, pg_temp`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0005_rls_helpers.sql` + down מקביל
- **Acceptance criteria:**
  - `select proname, prosecdef, provolatile from pg_proc where proname in ('current_business_ids','has_role')` מראה `prosecdef=true` (definer) ו-`provolatile='s'` (stable) לשתי הפונקציות.
  - `grant`/`revoke` על schema `app` נבדק: `anon`/`authenticated` **לא** יכולים `select`/`execute` ישירות על אובייקטים ב-`app` מלבד דרך grant מפורש על הפונקציות עצמן.
  - בדיקת יחידה: משתמש בדיקה A עם חברות בעסק X → `app.current_business_ids()` מחזיר `{X}` בלבד (לא רקורסיה, לא timeout).
- **Dependencies:** B3 (`business_members`).
- **Invariants applied:** multi-tenancy ✅ (זו תשתית האכיפה).

### Subtask B6 — Migration 0005: RLS policies (כל הטבלאות למעט `businesses`/`business_members` bootstrap — ראה Escalation)

- **Assignee:** `backend-builder`
- **Spec:** `enable row level security` + `force row level security` על **כל** טבלה עסקית, ויישום ה-policies המדויקות מה-ADR: תבנית `customers_read`/`customers_write` (ואותה תבנית ל-`items`, `customer_document_consents`, `documents`, `document_lines`, `payments`, `allocation_requests`, `document_public_links`); `document_counters` — SELECT בלבד, **אין** policy כתיבה; `audit_log` — SELECT בלבד, **אין** policy INSERT/UPDATE/DELETE כלל; `business_signing_keys` — enable+force, **אפס policies** (default deny מוחלט). `business_members` policies (`bm_self`, `bm_peers`) לפי D3 — **אך לא** `bm_manage` (חסום ב-escalation, ראו למעלה) — לזה יתווסף patch נפרד ברגע שהארכיטקט מאשר את מנגנון ה-bootstrap. `businesses` עצמה — **ללא policy בשלב זה** (Escalation פתוח) — מתועד בפירוש בהערת קוד בראש הקובץ שמפנה ל-escalation הזה, כדי ש-code-quality-reviewer לא יסמן את זה כשגיאה סמויה.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0006_rls_policies.sql` + down מקביל
- **Acceptance criteria:**
  - `select relrowsecurity, relforcerowsecurity from pg_class where relname in (<כל 13 הטבלאות למעט businesses>)` מראה `true, true` לכולן.
  - `business_signing_keys`: `select count(*) from pg_policies where tablename='business_signing_keys'` = 0.
  - `document_counters`, `audit_log`: יש policy SELECT בלבד, `select count(*) from pg_policies where tablename in (...) and cmd != 'SELECT'` = 0.
  - בדיקת non-recursion: query על `business_members` דרך `bm_peers` לא תלוי ב-timeout/stack overflow (מריצים 100 שאילתות רצופות, כולן חוזרות תחת 100ms).
  - `businesses` נשארת ללא RLS מופעל בכוונה — מתועד בקומנט מפורש בראש המיגרציה + ב-PR description; **לא** מוגדר כ-AC "ירוק" עד ה-escalation ייסגר (ראו סעיף DoD).
- **Dependencies:** B4, B5.
- **Invariants applied:** multi-tenancy ✅ (למעט `businesses` — פתוח, ראו Escalation).

### Subtask B7 — Migration 0006: audit trigger + immutability triggers

- **Assignee:** `backend-builder`
- **Spec:** (א) `app.audit_trigger()` — קוראת `auth.uid()`, `current_setting('request.jwt.claims', true)` ל-email, `current_setting('app.request_id', true)`; מוחלת על כל טבלה עם `business_id` **חוץ מ**-`business_signing_keys`/`audit_log`; `app.enforce_audit(regclass)` helper. `audit_log_immutable_trg` — מעלה exception על כל UPDATE/DELETE. (ב) `app.documents_immutable()` — **בדיוק** לפי ADR-INV-002 §D3: whitelist מפורש, default-deny על שאר השדות, הסרת שדות ה-PDF מה-whitelist כש-`pdf_status='ready'`, בדיקת מעבר status מוגבל. `documents_immutable_trg` (`before update or delete ... when (old.status <> 'draft')`). `app.child_rows_locked()` על `document_lines`/`payments`. Trigger נעילה על `allocation_requests` (UPDATE אחרי `responded_at is not null`, DELETE תמיד). Trigger `BEFORE INSERT ON documents` שממלא `business_entity_type` snapshot מ-`businesses`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0007_audit_immutability.sql` + down מקביל
- **Acceptance criteria:**
  - `app.enforce_audit()` הוחל על כל הטבלאות ה-business_id-bearing חוץ מ-2 החריגים — נבדק בשאילתת CI (ראו B12, בדיקה #4).
  - `UPDATE audit_log SET action='x' WHERE id=1` נכשל עם exception, **גם תחת `service_role`**.
  - מסמך מדומה עם `status='issued'`: `UPDATE documents SET total_amount = total_amount + 1` נכשל עם `INV_IMMUTABLE_FIELDS`; `UPDATE documents SET paid_amount = 50` **מצליח** (whitelist); `DELETE FROM documents WHERE status='issued'` נכשל עם `INV_IMMUTABLE_DELETE`.
  - כש-`pdf_status='ready'`: `UPDATE documents SET pdf_status='pending'` נכשל (הוסר מה-whitelist).
  - `INSERT INTO document_lines` על מסמך `issued` נכשל.
  - INSERT חדש ל-`documents` מקבל `business_entity_type` תואם ל-`businesses.entity_type` של אותו `business_id` אוטומטית, ללא צורך לספק אותו.
- **Dependencies:** B4, B5 (audit trigger צריך `auth.uid()`/`app` schema).
- **Invariants applied:** audit log ✅ (על כל mutation), migration rollback ✅.

### Subtask B8 — Migration 0007: `app.issue_document()` + `app.seed_for()` + `app.set_start_number()`

- **Assignee:** `backend-builder`
- **Spec:** מימוש מדויק של ADR-INV-002 §D1-D2: הקצאת מספר ב-`UPDATE document_counters ... RETURNING` (לא `SEQUENCE`), `app.seed_for()` (continuous/yearly לפי D9 ב-ADR-001), הרצף המלא של 11 הצעדים ב-D2 (נעילת מסמך, אימות חברות/role, אימות draft, רענון `business_entity_type`, אימותי תוכן כולל בדיקת `business_signing_keys` פעיל [`INV_NO_SIGNING_KEY`], חישוב מחדש של סכומים מ-`document_lines`+`vat_rates`, snapshots, הקצאת מספר+`display_number`, מעבר סטטוס ל-`issued`, עדכון `credited_amount` באב, audit_log מפורש `action='issue'`). `app.set_start_number()` — `SECURITY DEFINER`, מותר רק כש-`next_number=start_number`, רק ל-owner. `grant execute` על `issue_document`/`set_start_number` ל-`authenticated` בלבד; `revoke` מ-`anon`. מיפוי קודי שגיאה `INV_*` ל-`src/lib/errors.ts`.
- **Files (predicted):**
  - `invoicing-receipts/supabase/migrations/0008_issue_document.sql` + down מקביל
  - `invoicing-receipts/src/lib/errors.ts` (new — מילון `INV_*` → הודעת עברית)
- **Acceptance criteria:**
  - קריאה ל-`issue_document()` על טיוטה תקינה (יש שורה, יש customer_id, סוג מותר לישות, יש מפתח חתימה פעיל) מייצרת `document_number=1` (עסק חדש, סוג חדש, שנה נוכחית), `status='issued'`, `issued_at`/`issue_date` מלאים, snapshots לא null.
  - קריאה שנייה על אותו עסק/סוג/שנה מייצרת `document_number=2`.
  - קריאה על מסמך `status='issued'` נכשלת עם `INV_ALREADY_ISSUED`.
  - קריאה ללא מפתח חתימה פעיל לעסק נכשלת עם `INV_NO_SIGNING_KEY`.
  - קריאה עם `sum(payments.amount) != payable_amount` על מסמך תקבול נכשלת עם `INV_PAYMENTS_MISMATCH`.
  - זיכוי שחורג מ-`parent.total_amount - parent.credited_amount` נכשל עם `INV_CREDIT_EXCEEDS_PARENT`.
  - הסכומים הסופיים על המסמך המופק **תמיד** נגזרים מ-`document_lines` (בדיקה: שולחים `total_amount` שגוי בטיוטה, הפונקציה דורסת אותו לערך הנכון).
  - `set_start_number` על סדרה שכבר הופק בה מסמך נכשל.
- **Dependencies:** B7 (immutability triggers חייבים להיות במקום כדי לוודא שהפונקציה לא מתנגשת איתם), B3 (vat_rates seed).
- **Invariants applied:** audit log ✅, agent gating N/A (אין סוכני AI כאן), migration rollback ✅.

### Subtask B9 — `api/keygen.py` + `POST /api/businesses` (BLOCKED — ראו Escalation)

- **Assignee:** `backend-builder`
- **Status:** **חסום עד תשובת ארכיטקט** על (א) RLS ל-`businesses`, (ב) מנגנון bootstrap ל-owner ראשון ב-`business_members`.
- **Spec (לביצוע אחרי תשובה):** `api/keygen.py` (Python, Vercel runtime) — RSA-3072 keypair, תעודת X.509 self-issued לפי ADR-INV-003 §D4 (CN/serialNumber/O/C, 10 שנות תוקף, KeyUsage/ExtendedKeyUsage כמפורט), envelope encryption (DEK אקראי 32B, AES-256-GCM, `wrapped_dek` מוצפן ב-`SIGNING_MASTER_KEK_V1`), INSERT ל-`business_signing_keys`. `POST /api/businesses` (Next.js route) — קורא ל-RPC ה-bootstrap שהארכיטקט יאשר (ולא ל-INSERT ישיר), ואז קורא ל-`api/keygen.py` אחרי commit. כשל ב-keygen לא משאיר עסק בלי אפשרות ליצור מפתח מאוחר (retry path).
- **Files (predicted):**
  - `invoicing-receipts/api/keygen.py` (new)
  - `invoicing-receipts/requirements.txt` (new — `cryptography`, מוצמד בגרסה)
  - `invoicing-receipts/src/app/api/businesses/route.ts` (new)
  - `invoicing-receipts/src/server/service-role/` — **אין** צורך כאן אם ה-bootstrap הוא RPC (`SECURITY DEFINER` מריץ עם ה-JWT של המשתמש, לא service_role) — לאשר מול הפתרון שהארכיטקט יחזיר.
- **Acceptance criteria (טיוטה, סופי אחרי תשובת ארכיטקט):**
  - `POST /api/businesses` עם payload תקין יוצר בדיוק שורת `businesses` אחת + שורת `business_members(role='owner')` אחת עבור היוצר, באטומיות (rollback משותף בכשל).
  - בדיוק שורת `business_signing_keys(is_active=true)` אחת נוצרת תוך ≤5 שניות מיצירת העסק (נבדק ב-polling test).
  - ה-`certificate_pem` שנוצר תקף (parse-able כ-X.509, `notAfter` ≈ now+10y ±1 יום).
  - `private_key_ciphertext`/`wrapped_dek`/`private_key_nonce` — none מהם מכיל את המפתח הפרטי בטקסט גלוי (בדיקת string-search שלילית).
  - כשל בקריאה ל-keygen (למשל KEK env חסר) לא יוצר שורת `business_signing_keys` חלקית ולא מפיל את יצירת העסק — מוחזרת שגיאה ברורה + נתיב retry.
- **Dependencies:** B6 (RLS מלא, כולל resolution של ה-escalation), B3.
- **Invariants applied:** multi-tenancy ✅ (בכפוף לפתרון הארכיטקט), audit ✅ (`action='key_create'` נכתב ידנית — הטבלה עצמה בלי audit trigger).

### Subtask B10 — Isolation test suite (12 assertions)

- **Assignee:** `backend-builder`
- **Spec:** לפי ADR-INV-001 §Implementation Notes #3: שני משתמשי בדיקה (A, B), שני עסקים (X בבעלות A, Y בבעלות B), ו-12 assertions — SELECT/INSERT/UPDATE/DELETE של A על כל אחת מהטבלאות העיקריות של B (`customers`, `items`, `documents`), כולל ניסיון INSERT ל-`documents` עם `business_id=Y` תחת session של A. **כולן** חייבות להיכשל/להחזיר 0 שורות.
- **Files (predicted):**
  - `invoicing-receipts/tests/isolation.test.ts` (new — Vitest, מריץ מול Supabase local עם 2 Supabase JS clients בעלי JWT שונים)
- **Acceptance criteria:**
  - 12/12 assertions ירוקות ב-`pnpm test` (רשימה מפורשת בקוד הבדיקה, לא רק "כמה בדיקות עברו").
  - הבדיקה עצמה נכשלת (red) אם מריצים אותה זמנית נגד DB עם `force row level security` כבוי על טבלה — כלומר היא **אכן** בודקת RLS ולא false positive (מאומת ידנית פעם אחת ע"י backend-builder לפני מסירה, מתועד ב-PR description).
  - זמן ריצה כולל < 10 שניות.
- **Dependencies:** B6 (RLS policies על `customers`/`items`/`documents` לפחות).
- **Invariants applied:** multi-tenancy ✅ — זו בדיקת ה-invariant עצמה.

### Subtask B11 — Numbering race test (20 concurrent issues)

- **Assignee:** `backend-builder`
- **Spec:** לפי ADR-INV-002 §Implementation Notes #2: 20 טיוטות תקינות של אותו עסק+סוג מסמך (עם שורות פריט תקינות, לקוח, ותשלומים אם רלוונטי), ו-20 קריאות **מקבילות** ל-`issue_document()`. **פישוט מכוון:** הטסט מזריק שורת `business_signing_keys` דמה (ללא crypto אמיתי) ישירות ל-DB דרך חיבור ישיר (לא דרך `api/keygen.py`) כדי לספק את `INV_NO_SIGNING_KEY` precondition בלי תלות ב-B9 — מתעד את הפישוב הזה בקומנט בקוד הבדיקה.
- **Files (predicted):**
  - `invoicing-receipts/tests/numbering-race.test.ts` (new)
- **Acceptance criteria:**
  - 20 הקריאות מסתיימות ללא error בלתי-צפוי (0 exceptions מלבד ה-flow התקין).
  - `document_number` הסופיים הם קבוצה של 20 מספרים שלמים רצופים ללא כפילות: `count(distinct document_number) = 20` וגם `max(document_number) - min(document_number) = 19`.
  - `document_counters.next_number` הסופי = `min(document_number) + 20`.
  - הרצה חוזרת של אותה בדיקה (20 טיוטות חדשות, אותו עסק/סוג) ממשיכה מהמספר הבא ברצף (לא מתאפסת) — מוודא את מדיניות `continuous`.
- **Dependencies:** B8.
- **Invariants applied:** migration rollback N/A, multi-tenancy N/A (בדיקה חד-עסקית), audit N/A ישיר (נבדק עקיפות ב-B7).

### Subtask B12 — CI pipeline (GitHub Actions)

- **Assignee:** `backend-builder`
- **Spec:** `ci.yml` — מריץ על כל push/PL: `supabase start` (או container Postgres תואם, לפי שיקול backend-builder — כל עוד `auth.uid()`/`auth.users` זמינים לבדיקות RLS), מריץ את כל ה-up migrations בסדר, מריץ down-then-up roundtrip (כל ה-migrations יורדות בסדר הפוך ואז עולות שוב — `public` schema (בניכוי סכימות מנוהלות ע"י Supabase) מגיע ל-0 טבלאות אחרי ה-down המלא), מריץ את 4 בדיקות ה-CI המטא: (א) טבלה ללא RLS, (ב) טבלה ללא FORCE RLS, (ג) טבלה ללא `business_id` שאינה ברשימה הסגורה **המתוקנת** (אחרי resolution של ה-escalation — כולל `businesses`), (ד) טבלה עם `business_id` שאין לה audit trigger מלבד 2 החריגים. מריץ B10+B11. מריץ `pnpm lint`/`typecheck`/`test`/`build`.
- **Files (predicted):**
  - `invoicing-receipts/.github/workflows/ci.yml` (new)
  - `invoicing-receipts/scripts/ci-schema-checks.sql` (new — 4 השאילתות)
  - `invoicing-receipts/scripts/migrate-down-up-roundtrip.sh` (new)
- **Acceptance criteria:**
  - כל 4 שאילתות ה-CI מחזירות 0 שורות על DB אחרי כל המיגרציות.
  - `migrate-down-up-roundtrip.sh` מסתיים ב-exit 0 ו-schema `public` זהה (diff ריק) לפני ה-down ואחרי ה-up החוזר.
  - B10, B11 רצות בתוך ה-workflow ומדווחות ירוק ב-GitHub Checks.
  - workflow שלם רץ ב-CI < 8 דקות (budget סביר לפרויקט בסדר גודל הזה).
- **Dependencies:** B1-B11 (כל הקודמים — זהו ה-capstone).
- **Invariants applied:** כל 4 ה-invariants נבדקים כאן במפורש.

### Subtask B13 — Ops jobs: daily keepalive + weekly encrypted backup + monthly restore-test skeleton

- **Assignee:** `backend-builder`
- **Spec:** לפי ADR-INV-003 §D5: `keepalive.yml` — GitHub Actions cron יומי, בקשת HTTP אחת (או פינג ל-DB) שמאפסת את מונה ההשעיה של Supabase. `backup.yml` — cron שבועי: `pg_dump` מלא + `age` encrypt עם מפתח ציבורי (env secret), העלאה ל-**Cloudflare R2** (נבחר כברירת מחדל בין R2/B2 — S3-compatible API, החלטת builder-level, לא ADR-level). **מכיוון שאין credentials אמיתיים כרגע:** ב-CI רץ dry-run מול endpoint מדומה (למשל `minio` container מקומי בתוך ה-workflow, או mock עם `curl` ל-httpbin) — נבדק שהקוד **מנסה** להתחבר ולהעלות, לא שהוא מדלג בשקט. `restore-test.yml` (חודשי, skeleton בלבד) — פענוח + אימות `pdf_sha256` על מדגם (ריק בפועל ב-Phase 0 כי אין עדיין PDF-ים אמיתיים — Phase 1). כל workflow מתועד ב-README עם הוראות למייסד איך להזין credentials אמיתיים כשיהיו (R2 access key, `age` private key, `SUPABASE_DB_URL`).
- **Files (predicted):**
  - `invoicing-receipts/.github/workflows/keepalive.yml`, `backup.yml`, `restore-test.yml` (new)
  - `invoicing-receipts/scripts/backup.sh` (new)
  - `invoicing-receipts/docs/ops-runbook.md` (new — הוראות הפעלה עם credentials אמיתיים)
- **Acceptance criteria:**
  - `keepalive.yml` ו-`backup.yml` תקפים תחביריים (`actionlint`/`yamllint` exit 0) ורצים ב-CI (על credentials מדומים) ללא שגיאת syntax/runtime — dry-run מסתיים exit 0.
  - `backup.sh` מריץ `pg_dump` אמיתי מול ה-DB המקומי בבדיקה ומייצר קובץ מוצפן תקין (ניתן לפענוח חזרה עם המפתח הפרטי המדומה — round-trip test).
  - README/`ops-runbook.md` כולל רשימת בדיוק אילו GitHub Secrets המייסד צריך להזין לפני שה-jobs יעבדו בפועל מול R2 אמיתי.
- **Dependencies:** B12 (ה-CI infrastructure כבר קיים).
- **Invariants applied:** N/A ישיר (זו תשתית DR, לא invariant מהרשימה — אך משרתת את חובת הארכיון 7 שנים מה-ADR).

---

### Subtask F1 — App shell: shadcn/ui init + RTL layout + Supabase client wiring

- **Assignee:** `frontend-builder`
- **Spec:** `shadcn/ui` init (button, input, form, label, card, dialog, dropdown-menu, sonner/toast, avatar — הסט המינימלי לצורך auth+switcher). Layout גלובלי עם `dir="rtl" lang="he"`, Tailwind v4 עם logical properties בלבד (`margin-inline-start` וכו', **לא** `margin-left`/`margin-right` באף מקום), טוקן צבע בסיסי (stone neutral + emerald primary אחד — בלי מערכת עיצוב מלאה, זו Phase 1). `src/lib/supabase/browser.ts` + `src/lib/supabase/server.ts` (Supabase JS client factories, browser vs server-component/route-handler).
- **Files (predicted):**
  - `invoicing-receipts/src/app/layout.tsx` (edit)
  - `invoicing-receipts/src/components/ui/*` (new — shadcn generated)
  - `invoicing-receipts/src/lib/supabase/browser.ts`, `server.ts` (new)
  - `invoicing-receipts/tailwind.config.ts` / `globals.css` (edit — טוקנים + RTL base)
- **Acceptance criteria:**
  - עמוד ריק נטען ב-`localhost:3000` עם `dir="rtl"` על `<html>`, פונט קריא בעברית (fallback מערכת מקובל — Assistant המלא הוא Phase 1).
  - grep על `src/` לא מוצא אף מופע של `margin-left`/`margin-right`/`padding-left`/`padding-right`/`text-align: left/right` (רק logical properties).
  - `createSupabaseBrowserClient()` ו-`createSupabaseServerClient()` שתיהן טסט-מכוסות בבדיקת unit (מוודאת שה-URL/anon-key נטענים מ-env, זורקות שגיאה ברורה אם חסרים).
  - בדיקה בדפדפן (browser verification): העמוד נטען ללא שגיאת console, ללא flash של LTR לפני RTL.
- **Dependencies:** B1.
- **Invariants applied:** N/A.

### Subtask F2 — Auth flow: signup/login/logout

- **Assignee:** `frontend-builder`
- **Spec:** דפי `/login`, `/signup` (Supabase Auth email+password), session handling ב-middleware (`middleware.ts`) שמפנה משתמש לא-מחובר מכל route תחת `/(app)` ל-`/login`, ומפנה משתמש מחובר בלי אף עסק (`business_members` ריק) ל-`/businesses/new`. Logout button.
- **Files (predicted):**
  - `invoicing-receipts/src/app/(auth)/login/page.tsx`, `signup/page.tsx` (new)
  - `invoicing-receipts/src/middleware.ts` (new)
  - `invoicing-receipts/src/components/auth/logout-button.tsx` (new)
- **Acceptance criteria:**
  - הרשמת משתמש חדש (email+password) מול Supabase local יוצרת שורת `auth.users` **וגם** `public.users` (דרך ה-trigger מ-B3) — נבדק ב-browser: נרשמים, בודקים ב-`supabase studio` local שהשורה קיימת בשתי הטבלאות.
  - התחברות מוצלחת מפנה ל-`/businesses/new` (אין עסקים עדיין).
  - גישה ל-route מוגן ללא session מפנה ל-`/login` (נבדק: פותחים tab פרטי, מנסים לגשת ישירות ל-`/app/...`).
  - Logout מנקה session ומפנה ל-`/login`.
- **Dependencies:** F1, B3 (טבלת `users` + trigger).
- **Invariants applied:** N/A.

### Subtask F3 — Business creation form

- **Assignee:** `frontend-builder`
- **Spec:** טופס `/businesses/new` (react-hook-form + zod): `legal_name`, `entity_type` (patur/murshe), `tax_id` (ולידציית 9 ספרות בצד לקוח, תואם `tax_id_digits` constraint), `address_line1`, `city`, `phone`, `email`. שולח ל-`POST /api/businesses` (B9). מציג הודעת הצלחה + spinner בזמן יצירת מפתח החתימה ("מכינים את חשבון החתימה שלך") עד שהעסק מוכן, ואז מפנה ל-`/[businessId]`.
- **Files (predicted):**
  - `invoicing-receipts/src/app/(app)/businesses/new/page.tsx` (new)
  - `invoicing-receipts/src/lib/schemas/business.ts` (new — zod schema)
- **Acceptance criteria:**
  - שליחת טופס תקין יוצרת עסק (נבדק דרך UI: אחרי שליחה, `/[businessId]` נטען ומציג את שם העסק).
  - `tax_id` עם פחות/יותר מ-9 ספרות נחסם client-side עם הודעת שגיאה בעברית, לפני קריאת API.
  - שגיאת שרת (למשל keygen נכשל) מוצגת למשתמש בעברית, לא stack trace גולמי.
  - זמן מ-submit ועד ניווט מוצלח: p95 < 5 שניות בסביבת פיתוח מקומית (כולל keygen).
- **Dependencies:** F2, B9 (חסום כמו B9 — לא יכול להתחיל לפני שה-escalation נסגר ו-B9 מוכן).
- **Invariants applied:** N/A ישיר בצד frontend.

### Subtask F4 — Business switcher

- **Assignee:** `frontend-builder`
- **Spec:** Dropdown בראש ה-sidebar (דפוס Notion, לפי `plan.md` §6) שמציג את כל העסקים שהמשתמש חבר בהם (query על `business_members` דרך RLS — אין צורך ב-service_role, ה-RLS policy `bm_self`/`bm_peers` כבר מגבילה). בחירת עסק מעדכנת את ה-route ל-`/[businessId]/...` ומנקה state קודם (ניווט מלא ל-root של העסק, לא soft-navigation שמשאיר state).
- **Files (predicted):**
  - `invoicing-receipts/src/components/business-switcher.tsx` (new)
  - `invoicing-receipts/src/app/(app)/[businessId]/layout.tsx` (new — sidebar + switcher)
- **Acceptance criteria:**
  - משתמש עם 2 עסקים (patur + murshe, נוצרו דרך F3 פעמיים) רואה את שניהם ב-dropdown עם השם וה-`entity_type` (תווית "עוסק פטור"/"עוסק מורשה").
  - בחירת עסק שונה מנווטת ל-`/<businessId>` הנכון ומציגה רק את הנתונים של אותו עסק (אין דליפה חזותית מהעסק הקודם — נבדק ב-browser: יוצרים לקוח דמה בעסק A [דרך SQL ישיר לבדיקה, אין טופס לקוחות עדיין], מחליפים לעסק B, מוודאים שהוא לא מופיע בשום מקום ב-UI).
  - משתמש עם עסק יחיד לא רואה dropdown פעיל (או רואה אותו disabled) — אין בלבול UX מיותר.
- **Dependencies:** F3.
- **Invariants applied:** multi-tenancy ✅ (זו ה-UI proof של הבידוד, משלימה את B10).

---

## Open questions / risks

1. **[חוסם, ראו Escalation למעלה]** RLS ל-`businesses` + מנגנון bootstrap ל-owner ראשון — B9/F3 לא יכולים להתחיל בלעדיו.
2. **Python בתוך backend-builder:** `api/keygen.py` (B9) הוא Python, שונה מה-TypeScript הרגיל של backend-builder בפרויקטי SUPER-MESHINE. אין builder ייעודי ל-Python בארגון הזה. מסמן כסיכון תזמון (ramp-up אפשרי), לא כחסימה — backend-builder אחראי גם על venv/`requirements.txt`/pytest ל-חלק הזה בלבד.
3. **סביבת CI ל-RLS:** `auth.uid()`/`auth.users` הם ספציפיים ל-Supabase (לא Postgres גולמי). backend-builder צריך להריץ CI מול `supabase start` (Docker-based, כבד/עלול להיות איטי/flaky ב-GitHub Actions) או Postgres רגיל + stub ידני ל-`auth` schema (מהיר יותר, סיכון drift מול production). ההחלטה בסמכות backend-builder בביצוע, אך יש לתעד את הבחירה ב-PR — אם ייבחר stub, יש לוודא שהוא תואם התנהגותית (`auth.uid()` מחזיר את ה-JWT `sub` הנכון).
4. **`_migrations` whitelist ב-D7:** ADR-INV-001 מניח טבלת `public._migrations` בעוד Supabase CLI native migrations עוקבות במנגנון פנימי משלהן (`supabase_migrations.schema_migrations`, לא ב-`public`). לא חוסם — ה-CI meta-check (B12) פשוט לא ימצא טבלה כזו ב-`public`, מה שהופך את הרשומה ל-D7 ללא-רלוונטית. מומלץ לציין זאת לארכיטקט כתיקון קוסמטי ל-ADR בהזדמנות, לא דחוף.
5. **בחירת R2 על פני B2** (B13) היא החלטת builder-level שלי (שתיהן מאושרות ב-ADR כאופציות שקולות) — אם למייסד יש כבר חשבון קיים באחת מהן, שווה לוודא לפני B13.
6. **היקף frontend Phase 0** (הכרעתי: minimal shell+auth+business creation+switcher בלבד) — אם ה-CEO/מייסד מעדיף לדחות **את כל** ה-frontend ל-Phase 1 ולסמוך רק על ה-12 CI assertions כהוכחת בידוד, F1-F4 נשמטים מהסבב הזה לגמרי ו-Phase 0 מצטמצם ל-backend בלבד (B1-B13). זו נקודת אישור טובה לבדוק מול CEO/מייסד לפני dispatch בפועל, גם אם טכנית בסמכותי.

## Escalations needed

- [x] **לארכיטקט (חוסם B9/F3 בלבד, לא את שאר הסבב):** RLS policies ל-`businesses` (SELECT/INSERT/UPDATE/DELETE) + תיקון סתירת ה-D7 whitelist (`businesses` חסרת `business_id` ולא ברשימה) + מנגנון bootstrap ל-owner ראשון ב-`business_members` (chicken-and-egg מול `bm_manage` policy — כנראה RPC `app.create_business()` בדפוס `SECURITY DEFINER` כמו `issue_document()`). פירוט מלא בסעיף ⚠️ למעלה.
- [ ] לארכיטקט (לא דחוף): תיקון קוסמטי ל-D7 בעניין `_migrations` (סעיף Open questions #4).
- אין escalation ל-CEO/מייסד שחוסם את תחילת העבודה. פריט #6 ב-Open questions (היקף frontend) הוא נקודת יידוע, לא חסימה — הגשתי הכרעה מפורשת ואפשר להתחיל B1-B8 (וגם F1-F2 אם מאושר) תוך כדי בירור.

## Estimated rounds

- **Workers:** ~6-8 rounds — backend-builder ככל הנראה 4 dispatch batches (B1-B2 scaffold+migrations בסיס; B3-B5 core tables+RLS helpers; B6-B8 policies+audit+immutability+issue_document, ממתין ל-escalation; B9-B13 keygen+tests+CI+ops אחרי resolution). frontend-builder כ-2 batches (F1-F2 מקביל לבקאנד המוקדם; F3-F4 אחרי B9).
- **Total estimated wall-clock through review:** תלוי משמעותית בזמן תגובת הארכיטקט על ה-escalation (חוסם רק B9/F3, לא את שאר 15 מתוך 17 המשימות). בהנחת תגובה מהירה (שעות) — 3-5 ימי עבודה כולל סבבי review (spec-reviewer + code-quality-reviewer על כל migration; מומלץ ל-qa-manager לשקול reviewer עם רקע חשבונאי/מס על B6-B8 בגלל הרגישות המשפטית של immutability/numbering, גם בלי erp-domain-expert רשמי — זו הצעה, לא הכרעה שלי).
