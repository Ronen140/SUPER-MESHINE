# ADR-INV-001: מודל נתונים ובידוד רב-עסקי (RLS)

**Date:** 2026-08-30
**Status:** Accepted
**Amended:** 2026-08-30 — Amendment A, B, C (ראה סעיף "Amendment Log")
**Decider:** Architect (proposed), CEO (final approval)
**Scope:** פרויקט `invoicing-receipts` — עצמאי, מחוץ ל-pnpm workspace של ה-ERP.
**Related:** [[002-multi-tenancy-strategy]], [[006-audit-log-and-agent-action-gating]] (עקרונות הבית — יורשים, לא מיישמים 1:1), ADR-INV-002, ADR-INV-003.

---

## Amendment Log

### Amendment A — 2026-08-30 (escalation מ-engineering-manager, חסם B9/F3)

| # | הפער | התיקון |
|---|---|---|
| A-1 | אין RLS policies לטבלת `businesses` עצמה | §D3.1: SELECT לחברים, UPDATE ל-owner, **ללא INSERT/DELETE policies** |
| A-2 | בדיקת CI של D7 נכשלת תמיד על `businesses` | §D7 נכתב מחדש כ**מפת scoping**; `businesses` = scope-root על `id` |
| A-3 | ביצה-ותרנגולת ביצירת עסק | `create_business()` ב-`SECURITY DEFINER` (§D10) |
| A-4 | **פער שלא דווח:** `FORCE ROW LEVEL SECURITY` הגורף **שובר את כל דפוס ה-SECURITY DEFINER** | §D3.2: FORCE יורד מכל הטבלאות **פרט ל-`business_signing_keys`** |
| A-5 | (קוסמטי) `_migrations` | הוסרה — `supabase_migrations.schema_migrations` מחוץ ל-`public` |

**הסבר ל-A-4:** תחת `FORCE`, גם בעלת הטבלה כפופה ל-policies. פונקציית `SECURITY DEFINER` רצה בזהות בעליה (`postgres`), שאינו חבר ב-`authenticated` — ולכן אף policy לא חלה והתוצאה היא **דחייה**, לא בייפאס. תיעוד Postgres מפורש: definer מדלגת על RLS רק אם בעליה יכול — בעל `BYPASSRLS`, או בעלות על טבלה שאינה `FORCE`. הסתמכות על `BYPASSRLS` של `postgres` ב-Supabase היא הנחת פלטפורמה, לא חוזה.

### Amendment B — 2026-08-30 (ממצאי backend-builder בסיום B5-B8)

| # | הממצא | התיקון |
|---|---|---|
| B-1 | `handle_new_auth_user()` definer לגיטימי מחוץ ל-whitelist | נוסף. נשאר ב-`public` (§D3.3) |
| B-2 | פונקציות ב-`app` בלתי-קריאות דרך `supabase.rpc()` | **§D3.3:** חוזה ה-RPC ב-`public`, internals ב-`app`; **`app` לא ייחשף ל-PostgREST לעולם** |
| B-3 | `revoke all on schema app` אינו מבטל `EXECUTE` (ברירת מחדל `PUBLIC`) | §D3: grants מפורשים — blanket `revoke execute` + הענקה נקודתית |
| B-4 | סחף definer בכל אירוע audit לא-DML | §D11: `public.log_event()` גנרית עם actions סגורים |

### Amendment C — 2026-08-30 (ממצאי Batch 3, commit `9ba0668`)

ה-builder שדרג את ה-harness לרוץ כ-**db_owner לא-superuser** — כלומר סוף-סוף כמו `postgres` האמיתי של Supabase — ותפס שלושה דברים. **שניים מהם היו שוברים production, ואחד מהם הוא סתירה שאני יצרתי ב-Amendment A.** כל השלושה מאושרים בעיקרם; אחד מהם עם תיקון כיוון.

| # | הממצא | ההכרעה |
|---|---|---|
| **C-1** | ה-trigger `app.document_lines_compute()` (INVOKER) לא יכול לקרוא ל-`app.compute_line()` עבור לקוח `authenticated` — **USAGE על schema נבדק בזמן ריצה בגוף פונקציית plpgsql**, בשונה מביטוי policy. ⇒ **שכבה 1 של §D8 (ה-preview החי) מעולם לא עבדה** מחוץ ל-`issue_document()` | **מאושר כבאג. התיקון שנבחר — לא.** `compute_line` **חוזרת ל-`app`**; במקומה `grant usage on schema app to authenticated` + EXECUTE נקודתי. §D3 עודכן — **אני מבטל איסור שכתבתי בעצמי ב-B-3** |
| **C-2** | `FORCE` על `business_signing_keys` חוסם את `issue_document()` (definer בבעלות `postgres`, ללא `BYPASSRLS`) מלראות מפתח פעיל ⇒ `INV_NO_SIGNING_KEY` תמיד ⇒ **הפקת מסמך לא הייתה מצליחה לעולם מול Supabase אמיתי** | **מאושר במלואו.** `app.business_has_signing_key(uuid)` definer בבעלות `service_role`. whitelist §D3.2 גדל ל-**10** |
| **C-3** | ה-`revoke execute` הגורף מ-0004 הוא **point-in-time** ולא כיסה 11 פונקציות שנוספו אחריו (default `PUBLIC`) | **מאושר.** בדיקת CI (ז) כבר תופסת את זה — אבל היא הורחבה ל-`anon`, ונוספה מניעה ב-`ALTER DEFAULT PRIVILEGES` |

**C-2 הוא באג שלי, ושווה לומר את זה במפורש.** ב-Amendment A §D3.2 כתבתי ש-`business_signing_keys` היא "החריג הנכון ל-FORCE **בדיוק משום שאף פונקציית definer אינה נוגעת בה**". זה היה **שגוי בזמן הכתיבה**: ADR-INV-002 §D2 שלב 5 כבר דרש מ-`issue_document()` לבדוק קיום מפתח פעיל, ו-`0008` כבר מימש את זה. יצרתי סתירה בין שני ADRs באותו יום ולא ראיתי אותה. היא לא התגלתה בשלושה סבבי אימות מפני שכולם רצו כ-superuser, שפטור מ-RLS ללא קשר לבעלות — **בדיוק אותו class של פער ש-A-4 עצמו הזהיר מפניו.** השדרוג של ה-harness ל-db_owner לא-superuser הוא התיקון המתודולוגי החשוב ביותר בסבב הזה, והוא זה שהפך את הבאג לגלוי.

**למה C-1 מתוקן אחרת ממה שמומש.** האבחנה של ה-builder מדויקת ואומתה אמפירית: בגוף פונקציית plpgsql שרצה כ-INVOKER, קריאה ל-`app.foo()` עוברת רזולוציית-שם בזמן ריצה בזהות הקורא, ולכן דורשת USAGE — בשונה מביטוי RLS policy, שנשמר מנותח לפי OID (ההבחנה של B-3 עצמו). והנימוק שלו להעדיף `public` נשען ישירות על מה שכתבתי ב-§D3 ("`grant usage on schema app` אסור כפתרון קבע"). **הבעיה היא שהאיסור ההוא היה שגוי.** הנימוק שנתתי לו היה: "אם משהו דורש USAGE — זה סימן שקוד לקוח קורא ל-`app.*` ישירות, כלומר הוא במקום הלא נכון". הניבוי הזה נכשל פעמיים: קודם ב-`child_rows_locked` (search_path), ועכשיו כאן. **זה לא קוד לקוח — זו המכונה שלנו שרצה בהקשר ההרשאות של הלקוח.**

ומה שהאיסור הגן עליו לא היה אמיתי מלכתחילה: USAGE אינו שער אבטחה כאן. הוא לא מסתיר את שמות הפונקציות (`pg_catalog` קריא לכולם ממילא), הוא לא פותח נתיב HTTP (`app` אינו schema חשוף ב-PostgREST — **זה** הגבול), ואין ל-`authenticated` נתיב SQL חופשי ב-Supabase. השליטה האמיתית היא ה-`EXECUTE` whitelist, כפי שכתבתי בעצמי באותו סעיף.

לעומת זאת, המחיר של `public.compute_line()` **הוא** אמיתי: הוא שובר את התכונה היחידה שנתנה ל-§D3.3 ערך — **"מה שב-`public` הוא חוזה ה-API; קריאת הרשימה אומרת לך בדיוק מה משטח החשיפה"**. `compute_line` אינה חוזה ואף לקוח לא אמור לקרוא לה. וחשוב מכך — זה יוצר תקדים: ההתנגשות הזו כבר קרתה פעמיים, ותקרה שוב; בפעם הבאה ה-internal הבא יעבור ל-`public` בהסתמך על הפעם הזו, ותוך כמה פאזות הכלל מת בלי ששום בדיקה תתפוס את זה (check (ו) בודקת `anon` בלבד ותמשיך לעבור).

לכן: **grant אחד חד-פעמי, במקום דפוס חוזר של זיהום `public`.**

*Amendment C לא הוסיף החלטות הטעונות אישור CEO — שלושת התיקונים בסמכות הארכיטקט.*

---

## Context

מערכת הפקת מסמכים חשבונאיים למייסד (עוסק פטור) ולחבריו. נפח זעום (~2 מסמכים/חודש לעסק, ~10 עסקים), אך **הדרישות הרגולטוריות אינן תלויות בנפח**: מספור רציף, אי-מחיקה, ארכיון 7 שנים, חתימה, הפרדה מוחלטת בין עסקים.

השכבה הזו היא הבלתי-הפיכה ביותר בפרויקט: ברגע שהופקה הקבלה האמיתית הראשונה אי אפשר לתקן retroactively את מבנה הטבלה — המסמכים immutable מעצם הגדרתם. לכן ה-schema נכתב כאן **במלואו**, כולל עמודות של Phase 2/3.

הפרויקט יורש שני invariants מ-`CLAUDE.md`: בידוד בכל שורה (#1) ו-audit log על כל mutation (#2). Invariants #3/#4 אינם רלוונטיים — אין סוכני AI ואין שינויי schema דינמיים.

**הבחנת מונחים:** ב-ERP הישות היא `tenant`; כאן `business`. משתמש יחיד יכול להיות חבר בכמה עסקים ⇒ היחס user↔business הוא **many-to-many**, בשונה מ-`users.tenant_id` היחיד של ADR-002.

---

## Decision

### D1 — Postgres יחיד ב-Supabase, בידוד ב-RLS על `business_id`, חברות דרך `business_members`

| קריטריון | RLS משותף | schema-per-business | DB-per-business |
|---|---|---|---|
| תאימות Supabase Auth | ✅ ילידי | ⚠️ ידני | ❌ |
| Many-to-many user↔business | ✅ | ⚠️ search_path דינמי | ❌ |
| עלות ב-₪0 | ✅ | ✅ | ❌ |
| חוזק בידוד | ⚠️ לוגי | ✅ | ✅✅ |
| מורכבות תפעולית ל-10 עסקים | ✅ | ❌ | ❌ |

הפער היחיד לרעת RLS מטופל ב-D3 (policy אחיד + בדיקות CI) ובעובדה שאין כאן multi-tenant מסחרי אלא חבורה מוכרת.

### D2 — Enums (Postgres native, לא text+CHECK)

```sql
create type entity_type      as enum ('patur','murshe');
create type document_type    as enum ('receipt','tax_invoice','tax_invoice_receipt',
                                      'proforma_invoice','credit_note','price_quote');
create type document_status  as enum ('draft','issued','cancelled');
create type payment_method   as enum ('cash','check','bank_transfer','credit_card','bit','paypal','other');
create type vat_treatment    as enum ('standard','zero','exempt');
create type member_role      as enum ('owner','editor','viewer','accountant');
create type pdf_status       as enum ('pending','rendering','ready','failed');
create type consent_channel  as enum ('web','email','written','verbal_recorded');
create type actor_type       as enum ('user','service','system','anonymous');
```

ערכי ה-enum נגזרים מהחוק ולא מהמוצר. **הרחבות מתוכננות (additive):** `document_status += 'pending_allocation'` ב-Phase 2; `payment_method += 'withholding'` ב-Phase 2.

**`credit_note` יחיד:** אין טיפוס נפרד ל"קבלת זיכוי"; הכותרת המודפסת נגזרת ממסמך האב ומסוג הישות. טיפוס שביעי היה מכפיל את מטריצות המספור/ההרשאות/התבניות בשביל הבחנה ויזואלית. **⚠️ טעון אישור רו"ח (A1).**

### D3 — RLS: helper functions ב-`SECURITY DEFINER`

```sql
create schema app;   -- internals. לא נחשף ל-PostgREST לעולם (§D3.3).

create or replace function app.current_business_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select business_id from public.business_members where user_id = auth.uid() $$;

create or replace function app.has_role(p_business uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.business_members
                     where business_id = p_business and user_id = auth.uid()
                       and role = any(p_roles)) $$;
```

**הרשאות** *(עודכן ב-Amendment C-1)*:

```sql
-- USAGE ל-authenticated: חובה. קוד שלנו שרץ בהקשר ההרשאות של הלקוח
-- (trigger functions ב-INVOKER) מבצע רזולוציית-שם ל-app.* בזמן ריצה.
grant usage on schema app to authenticated;
revoke all  on schema app from public, anon;        -- anon לא מקבל דבר

-- השליטה האמיתית: EXECUTE. ברירת המחדל של Postgres היא PUBLIC — מבטלים גורף,
-- ומעניקים נקודתית רק למה שקוד בהקשר-לקוח באמת חייב לקרוא לו.
revoke execute on all functions in schema app from public, anon, authenticated;
grant  execute on function app.current_business_ids()                        to authenticated;
grant  execute on function app.has_role(uuid, public.member_role[])          to authenticated;
grant  execute on function app.compute_line(numeric, numeric, numeric,
                                            public.vat_treatment, numeric)   to authenticated;

-- מניעת סחף: כל פונקציה עתידית ב-app לא תקבל EXECUTE ל-PUBLIC מלכתחילה.
alter default privileges in schema app revoke execute on functions from public;
```

**⚠️ תיקון לנוסח קודם.** ב-Amendment B-3 כתבתי `revoke all on schema app from ... authenticated` והוספתי אזהרה ש-`grant usage` "אסור כפתרון קבע". **זה היה שגוי, ואני מבטל את זה** (C-1). הנימוק שנתתי — "אם משהו דורש USAGE, זה קוד לקוח במקום הלא נכון" — נכשל פעמיים על אותה מכונה שלנו עצמה. `USAGE` **אינו** שער אבטחה כאן:
- הוא אינו מסתיר שמות — `pg_catalog` קריא לכולם ממילא.
- הוא אינו פותח נתיב HTTP — `app` אינו schema חשוף ב-PostgREST, **וזה** הגבול (§D3.3).
- ל-`authenticated` אין נתיב SQL חופשי ב-Supabase.

**השליטה היא `EXECUTE`, והיא נאכפת ב-CI (בדיקה ז).** שלוש הפונקציות המוענקות בטוחות לקריאה ישירה: שתי הראשונות מחזירות מידע על הקורא עצמו; `compute_line` היא אריתמטיקה טהורה ללא גישה לטבלאות וללא נתוני tenant בקלט או בפלט.

תבנית ה-policy האחידה:

```sql
alter table customers enable row level security;   -- ⚠️ בלי FORCE (D3.2)

create policy customers_read on customers for select to authenticated
  using (business_id in (select app.current_business_ids()));

create policy customers_write on customers for all to authenticated
  using      (app.has_role(business_id, array['owner','editor']::member_role[]))
  with check (app.has_role(business_id, array['owner','editor']::member_role[]));
```

שלוש נקודות קריטיות:
1. **`SECURITY DEFINER` חובה** — policy שעושה subquery ל-`business_members` היה מפעיל את ה-RLS שלה ⇒ רקורסיה. הפונקציה שוברת את המעגל, **בתנאי שבעליה באמת מדלג על RLS** (D3.2).
2. **`stable`** — קריאה אחת לכל statement במקום לכל שורה.
3. **`set search_path = ''` בכל פונקציה ב-`app`/`public`, definer או invoker, עם שמות מלאים.** פונקציה בלי הצהרה יורשת את ה-search_path של הקורא — המלכודת שהפילה את `child_rows_locked()` (ADR-INV-002 §Implementation Notes #14). נאכף בבדיקת CI (ח).

**RLS על `business_members`** (מקור הרקורסיה):
```sql
create policy bm_self  on business_members for select to authenticated
  using (user_id = (select auth.uid()));                       -- ללא פונקציה
create policy bm_peers on business_members for select to authenticated
  using (business_id in (select app.current_business_ids()));  -- definer ⇒ אין רקורסיה
create policy bm_manage on business_members for all to authenticated
  using      (app.has_role(business_id, array['owner']::member_role[]))
  with check (app.has_role(business_id, array['owner']::member_role[]));
```
שורת ה-owner הראשונה אינה עוברת כאן — ראה D10.

#### D3.1 — Policies של `businesses` *(A-1)*

`businesses` היא שורש ה-scope ⇒ עמודת ה-scoping היא `id`:

```sql
alter table businesses enable row level security;

create policy businesses_read on businesses for select to authenticated
  using (id in (select app.current_business_ids()));

create policy businesses_update on businesses for update to authenticated
  using      (app.has_role(id, array['owner']::member_role[]))
  with check (app.has_role(id, array['owner']::member_role[]));
-- ⚠️ אין policy ל-INSERT ואין ל-DELETE. במכוון.
```

- **אין INSERT policy** — יצירת עסק אך ורק ב-`public.create_business()` (D10). כשלכתיבה יש נתיב לגיטימי אחד, הוא פונקציה צרה ולא policy רחבה.
- **אין DELETE policy — לעולם.** מסמכים מפנים ב-`on delete restrict`, וארכיון 7 שנים לא מוחקים. השבתה ב-`is_active = false`.
- **`created_by`/`tax_id`/`entity_type` חסומים לשינוי** ב-trigger `businesses_protect_identity_trg`.

#### D3.2 — `FORCE ROW LEVEL SECURITY`: רק על `business_signing_keys` *(A-4, מתוקן ב-C-2)*

**הכלל:** כל הטבלאות `ENABLE ROW LEVEL SECURITY` בלבד. `FORCE` על טבלה אחת — `business_signing_keys`.

**נימוק.** תחת `FORCE` גם בעלת הטבלה כפופה ל-policies; פונקציית definer רצה בזהות בעליה (`postgres`), שאינו ב-`authenticated`, ולכן נדחית. זה היה שובר את `app.current_business_ids()` (נעילה מוחלטת), את הכתיבה ל-`document_counters`, ואת ה-audit trigger.

**`business_signing_keys` נשארת עם FORCE** — היא מחזיקה חומר מפתח, ו-FORCE הוא מה שמונע מ-session שרץ כ-`postgres` לקרוא ciphertext.

⚠️ **תיקון ל-A-4** *(C-2)*: הנימוק המקורי טען שזה החריג הנכון "**משום שאף פונקציית definer אינה נוגעת בה**". **זה היה שגוי** — ADR-INV-002 §D2 שלב 5 דורש מ-`issue_document()` לבדוק קיום מפתח פעיל. תחת FORCE, ה-SELECT הזה החזיר 0 שורות **תמיד**, ולכן `INV_NO_SIGNING_KEY` היה נזרק בכל הפקה מול project אמיתי. הפתרון: **פונקציית definer ייעודית בבעלות `service_role`** (בעל `BYPASSRLS`, התכונה היחידה שגוברת על `FORCE`), שמחזירה **בוליאני בלבד**:

```sql
create or replace function app.business_has_signing_key(p_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.business_signing_keys
                      where business_id = p_business_id and is_active) $$;

grant usage, create on schema app to service_role;   -- נדרש ל-ALTER ... OWNER TO
alter function app.business_has_signing_key(uuid) owner to service_role;
revoke execute on function app.business_has_signing_key(uuid) from public, anon, authenticated;
```

שלוש דרישות מחייבות עליה: **בוליאני בלבד** (לא שורה, לא id, ובוודאי לא ciphertext); **`revoke execute` מפורש** — היא נקראת רק מתוך `issue_document()`, ובלי ה-revoke כל `authenticated` היה יכול לברר לגבי עסק זר אם יש לו מפתח; ובעלות `service_role` דווקא משום ש-`postgres` **אינו** מובטח כ-`BYPASSRLS` (A-4).

*נשקל ונדחה:* להוריד FORCE (מפקיר את חומר המפתח לכל session של `postgres`); להוסיף policy ל-`business_signing_keys` (RLS הוא row-level — policy ל-SELECT הייתה חושפת גם את ה-ciphertext); ולהעביר את `issue_document()` עצמה לבעלות `service_role` (מרחיב את משטח האמון של הפונקציה המורכבת ביותר במערכת במקום לכלוא את התיקון ביחידה זעירה).

**מה מחליף את FORCE בשאר הטבלאות:** (1) האפליקציה לעולם אינה מתחברת כ-`postgres` — רק `anon`/`authenticated`/`service_role`; (2) `service_role` דילג על FORCE ממילא; (3) **בדיקת CI (ה)** מול whitelist סגור של definer — זה ה-control האמיתי.

**Whitelist של `SECURITY DEFINER` functions (סגור, 10 פונקציות)** *(עודכן ב-C-2)*:

| # | פונקציה | schema | בעלים | למה definer |
|---|---|---|---|---|
| 1 | `current_business_ids()` | `app` | owner | שוברת רקורסיית RLS על `business_members` |
| 2 | `has_role(uuid, member_role[])` | `app` | owner | כנ"ל |
| 3 | `audit_trigger()` | `app` | owner | כותבת ל-`audit_log` שאין לה policy INSERT |
| 4 | `business_has_signing_key(uuid)` | `app` | **`service_role`** | `BYPASSRLS` — הדרך היחידה לחצות `FORCE` (C-2) |
| 5 | `handle_new_auth_user()` | `public` | owner | רצה בזהות `supabase_auth_admin` |
| 6 | `create_business(...)` | `public` | owner | אין INSERT policy על `businesses` (D10) |
| 7 | `issue_document(uuid, date)` | `public` | owner | כותבת ל-`document_counters` |
| 8 | `set_start_number(...)` | `public` | owner | כנ"ל |
| 9 | `send_document(uuid, text[])` | `public` | owner | כותבת אירוע `send` ל-`audit_log` |
| 10 | `log_event(...)` | `public` | owner | audit לא-DML (D11) |

**כלל צמצום:** trigger function שרק **מאמתת** או **מחשבת** (`documents_immutable`, `child_rows_locked`, `allocation_requests_locked`, `audit_log_immutable`, `documents_set_entity_type`, `document_lines_compute`) חייבת `SECURITY INVOKER`. אותו דבר לעזר שנקרא רק מתוך definer (`seed_for`, `recompute_draft_lines`, `compute_line`). CI (ה) אוכפת: כל `prosecdef` שאינו ב-10 = build fail.

#### D3.3 — חלוקת ה-schemas: `public` = חוזה ה-RPC, `app` = internals *(B-1, B-2; חודד ב-C-1)*

| schema | תפקיד | נגיש ל-PostgREST | תוכן |
|---|---|---|---|
| `public` | **חוזה ה-RPC** — כל מה שהאפליקציה קוראת לו | כן | `create_business`, `issue_document`, `set_start_number`, `send_document`, `log_event`, `handle_new_auth_user` |
| `app` | **internals** — לעולם לא endpoint | **לא. אף פעם.** | `current_business_ids`, `has_role`, `compute_line`, `seed_for`, `recompute_draft_lines`, `business_has_signing_key`, כל trigger functions |

**למה לא לחשוף את `app`:** (1) חשיפת schema היא **default-open** — כל פונקציה עתידית הופכת אוטומטית ל-endpoint, בניגוד לכל עמדה אחרת ב-ADR; (2) `db-schemas` הוא **קונפיג ולא DDL** — לא נוסע עם ה-migrations, לא מכוסה ב-CI, וסוטה בין סביבות.

⚠️ **`app` נגיש לקריאה מקוד שרץ בהקשר ההרשאות של הלקוח — וזה תקין** *(C-1)*. trigger function ב-INVOKER שקוראת ל-`app.foo()` מבצעת רזולוציית-שם בזמן ריצה בזהות הקורא, ולכן צריכה `USAGE` + `EXECUTE`. **זו אינה סיבה להעביר את `foo` ל-`public`** — היא נותרת internal; מעניקים לה `EXECUTE` נקודתי (§D3). **הכלל: מה שנמצא ב-`public` הוא שם משום שלקוח אמור לקרוא לו — לא משום שהיה נוח להגיע אליו.** הפרת הכלל הזה מרוקנת את §D3.3 מתוכן, כי בדיקת CI (ו) בודקת `anon` בלבד ולא תתפוס את הסחף.

**כללים נגזרים — חובה על כל פונקציה ב-`public`:**
```sql
revoke execute on function public.issue_document(uuid, date) from public, anon;
grant  execute on function public.issue_document(uuid, date) to authenticated;
```
- על **כל** אחת מפונקציות ה-RPC. בלי זה `anon` מקבל execute כברירת מחדל.
- **המשפט הראשון בגוף כל RPC** הוא אימות חברות/תפקיד מפורש — definer מבטל RLS.

**`handle_new_auth_user()` נשאר ב-`public`** *(B-1)*: `supabase_auth_admin` מריץ את ה-INSERT, והצבה ב-`app` הייתה מוסיפה עוד הימור על התנהגות פלטפורמה (נדחה ב-A-4); והימצאותו ב-`public` אינה הופכת אותו ל-endpoint — **PostgREST אינו חושף פונקציות שטיפוס ההחזרה שלהן `trigger`**. בנוסף `revoke execute` כחגורה-ושלייקס.

### D4 — מודל ההרשאות: 4 roles, אכיפה ב-policy

| role | קורא | יוצר טיוטות | מפיק מסמך | מנהל חברים / הגדרות |
|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | ✅ | ❌ |
| `viewer` | ✅ | ❌ | ❌ | ❌ |
| `accountant` | ✅ + ייצוא | ❌ | ❌ | ❌ |

`accountant` ב-enum מ-Phase 0 אף שהמסך ב-Phase 3 — הוספת ערך אחרי שיש policies מחייבת עדכון של כולן.
**כלל:** לפחות `owner` אחד לכל עסק — trigger שמעלה exception אם נותרו אפס.

### D5 — נתיבי `service_role`: שלושה בלבד

| נתיב | למה חייב | למה בטוח |
|---|---|---|
| **צינור החתימה** (`api/sign.py`) | `business_signing_keys` — FORCE + ללא policies | server-only; מקבל `document_id` + HMAC קצר-מועד; מאמת `status='issued'`; לא מחזיר חומר מפתח |
| **עמוד צפייה ציבורי** (`/d/[token]`) | הצופה אנונימי — אין `auth.uid()` | שאילתה **רק** לפי `sha256(token)`; whitelist שדות; בר-ביטול; rate-limit |
| **גיבוי/ייצוא לילי** | חוצה-עסקים בהגדרה | read-only; GitHub Actions; פלט מוצפן |

**כלל אכיפה:** כל קריאה עם `service_role` תחת `src/server/service-role/`; ESLint חוסם import מכל מקום אחר. המפתח לעולם לא ב-`NEXT_PUBLIC_`.

⚠️ **`service_role` הוא גם הבעלים של `app.business_has_signing_key()`** (C-2). זה **אינו** נתיב רביעי — אין שם client, אין מפתח API, ואין גישה לנתונים מעבר לבוליאני יחיד. אבל הוא כן מרחיב את ה-role: `grant usage, create on schema app to service_role` נדרש ל-`ALTER ... OWNER TO`. מקובל — `service_role` הוא ממילא ה-role המהימן ביותר — אך יש להימנע מלהעביר לבעלותו פונקציות נוספות ללא הצדקת `BYPASSRLS` מפורשת.

**מה **לא** עובר ב-service_role:** יצירת עסק, המונים וההפקה, audit, שליחת מייל — כולן definer צרות. definer עדיפה: מוגבלת לפעולה אחת, מאמתת חברות בעצמה, ו-`auth.uid()` ממשיך להחזיר את המשתמש האמיתי (נקרא מ-GUC של ה-JWT, לא מ-`current_user`) ⇒ ה-audit נשאר מדויק.

### D6 — Audit log ב-triggers בלבד (סטייה מודעת מ-ADR-006)

ב-ERP ה-middleware נדרש ל-context שרק האפליקציה מכירה (`on_behalf_of_user_id`, `policy_id` של סוכן). כאן אין סוכנים ואין ORM מחייב — לקוח Supabase עוקף כל middleware. Trigger תופס **כל** נתיב כתיבה כולל SQL Editor ו-service_role. אירועים לא-DML דרך `public.log_event()` (D11).
**⚠️ טעון אישור CEO (A4).**

### D7 — מפת scoping *(A-2, A-5)*

| קטגוריה | טבלאות | scoping | RLS |
|---|---|---|---|
| **1. Business-scoped** | `customers`, `items`, `documents`, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `customer_document_consents`, `business_signing_keys`, `audit_log`, `business_members` | `business_id` | חובה |
| **2. Scope-root** | `businesses` | `id` | חובה (D3.1) |
| **3. Self-scoped** | `users` | `id = auth.uid()` | חובה |
| **4. Reference גלובלי** | `vat_rates` | — | ENABLE + SELECT לכולם, ללא policy כתיבה |

קטגוריות 2-4 הן רשימה סגורה; הוספה מחייבת עדכון ADR. `supabase_migrations.schema_migrations` מחוץ ל-`public` וסינון ה-`nspname` מוציא אותו ממילא.

### D8 — אכיפת סוגי מסמכים לפי סוג ישות: **CHECK על snapshot בשורת המסמך**

```sql
business_entity_type entity_type not null,   -- snapshot, לא join

constraint doc_type_allowed_for_entity check (
  business_entity_type <> 'patur' or type not in ('tax_invoice','tax_invoice_receipt')),
constraint patur_has_no_vat check (
  business_entity_type <> 'patur' or (vat_rate = 0 and vat_amount = 0))
```

מאוכלס ב-`BEFORE INSERT` trigger מ-`businesses`, ומחדש במעבר `draft → issued`.

| חלופה | למה נדחתה |
|---|---|
| אכיפה באפליקציה בלבד | נעקפת ע"י service_role, SQL ידני, וכל באג בנתיב חדש |
| Trigger שקורא `businesses` בזמן אמת | ניתן להשבתה ב-`DISABLE TRIGGER`; ומסתמך על **המצב הנוכחי** — פטור שהופך למורשה היה מחליק אחורה על מסמכים היסטוריים |
| Composite FK `(business_id, entity_type)` | מקבע: לא ניתן **לעולם** לשנות `entity_type` כשקיימים מסמכים (RESTRICT) או גורר עדכון היסטוריה (CASCADE) |

ה-snapshot הופך את ההיסטוריה ל**מתארת את עצמה**: מסמך מ-2026 יודע שהופק ע"י עוסק פטור גם אחרי שהעסק עבר למורשה ב-2028.

| טיפוס | patur | murshe |
|---|---|---|
| `price_quote` / `proforma_invoice` / `receipt` / `credit_note` | ✅ | ✅ |
| `tax_invoice` / `tax_invoice_receipt` | ❌ | ✅ |

### D9 — מספור: המונה ממשיך בין שנות מס (`continuous`), עם אפשרות `yearly`

שורת מונה פר `(business_id, document_type, tax_year)`. ב-`continuous` שנה חדשה נזרעת מ-`next_number` של הקודמת; ב-`yearly` מ-`start_number`. **⚠️ טעון אישור רו"ח (A2).**

### D10 — Bootstrap: `public.create_business()` ב-`SECURITY DEFINER` *(A-3; schema ב-B-2)*

נתיב הכתיבה היחיד ל-`businesses`; שורת ה-owner הראשונה נוצרת בתוכה, באותו transaction. מאמתת: `auth.uid()` קיים, פרופיל קיים, מגבלת 10 עסקים למשתמש (בלם abuse — בהיעדר INSERT policy אין בודק חיצוני), `tax_id` תקין; ממפה `unique_violation` ל-`INV_TAX_ID_EXISTS`; כותבת `audit_log`. `revoke` מ-`public, anon`, `grant` ל-`authenticated`.

| חלופה | למה נדחתה |
|---|---|
| policy INSERT "החבר הראשון מוסיף את עצמו" | שתי קריאות REST ללא transaction; כשל בשנייה משאיר **עסק יתום ללא חברים** ש**שורף את ה-`tax_id` לצמיתות**. וה-`not exists` הדרוש מפעיל RLS על `business_members` מתוך policy עליה ⇒ רקורסיה |
| trigger `AFTER INSERT ON businesses` | רץ בזהות הקורא ⇒ חסום ע"י `bm_manage`; כ-definer מייצר דילוג-RLS **סמוי** שנורה מכל נתיב עתידי |
| endpoint ב-`service_role` | נתיב service_role רביעי — שובר את הרשימה הסגורה של D5 |

**סדר ההקמה:** הפונקציה מסתיימת בעסק **ללא מפתח חתימה**; ה-route קורא מיד ל-`api/keygen.py`. עד אז `issue_document()` מעלה `INV_NO_SIGNING_KEY` (C-2) וה-UI מציג "נסה שוב". אין עמודת סטטוס — קיום שורה פעילה ב-`business_signing_keys` הוא מקור האמת.

### D11 — `public.log_event()`: audit לא-DML בפונקציה אחת *(B-4)*

`audit_log` ללא policy INSERT ⇒ כל אירוע לא-DML (הורדה, צפייה, ייצוא, הסכמות, אירועי מפתח) היה דורש definer ייעודי, וה-whitelist היה תופח בכל פיצ'ר. פונקציה גנרית אחת עם **רשימת actions סגורה** (`download`, `view_public`, `export`, `consent_grant`, `consent_revoke`, `key_create`, `key_revoke`) שאינה כוללת אף פעולת DML, `actor_id` נכפה מ-`auth.uid()` ולא מפרמטר, ואימות חברות מפורש. פעולות מערכת (`view_public` אנונימי, `sign`) נשארות ב-service_role.

---

## Schema

*(ללא שינוי מ-Amendment B — 15 טבלאות. להלן העיקריות; המלאות ב-`supabase/migrations/0003a`-`0003b`.)*

**גלובליות:** `users` (הרחבת פרופיל ל-`auth.users`; נוצרת ב-`public.handle_new_auth_user()`), `vat_rates` (`rate`, `valid_from` PK, `valid_to`; seed 17% עד 2024-12-31, 18% מ-2025-01-01).

**`businesses`** — `entity_type`, `tax_id` (9 ספרות, **`unique`**), פרטי קשר, `logo_path`, `accent_color`, `numbering_reset_policy`, `created_by`, `is_active`. `unique(tax_id)` הוא בקרה ולא נוחות: שתי שורות לאותה ישות = שתי סדרות מספור מקבילות = הפרת המספור הרציף.

**`business_members`** — `(business_id, user_id)` PK, `role`.

**`business_signing_keys`** — תעודה ציבורית + `private_key_ciphertext`/`wrapped_dek`/`kek_id`, `is_active` (unique partial). **`ENABLE` + `FORCE`, ללא policies.** ללא audit trigger (לא לשכפל ciphertext); אירועי מפתח דרך `log_event()`.

**`customers`**, **`items`** (`default_unit_price` **nullable** במכוון), **`customer_document_consents`** (`consent_text` כ-snapshot; immutable פרט ל-`revoked_at`).

**`documents`** — זהות ומספור, `parent_document_id` + `credit_reason`, snapshots (`customer_snapshot`, `business_snapshot`, `business_entity_type`), כספים, `signed_total` generated, מצב נגזר, מסירה, PDF/חתימה, Phase 2 (`allocation_number`). `unique index documents_number_uk (business_id, type, tax_year, document_number)` — **ערובת המספור**. FK מורכבים `(parent_document_id, business_id)` ו-`(customer_id, business_id)` מונעים קישור חוצה-עסקים ברמת ה-DB.

**`document_lines`**, **`payments`** — נושאות `business_id` denormalized (RLS ללא join), עם FK מורכב `(document_id, business_id)`. `check (line_total = line_net + line_vat)` (ADR-INV-002 §D8).

**`document_counters`** — PK `(business_id, document_type, tax_year)`. `ENABLE`, policy **SELECT בלבד**; כתיבה רק ב-`public.issue_document()`/`public.set_start_number()`.

**`allocation_requests`** (Phase 2), **`document_public_links`** (`token_sha256` unique), **`audit_log`** (append-only; אין policy insert/update/delete; `audit_log_immutable_trg`).

---

## Consequences

**חיובי**
- שלוש שכבות בלתי-תלויות: RLS policy, FK מורכב `(x_id, business_id)`, ובדיקות CI. דליפה דורשת כשל בשלושתן.
- ה-schema של Phase 3 קיים מ-Phase 0 — אין migration על טבלה עם מסמכים immutable.
- **"מי יכול לעקוף בידוד" הוא שתי רשימות סופיות:** 3 נתיבי service_role, 10 פונקציות definer. שתיהן CI-enforced.
- **§D3.3 נשמר כחוזה קריא** — מה שב-`public` הוא API. אחרי C-1, גם internal שנקרא מהקשר-לקוח נשאר ב-`app`.
- `log_event()` עוצרת סחף definer; `alter default privileges` עוצרת סחף EXECUTE.
- הפרדת סוגי המסמכים לפי ישות היא declarative ב-schema.

**שלילי / חוב טכני**
- **הורדת `FORCE`** (A-4) פירושה שכל definer בבעלות ה-owner מדלגת על RLS — התכונה שעליה הארכיטקטורה נשענת, וגם משטח סיכון. **בדיקת CI (ה) היא חובה, לא nice-to-have.**
- **`grant usage on schema app to authenticated`** (C-1) מסיר שכבת עומק. השליטה כולה עוברת ל-`EXECUTE` ⇒ **בדיקת CI (ז) עולה בחשיבותה** ומכסה עכשיו גם `anon`.
- **`service_role` הוא כעת בעלים של אובייקט DDL** ב-`app` (C-2) ויש לו `CREATE` שם. מוצדק, אך יש לעקוב שלא יורחב.
- `business_id` משוכפל ל-`document_lines`/`payments` — denormalization מכוונת.
- מגבלת 10 עסקים למשתמש היא קבוע בקוד.
- סטייה מ-ADR-006 תדרוש יישור אם המערכת תתמזג ל-ERP.
- `unique(businesses.tax_id)` חוסם sandbox של אותו עוסק — פתרון: פרויקט Supabase נפרד ל-staging.

**השפעה על מודולים אחרים**
- **ADR-INV-002** נשען על `document_counters`, ה-snapshots, `documents_number_uk`, ו-`public.compute_line`→**`app.compute_line`** (C-1: השם ב-§D8 חוזר ל-`app`).
- **ADR-INV-003** נשען על `business_signing_keys` (FORCE), `documents.pdf_*`, `document_public_links`; אירועי מפתח דרך `log_event()`. **C-2 הוא תלות ישירה:** בלי `business_has_signing_key()` אין הפקה בכלל.
- **Phase 3 (מבנה אחיד):** המבנה שנבחר הוא בדיוק מה שרשומות B100/C100/D110/D120 מצפות לו.

---

## Reversal Conditions

- **המערכת תיפתח למשתמשים שאינם החבורה** — rate limiting, מכסות, בידוד חזק יותר, רישום במרשם התוכנות. ולשקול מחדש את הורדת ה-FORCE אם `postgres` ב-Supabase יאומת כ-`BYPASSRLS` בחוזה מתועד.
- **תתגלה דליפה בין עסקים** — בדיקת יסוד של מודל ה-policy, ומעבר ל-`app.assert_member()` מפורש בכל RPC.
- **עסק ישנה `entity_type`** — נדרש נוהל; ה-trigger חוסם עד שייכתב. **צפוי לקרות.**
- **יידרש מט"ח** — הסרת `ils_only_phase1`.
- **`public` יתפח מעבר ל-~10 פונקציות RPC** — לשקול schema `api` ייעודי שנחשף, עם `public` לטבלאות בלבד.
- **יידרשו פונקציות definer נוספות בבעלות `service_role`** — סימן שמודל ה-FORCE צריך בחינה מחדש, לא עוד חריג.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | למה לא בסמכות הארכיטקט |
|---|---|---|
| A1 | `credit_note` יחיד גם לזיכוי קבלה | **חוות דעת רו"ח** |
| A2 | מספור `continuous` בין שנות מס | **חוות דעת רו"ח** |
| A3 | `unique(businesses.tax_id)` — עסק אחד לכל ח.פ | החלטה מוצרית עם השלכה תפעולית |
| A4 | סטייה מ-ADR-006: audit ב-triggers בלבד | חריגה מ-ADR מאושר של הבית |
| A5 | אחסון PII של לקוחות צד ג' | **חוק הגנת הפרטיות תיקון 13** — שאלה משפטית |
| A6 | `viewer`/`accountant` ב-enum מ-Phase 0 | משנה scope של Phase 0 |

*Amendments A, B ו-C לא הוסיפו החלטות הטעונות אישור — כולם תיקוני נכונות בסמכות הארכיטקט.*

---

## Implementation Notes

1. **סדר ה-migrations** — `0001_extensions` → `0002_enums` → `0003a/b_core_tables` → `0004_rls_helpers` → `0005_rls_policies` → `0006_audit` → `0007_immutability` → `0008_issue_function` → `0009_amendments` → `0010_addendum_fixes` → `0011_create_business` → `0012_storage_buckets` → `0013_signing_key_check` → `0014_app_execute_hardening` → **`0015_amendment_c`** (C-1: החזרת `compute_line` ל-`app` + grants). לכל migration קובץ `down` מקביל.
   **כלל:** migration שכבר בוצע **אינו נערך** — תיקון הוא `create or replace` / `alter` ב-migration חדש.

2. **בדיקות CI חוסמות merge** — שמונה שאילתות מטא נגד DB שהורצו עליו כל ה-migrations:

   ```sql
   -- (א) טבלה ב-public ללא RLS
   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

   -- (ב) FORCE בדיוק על business_signing_keys ועל שום טבלה אחרת            [A-4]
   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relforcerowsecurity <> (c.relname='business_signing_keys');

   -- (ג) scoping: כל טבלה חייבת business_id, אלא אם היא במפת החריגים        [A-2]
   with expected(relname) as (values ('businesses'),('users'),('vat_rates'))
   select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   left join expected e on e.relname=c.relname
   where n.nspname='public' and c.relkind='r' and e.relname is null
     and not exists (select 1 from pg_attribute a where a.attrelid=c.oid
                     and a.attname='business_id' and a.attnum>0 and not a.attisdropped);

   -- (ד) טבלה עם business_id ללא audit trigger (פרט ל-business_signing_keys, audit_log)

   -- (ה) SECURITY DEFINER מול whitelist סגור — 10 פונקציות        [A-4, B-1, B-4, C-2]
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where p.prosecdef and n.nspname in ('public','app')
     and p.oid::regprocedure::text not in (
       'app.current_business_ids()',
       'app.has_role(uuid,member_role[])',
       'app.audit_trigger()',
       'app.business_has_signing_key(uuid)',
       'public.handle_new_auth_user()',
       'public.create_business(text,entity_type,text,text,text)',
       'public.issue_document(uuid,date)',
       'public.set_start_number(uuid,document_type,integer,bigint)',
       'public.send_document(uuid,text[])',
       'public.log_event(uuid,text,text,uuid,jsonb)');

   -- (ו) אף פונקציה ב-public אינה נגישה ל-anon                              [B-2]
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind='f' and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');

   -- (ז) ב-app: EXECUTE ל-authenticated רק על שלוש הפונקציות המוענקות,
   --     ול-anon על אף אחת                                            [B-3, הורחב ב-C-3]
   select p.oid::regprocedure, r.rolname
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   cross join (values ('authenticated'),('anon')) r(rolname)
   where n.nspname='app' and has_function_privilege(r.rolname, p.oid, 'execute')
     and not (r.rolname='authenticated' and p.oid::regprocedure::text in
              ('app.current_business_ids()',
               'app.has_role(uuid,member_role[])',
               'app.compute_line(numeric,numeric,numeric,vat_treatment,numeric)'));

   -- (ח) כל פונקציה ב-app/public חייבת search_path מפורש    [ADR-INV-002 §IN#14]
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','app') and p.prokind='f'
     and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c
                     where c like 'search\_path=%');
   ```
   כל שאילתה שמחזירה שורות ⇒ build fail.

3. **⚠️ ה-harness של הבדיקות חייב לרוץ כ-`db_owner` לא-superuser** *(C-2)*. superuser פטור מ-RLS ללא קשר לבעלות ול-FORCE, ולכן מסתיר בדיוק את מחלקת הבאגים של A-4/C-2 — שניהם התגלו רק אחרי השדרוג הזה. **בדיקה שרצה כ-superuser אינה ראיה לכלום בכל הנוגע ל-RLS.** זו דרישה קבועה, לא הערה לסבב אחד.

4. **אימותים תפעוליים חד-פעמיים ב-B13:**
   - `supabase/config.toml` § `[api] schemas` **אינו** כולל `app` (§D3.3).
   - אין `grant usage on schema app` ל-`anon` (רק ל-`authenticated`, C-1).
   - `alter default privileges in schema app revoke execute on functions from public` הוחל תחת ה-role שמריץ migrations.

5. **בדיקת בידוד ב-DoD של Phase 0:** שני משתמשים, שני עסקים; SELECT/INSERT/UPDATE/DELETE של A על כל טבלאות B — כולן נכשלות. בנוסף:
   - `INSERT`/`DELETE` ישיר על `businesses` מלקוח `authenticated` ⇒ נכשל (A-1).
   - `create_business()` ⇒ שתי שורות; כשל מלאכותי אחרי ה-INSERT הראשון ⇒ אפס שורות ו-`tax_id` פנוי (A-3).
   - `supabase.rpc('issue_document')` ⇒ 200; `supabase.rpc('current_business_ids')` ⇒ 404 (B-2).
   - **INSERT/UPDATE של שורת טיוטה ע"י `authenticated` אמיתי, ללא `issue_document` בסטאק, מצליח ומחשב נכון** — הבדיקה שהייתה תופסת את C-1.
   - **`issue_document()` מצליחה כ-`db_owner` לא-superuser כשקיים מפתח פעיל** — הבדיקה שהייתה תופסת את C-2.
   - `select app.business_has_signing_key(...)` כ-`authenticated` ⇒ permission denied (C-2).
   - `log_event()` עם `p_action='update'` ⇒ `INV_BAD_EVENT`; עם `business_id` זר ⇒ `INV_FORBIDDEN`.

6. **`updated_at`** — trigger על `businesses`/`customers`/`items`, ועל `documents` ל**כל** UPDATE (ADR-INV-002 Amendment A-3 מתקן את הניסוח "רק בטיוטה" שהיה כאן).

7. **Audit trigger** — `app.audit_trigger()` (definer, `search_path=''`) על כל טבלה עם `business_id` **פרט ל-`business_signing_keys` ו-`audit_log`**, וכן על `businesses`. helper `app.enforce_audit(regclass)` + בדיקת CI (ד).

8. **חישוב הכספים סמכותי ב-DB** — `public.issue_document()` מחשבת מחדש הכל מהשורות ודורסת (ADR-INV-002 §D8).

9. **Storage RLS** — bucket `documents` פרטי, SELECT בלבד ל-`authenticated` לפי `(storage.foldername(name))[1]::uuid in (select app.current_business_ids())`; **ללא** policy INSERT/UPDATE/DELETE. `business-assets`: SELECT + INSERT ל-`owner`.

10. **`SUPABASE_SERVICE_ROLE_KEY`** — Vercel env בלבד, Sensitive, לא ב-Preview של PR-ים מפורקים.

11. **`public.create_business()`** — ה-route קורא לה, ואז — **אחרי** הצלחה — ל-`api/keygen.py`. אין לאחד (קריאת HTTP מתוך Postgres). כשל ב-keygen משאיר עסק תקין ללא יכולת הפקה — מצב מטופל, לא שבור.
