# ADR-INV-001: מודל נתונים ובידוד רב-עסקי (RLS)

**Date:** 2026-08-30
**Status:** Accepted
**Amended:** 2026-08-30 — Amendment A, Amendment B (ראה סעיף "Amendment Log")
**Decider:** Architect (proposed), CEO (final approval)
**Scope:** פרויקט `invoicing-receipts` — עצמאי, מחוץ ל-pnpm workspace של ה-ERP.
**Related:** [[002-multi-tenancy-strategy]], [[006-audit-log-and-agent-action-gating]] (עקרונות הבית — יורשים, לא מיישמים 1:1), ADR-INV-002, ADR-INV-003.

---

## Amendment Log

### Amendment A — 2026-08-30 (escalation מ-engineering-manager, חוסם B9/F3)

ה-EM דיווח על שלושה פערים. בבדיקתם התגלה **פער רביעי, חמור יותר**, שמקורו באותו סעיף. ארבעת התיקונים:

| # | הפער | התיקון |
|---|---|---|
| A-1 | אין RLS policies לטבלת `businesses` עצמה | נוספו ב-§D3.1: SELECT לחברים, UPDATE ל-owner, **ללא INSERT ו-DELETE policies כלל** |
| A-2 | בדיקת CI של D7 נכשלת תמיד על `businesses` (אין לה `business_id`) | §D7 נכתב מחדש עם **מפת scoping** במקום רשימת חריגים שטוחה; `businesses` מוגדרת כ-scoped-by-`id` |
| A-3 | ביצה-ותרנגולת ביצירת עסק — `bm_manage` דורשת owner קיים | אושר: **`create_business()` ב-`SECURITY DEFINER`** (§D10). אין policy bootstrap ואין נתיב service_role רביעי |
| A-4 | **⚠️ פער שלא דווח:** `FORCE ROW LEVEL SECURITY` הגורף ב-§D3 **שובר את כל דפוס ה-SECURITY DEFINER של ה-ADR** | §D3.2 תוקן: FORCE יורד מכל הטבלאות **פרט ל-`business_signing_keys`**. בדיקת CI (ב) התהפכה |
| A-5 | (קוסמטי) D7 הניחה טבלת `_migrations` | הוסרה — Supabase CLI כותב ל-`supabase_migrations.schema_migrations`, מחוץ ל-`public` |

**הסבר ל-A-4, כי הוא משנה הנחת יסוד:** תחת `FORCE ROW LEVEL SECURITY`, גם בעלת הטבלה כפופה ל-policies. פונקציית `SECURITY DEFINER` רצה בזהות הבעלים שלה (`postgres`), שאינו חבר ב-`authenticated` — ולכן שום policy לא חלה עליו והתוצאה היא **דחייה**, לא בייפאס. שלוש תוצאות מעשיות שהיו מתגלות רק בזמן ריצה: `app.current_business_ids()` מחזירה 0 שורות (נעילה מוחלטת), `issue_document()` לא יכולה לכתוב ל-`document_counters` (אין לה policy כתיבה במכוון), וה-audit trigger לא יכול לכתוב ל-`audit_log` (אין לה policy INSERT במכוון).

תיעוד Postgres מפורש בנקודה: פונקציית security-definer מדלגת על RLS רק אם בעליה יכול — כלומר בעל התכונה `BYPASSRLS`, או בעלות על טבלה שאינה `FORCE`. הסתמכות על `BYPASSRLS` של `postgres` ב-Supabase היא הנחה על התנהגות פלטפורמה שאינה מתועדת כחוזה; לכן נבחרה הדרך הניידת — הורדת FORCE.

### Amendment B — 2026-08-30 (ממצאי backend-builder בסיום B5-B8, חוסם B9/B13)

| # | הממצא | התיקון |
|---|---|---|
| B-1 | `handle_new_auth_user()` (auth-sync trigger מ-B3) הוא definer לגיטימי שאינו ב-whitelist ⇒ CI (ה) נופלת | נוסף ל-whitelist (9 פונקציות). נשאר ב-`public` מסיבה טכנית מנומקת (§D3.3) |
| B-2 | פונקציות ב-schema `app` בלתי-קריאות דרך `supabase.rpc()` — `app` אינו exposed schema ב-PostgREST | **§D3.3 חדש:** חוזה ה-RPC עובר ל-`public`, internals נשארים ב-`app`. **`app` לא ייחשף ל-PostgREST לעולם** |
| B-3 | (הידוק, נגזר מ-B-2) `revoke all on schema app` הוא גבול אבטחה מבוסס **רזולוציית-שם** בלבד, והוא **אינו** מבטל `EXECUTE` — שברירת המחדל שלו ב-Postgres היא `PUBLIC` | §D3: grants מפורשים. USAGE נשאר מבוטל; EXECUTE מבוטל גורף ומוענק נקודתית לשתי פונקציות ה-policy |
| B-4 | (מונע-סחף) כל אירוע audit שאינו DML היה דורש פונקציית definer חדשה — ה-whitelist היה תופח בכל פיצ'ר | נוספה `public.log_event()` גנרית עם רשימת actions סגורה (§D11) |

**על B-3 — ותיקון להנחה שלי.** בטיוטה ראשונה של Amendment זה כתבתי ש-`revoke all on schema app` **שובר את הערכת ה-policies**. **זה לא נכון, וה-builder צדק.** ההבחנה המדויקת:

- **`USAGE` על schema נבדק ברזולוציית שם** (parse analysis). ביטוי RLS policy נשמר **מנותח מראש, לפי OID** — ולכן שאילתה על `customers` אינה מבצעת חיפוש שם של `app.current_business_ids` בזמן ריצה, ואינה נכשלת בהיעדר USAGE. זה מסביר למה B5-B8 עברו אימות בהצלחה.
- **`EXECUTE` על הפונקציה כן נבדק בזמן ריצה.** וכאן הבעיה האמיתית: `revoke all **on schema**` מבטל הרשאות ברמת ה-schema בלבד — הוא **אינו נוגע ב-ACL של הפונקציות**, ש-Postgres מעניק ל-`PUBLIC` כברירת מחדל. כלומר בנוסח המקורי, `authenticated` החזיק `EXECUTE` על **כל** מה שב-`app`, וההגנה היחידה הייתה שהוא לא יכול לכתוב את השם. זו הגנה מקרית, לא מתוכננת — ובדיוק סוג הדבר שקורס כשמישהו יוסיף `grant usage` זמני ל-debug וישכח להסיר (מה שקרה, כהודאת ה-builder עצמו: "`grant usage on schema app to authenticated` **זמני, ל-verification בלבד**").

**התיקון** הוא לעשות את שתי השכבות מפורשות במקום להישען על אחת מהן במקרה: לבטל `EXECUTE` גורף על תוכן `app`, להעניק אותו נקודתית לשתי הפונקציות שביטויי ה-policy באמת קוראים להן, ולהשאיר את `USAGE` מבוטל כשכבה שנייה.

השורש המשותף ל-B-2 ול-B-3 הוא בלבול בין שני מנגנונים נפרדים: **הרשאות Postgres** (`grant`/`revoke`) לעומת **חשיפת PostgREST** (`db-schemas` בקונפיג). גם אם `USAGE` היה מוענק, `app` עדיין לא היה endpoint. ואם `app` היה נחשף — `revoke` לא היה מספיק. שתי ההחלטות נפרדות, ושתיהן מוכרעות מפורשות ב-§D3.3.

*Amendment B לא הוסיף החלטות הטעונות אישור CEO — ארבעת התיקונים בסמכות הארכיטקט.*

---

## Context

מערכת הפקת מסמכים חשבונאיים למייסד (עוסק פטור) ולחבריו (לפחות עוסק מורשה אחד). נפח זעום (~2 מסמכים/חודש לעסק, סדר גודל 10 עסקים), אך **הדרישות הרגולטוריות אינן תלויות בנפח**: מספור רציף, אי-מחיקה, ארכיון 7 שנים, חתימה, הפרדה מוחלטת בין עסקים. מסמך שהופק שגוי הוא אירוע מס, לא באג.

השכבה הזו היא הבלתי-הפיכה ביותר בפרויקט: ברגע שהופקה הקבלה האמיתית הראשונה, אי אפשר לתקן retroactively את מבנה הטבלה — המסמכים immutable מעצם הגדרתם. לכן ה-schema נכתב כאן **במלואו**, כולל עמודות של Phase 2 (מספר הקצאה, ניכוי מס במקור) ו-Phase 3, גם אם הלוגיקה שלהן לא מיושמת.

הפרויקט יורש שני invariants מ-`CLAUDE.md`: בידוד בכל שורה (#1) ו-audit log על כל mutation (#2). Invariants #3 (agent gating) ו-#4 (Customization Agent) אינם רלוונטיים — אין כאן סוכני AI ואין שינויי schema דינמיים.

**הבחנת מונחים:** ב-ERP הישות היא `tenant`; כאן היא `business` (עסק). זו לא רק שפה — משתמש יחיד יכול להיות חבר בכמה עסקים (המייסד + עסק של חבר שהוא מנהל לו), ולכן היחס user↔business הוא many-to-many. זה ההבדל המבני מ-ADR-002, שבו `users.tenant_id` הוא יחיד.

---

## Decision

### D1 — Postgres יחיד ב-Supabase, בידוד ב-RLS על `business_id`, חברות דרך `business_members`

כל טבלה עסקית נושאת `business_id uuid not null`, עם RLS policy שמתירה גישה רק אם למשתמש יש שורה ב-`business_members`. אין schema-per-business ואין DB-per-business.

**נימוק:** בסדר גודל של 10 עסקים, כל אלטרנטיבה היא overhead תפעולי טהור. RLS הוא הדפוס הילידי של Supabase (`auth.uid()` זמין ישירות ב-policy), ותואם את ADR-002 — כך שאם המערכת תהפוך למודול Billing של SUPER-MESHINE, הדפוס כבר נכון.

| קריטריון | RLS משותף | schema-per-business | DB-per-business |
|---|---|---|---|
| תאימות Supabase Auth | ✅ ילידי | ⚠️ ידני | ❌ |
| Many-to-many user↔business | ✅ | ⚠️ search_path דינמי | ❌ |
| עלות ב-₪0 | ✅ | ✅ | ❌ |
| חוזק בידוד | ⚠️ לוגי | ✅ | ✅✅ |
| מורכבות תפעולית ל-10 עסקים | ✅ | ❌ | ❌ |

הפער היחיד לרעת RLS — חוזק הבידוד — מטופל ב-D3 (policy אחיד + בדיקות CI) ובעובדה שאין כאן multi-tenant מסחרי אלא חבורה מוכרת.

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

**enum ולא text+CHECK:** ערכי ה-enum האלה נגזרים מהחוק ולא מהמוצר — הם לא ישתנו לפי גחמה. Postgres enum נותן טיפוס בסיס ל-FK-ים לוגיים (`document_counters.document_type`) ומייצר טעות בזמן compile ב-Drizzle/Kysely.

**הרחבות מתוכננות (additive, לא breaking):**
- `document_status` יקבל `'pending_allocation'` ב-Phase 2 (ראה ADR-INV-002 §D5).
- `payment_method` עשוי לקבל `'withholding'` ב-Phase 2 (ניכוי מס במקור כרכיב תקבול).

**החלטה על `credit_note` יחיד:** אין טיפוס נפרד ל"קבלת זיכוי". `credit_note` הוא מסמך ההיפוך היחיד; **הכותרת המודפסת נגזרת ממסמך האב ומסוג הישות** — "חשבונית זיכוי" מול `tax_invoice`/`tax_invoice_receipt`, "הודעת זיכוי" מול `receipt`/`proforma_invoice` או כשהעסק פטור. סדרת מספור אחת לזיכויים בכל עסק.
*נימוק:* טיפוס שביעי היה מכפיל את מטריצת המספור, את מטריצת ההרשאות לפי סוג ישות ואת תבניות ה-PDF, בשביל הבחנה שהיא ויזואלית בלבד. **⚠️ טעון אישור רו"ח.**

### D3 — RLS: helper functions ב-`SECURITY DEFINER`

```sql
-- schema נפרד ללוגיקה פנימית. לא נחשף ל-PostgREST לעולם (§D3.3).
create schema app;

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

-- הרשאות מפורשות — שתי שכבות נפרדות  [Amendment B-3]
-- (1) שכבת השם: authenticated לא יכול לכתוב "app.foo" בשאילתה טרייה.
revoke all on schema app from public, anon, authenticated;

-- (2) שכבת ה-ACL: EXECUTE מוענק ל-PUBLIC כברירת מחדל של Postgres —
--     "revoke all ON SCHEMA" לא נוגע בו. מבטלים גורף, ומעניקים נקודתית
--     רק לשתי הפונקציות שביטויי ה-policy קוראים להן בזמן ריצה.
revoke execute on all functions in schema app from public, anon, authenticated;
grant  execute on function app.current_business_ids()               to authenticated;
grant  execute on function app.has_role(uuid, public.member_role[]) to authenticated;
```

**למה שתי השכבות, ולמה הן לא מיותרות זו לזו.** `USAGE` על schema נבדק ב**רזולוציית שם**; `EXECUTE` על פונקציה נבדק ב**זמן ריצה**. ביטוי RLS policy נשמר מנותח מראש לפי OID, ולכן הוא **אינו** עובר רזולוציית שם בכל שאילתה — הוא ירוץ גם בלי `USAGE`, אך **לא** ירוץ בלי `EXECUTE`. מכאן:

- ההענקה הנקודתית של `EXECUTE` לשתי הפונקציות היא מה שמאפשר ל-policies לעבוד. היא **חובה**.
- ביטול ה-`USAGE` הוא שכבת עומק שחוסמת קריאה ישירה מהלקוח. היא **לא** מה שמגן על שאר הפונקציות ב-`app` — ה-`revoke execute` הגורף הוא זה שמגן.

הבידוד לא נפגע מהחשיפה של שתי הפונקציות: `current_business_ids()` מחזירה את החברויות של הקורא עצמו, ו-`has_role()` בודקת את הקורא עצמו. שתיהן בטוחות גם אם ייקראו ישירות.

⚠️ **`grant usage on schema app to authenticated` אסור כפתרון קבע.** אם במהלך פיתוח מתגלה שמשהו דורש אותו — זה סימן שקוד לקוח מנסה לקרוא ל-`app.*` ישירות, כלומר הוא במקום הלא נכון (§D3.3). ה-grant הזמני שנוסף ב-verification של B8 אינו נכנס ל-commit.

תבנית ה-policy האחידה (כל טבלה עסקית, ללא יוצא מן הכלל):

```sql
alter table customers enable row level security;
-- ⚠️ בלי FORCE. ראה D3.2.

create policy customers_read on customers for select to authenticated
  using (business_id in (select app.current_business_ids()));

create policy customers_write on customers for all to authenticated
  using      (app.has_role(business_id, array['owner','editor']::member_role[]))
  with check (app.has_role(business_id, array['owner','editor']::member_role[]));
```

שלוש נקודות קריטיות:

1. **`SECURITY DEFINER` הוא חובה, לא אופטימיזציה.** policy על `customers` שעושה subquery ל-`business_members` היה מפעיל את ה-RLS של `business_members` ← רקורסיה אינסופית. פונקציית definer שוברת את המעגל **בתנאי שבעליה באמת מדלג על RLS** (D3.2).
2. **`stable`** מאפשר ל-planner לקרוא לפונקציה פעם אחת לכל statement במקום לכל שורה.
3. **`set search_path = ''` בכל פונקציית definer, עם שמות מלאים** (`public.business_members`, `public.member_role`). hardening סטנדרטי נגד search-path hijack. חל על **כל** 9 הפונקציות ב-whitelist של D3.2.

**RLS על `business_members` עצמה** (המקום שבו הרקורסיה מתחילה):
```sql
create policy bm_self  on business_members for select to authenticated
  using (user_id = (select auth.uid()));                       -- "החברויות שלי" — ללא פונקציה
create policy bm_peers on business_members for select to authenticated
  using (business_id in (select app.current_business_ids()));  -- דרך definer ← אין רקורסיה
create policy bm_manage on business_members for all to authenticated
  using      (app.has_role(business_id, array['owner']::member_role[]))
  with check (app.has_role(business_id, array['owner']::member_role[]));
```
`bm_manage` מכסה הוספה/הסרה/שינוי-תפקיד של חברים **קיימים**. שורת ה-owner הראשונה אינה עוברת כאן — ראה D10.

#### D3.1 — Policies של `businesses` *(Amendment A-1)*

`businesses` היא שורש ה-scope ולכן עמודת ה-scoping שלה היא `id`, לא `business_id`:

```sql
alter table businesses enable row level security;

create policy businesses_read on businesses for select to authenticated
  using (id in (select app.current_business_ids()));

create policy businesses_update on businesses for update to authenticated
  using      (app.has_role(id, array['owner']::member_role[]))
  with check (app.has_role(id, array['owner']::member_role[]));

-- ⚠️ אין policy ל-INSERT ואין policy ל-DELETE. במכוון.
```

- **אין INSERT policy** — יצירת עסק עוברת אך ורק ב-`public.create_business()` (D10). זהו אותו דפוס שכבר נקבע ל-`document_counters` ול-`documents.status`: כשלכתיבה יש בדיוק נתיב לגיטימי אחד, הוא פונקציה צרה ולא policy רחבה.
- **אין DELETE policy — לעולם.** מסמכים מפנים ל-`businesses` ב-`on delete restrict`, וארכיון של 7 שנים לא מוחקים. השבתה נעשית ב-`is_active = false`.
- **`created_by`, `tax_id` ו-`entity_type` אינם ניתנים לשינוי** דרך ה-UPDATE policy: trigger `businesses_protect_identity_trg` חוסם שינוי בשלושתם. שינוי `tax_id` היה מנתק את המסמכים ההיסטוריים מהישות המשפטית שהפיקה אותם; שינוי `entity_type` הוא אירוע רגולטורי שדורש נוהל, לא עריכת טופס.

#### D3.2 — `FORCE ROW LEVEL SECURITY`: רק על `business_signing_keys` *(Amendment A-4)*

**הכלל:** כל הטבלאות מקבלות `ENABLE ROW LEVEL SECURITY` בלבד. `FORCE` מוחל על טבלה אחת בלבד — `business_signing_keys`.

**נימוק.** תחת `FORCE`, גם בעלת הטבלה כפופה ל-policies. פונקציית `SECURITY DEFINER` רצה בזהות בעליה (`postgres`), שאינו חבר ב-`authenticated`, ולכן אף policy לא חלה עליו — התוצאה היא דחייה. זה היה שובר בבת אחת את שלושת עמודי התווך: את `app.current_business_ids()` (נעילה מוחלטת), את הכתיבה ל-`document_counters` (שאין לה policy כתיבה במכוון), ואת ה-audit trigger שכותב ל-`audit_log` (שאין לה policy INSERT במכוון). בייפאס דרך `BYPASSRLS` של `postgres` ב-Supabase הוא התנהגות פלטפורמה שאינה חוזה מתועד — לא בסיס לתכנון.

**`business_signing_keys` היא החריג הנכון** בדיוק משום שאף פונקציית definer אינה נוגעת בה: הקורא הלגיטימי היחיד שלה הוא `service_role`, שמדלג על RLS מתוקף `BYPASSRLS` — תכונה שגוברת על `FORCE`. כלומר FORCE כאן חוסם את בעלת הטבלה מבלי לחסום את הנתיב הלגיטימי.

**מה איבדנו ומה מחליף אותו.** FORCE נועד למנוע מ-session שרץ כ-`postgres` לראות נתונים חוצי-עסקים. שלושה controls מחליפים אותו: (1) האפליקציה לעולם אינה מתחברת כ-`postgres` — רק `anon`/`authenticated`/`service_role`; (2) `service_role` דילג על FORCE ממילא, כך שהוא מעולם לא הגן מפני נתיב האיום הריאלי; (3) **בדיקת CI (ה)** מול whitelist סגור של פונקציות definer — זה ה-control האמיתי.

**Whitelist של `SECURITY DEFINER` functions (סגור, 9 פונקציות)** *(עודכן ב-Amendment B)*:

| # | פונקציה | schema | למה definer |
|---|---|---|---|
| 1 | `current_business_ids()` | `app` | שוברת רקורסיית RLS על `business_members` |
| 2 | `has_role(uuid, member_role[])` | `app` | כנ"ל |
| 3 | `audit_trigger()` | `app` | כותבת ל-`audit_log` שאין לה policy INSERT |
| 4 | `handle_new_auth_user()` | `public` | רצה בזהות `supabase_auth_admin`, שאין לו INSERT על `public.users` |
| 5 | `create_business(...)` | `public` | אין INSERT policy על `businesses`; bootstrap אטומי (D10) |
| 6 | `issue_document(uuid, date)` | `public` | כותבת ל-`document_counters` שאין לה policy כתיבה |
| 7 | `set_start_number(...)` | `public` | כנ"ל |
| 8 | `send_document(uuid, text[])` | `public` | כותבת אירוע `send` ל-`audit_log` |
| 9 | `log_event(...)` | `public` | אירועי audit שאינם DML (D11) |

**כלל צמצום:** trigger function שרק **מאמתת** ומעלה exception (`app.documents_immutable`, `app.child_rows_locked`, `app.businesses_protect_identity`, `app.audit_log_immutable`) חייבת להיות **`SECURITY INVOKER`** — היא לא כותבת לשום מקום מוגן. אותו דבר לפונקציות עזר שנקראות רק מתוך definer אחרת (`app.seed_for`) — הן יורשות את ההקשר. בדיקת CI (ה) אוכפת: כל `prosecdef` שאינו ב-9 = build fail.

#### D3.3 — חלוקת ה-schemas: `public` = חוזה ה-RPC, `app` = internals *(Amendment B-1, B-2)*

**הבעיה שנמצאה:** PostgREST חושף רק את ה-schemas שמוגדרים ב-`db-schemas` (ברירת מחדל: `public, graphql_public`). פונקציות ב-`app` אינן נגישות דרך `supabase.rpc()` — בסתירה ל-Implementation Notes #1 ול-ADR-INV-002 §D2.

**ההכרעה — שתי שכבות מפורשות:**

| schema | תפקיד | נגיש ל-PostgREST | תוכן |
|---|---|---|---|
| `public` | **חוזה ה-RPC** — כל מה שהאפליקציה קוראת לו | כן | `create_business`, `issue_document`, `set_start_number`, `send_document`, `log_event`, `handle_new_auth_user` |
| `app` | **internals** — לעולם לא endpoint | **לא. אף פעם.** | `current_business_ids`, `has_role`, `audit_trigger`, כל trigger functions, `seed_for` |

**למה לא לחשוף את `app` ל-PostgREST** (החלופה שנבחנה ונדחתה) — שני נימוקים בלתי תלויים:

1. **חשיפת schema היא default-open.** כל פונקציה שתתווסף ל-`app` בעתיד תהפוך אוטומטית ל-endpoint, אלא אם מישהו יזכור `revoke`. זה הפוך מכל עמדה אחרת ב-ADR הזה — default-deny ב-whitelist של ה-immutability trigger, רשימה סגורה של service_role, רשימה סגורה של definer. לא נשבור את הקו בשביל נוחות.
2. **זה מוציא החלטה ביטחונית מחוץ ל-migrations.** `db-schemas` הוא קונפיג של הפרויקט (`config.toml` + דשבורד), לא DDL. הוא לא נוסע עם ה-migrations, לא מכוסה בבדיקות ה-CI, ויכול לסטות בין local/staging/prod בלי שאיש ישים לב. כל שאר מודל האבטחה כאן חי בקבצי migration בדיוק כדי שזה לא יקרה.

**למה `public` ולא wrapper functions ב-`public` שקוראות ל-`app`** (החלופה השלישית): ה-wrapper מכפיל כל חתימה בשני מקומות שחייבים להישאר מסונכרנים, בתמורה לניקיון שמות בלבד. עלות תחזוקה אמיתית מול תועלת קוסמטית.

**הכללים הנגזרים — חובה על כל פונקציה ב-`public`:**
```sql
create or replace function public.issue_document(p_document_id uuid, p_issue_date date default null)
returns public.documents
language plpgsql security definer set search_path = ''    -- שמות מלאים בגוף
as $$ ... $$;

revoke execute on function public.issue_document(uuid, date) from public, anon;
grant  execute on function public.issue_document(uuid, date) to authenticated;
```
- `revoke execute ... from public, anon` ואז `grant ... to authenticated` — **על כל אחת מחמש פונקציות ה-RPC.** בלי זה, `anon` מקבל execute כברירת מחדל של Postgres והפונקציה נגישה ללא התחברות. בדיקת CI (ו) אוכפת.
- **המשפט הראשון בגוף כל פונקציית RPC** הוא אימות חברות/תפקיד מפורש. ה-definer מבטל את ה-RLS — האימות חייב להיות ידני ומפורש.

**`handle_new_auth_user()` נשאר ב-`public`** *(B-1)* — חריג יחיד לכלל "trigger functions ב-`app`", משתי סיבות: (א) זה דפוס Supabase המתועד, ו-`supabase_auth_admin` (ה-role שמריץ את ה-INSERT ל-`auth.users`) צריך גישה אליו — הצבה ב-`app` הייתה מוסיפה `grant usage on schema app to supabase_auth_admin` ותלות בהתנהגות פלטפורמה נוספת, בדיוק סוג ההימור שנדחה ב-A-4; (ב) הימצאותו ב-`public` אינה הופכת אותו ל-endpoint — **PostgREST אינו חושף פונקציות שטיפוס ההחזרה שלהן `trigger`**. כחגורה-ושלייקס: `revoke execute on function public.handle_new_auth_user() from public, anon, authenticated`.

דרישות נוספות עליו: `set search_path = ''`, ו-`insert ... on conflict (id) do nothing` כדי שהרצה חוזרת לא תשבור הרשמה.

### D4 — מודל ההרשאות: 4 roles, אכיפה ב-policy ולא באפליקציה

| role | קורא | יוצר טיוטות | מפיק מסמך | מנהל חברים / הגדרות עסק |
|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | ✅ | ❌ |
| `viewer` | ✅ | ❌ | ❌ | ❌ |
| `accountant` | ✅ + ייצוא | ❌ | ❌ | ❌ |

`accountant` נכנס ל-schema מ-Phase 0 אף שהמסך שלו הוא Phase 3 — הוספת ערך ל-enum אחרי שיש policies כתובות מחייבת עדכון של כל policy. זול עכשיו, יקר אחר כך.

**כלל:** לפחות `owner` אחד לכל עסק — trigger `AFTER DELETE OR UPDATE ON business_members` שמעלה exception אם נותרו אפס owners.

### D5 — נתיבי `service_role`: שלושה בלבד, מרוכזים, ניתנים לאכיפה ב-lint

| נתיב | למה חייב service_role | למה זה בטוח |
|---|---|---|
| **צינור החתימה** (`api/sign.py`) | `business_signing_keys` היא טבלה **ללא policies כלל ועם FORCE** — אין דרך אחרת | רץ server-only; מקבל `document_id` בלבד + טוקן HMAC פנימי קצר-מועד; מאמת בעצמו `status='issued'`; לא מחזיר חומר מפתח |
| **עמוד צפייה ציבורי** (`/d/[token]`) | הצופה אנונימי — אין `auth.uid()` | שאילתה **רק** לפי `sha256(token)`; תגובה מסוננת ל-whitelist שדות; קישור בר-ביטול; rate-limit |
| **גיבוי/ייצוא לילי** | חוצה-עסקים בהגדרה | read-only; רץ ב-GitHub Actions; פלט מוצפן |

**כלל אכיפה:** כל קריאה עם `service_role` חייבת לשבת תחת `src/server/service-role/`. ESLint rule (`no-restricted-imports`) חוסם import מכל מקום אחר. `SUPABASE_SERVICE_ROLE_KEY` לעולם לא בקידומת `NEXT_PUBLIC_`.

**מה **לא** עובר ב-service_role:** יצירת עסק (`public.create_business`), המונים וההפקה (`public.issue_document`), audit (`app.audit_trigger` / `public.log_event`), שליחת מייל (`public.send_document`).

פונקציית definer עדיפה על service_role בכל אחד מהמקרים: היא מוגבלת לפעולה אחת מוגדרת, מאמתת חברות בעצמה, ו-`auth.uid()` ממשיך להחזיר את המשתמש האמיתי בתוכה (נקרא מ-GUC של ה-JWT, לא מ-`current_user`) — כך שה-audit נשאר מדויק.

### D6 — Audit log ב-triggers בלבד (סטייה מודעת מ-ADR-006)

*נימוק:* ב-ERP ה-middleware נדרש כדי לתפוס context שרק האפליקציה מכירה (`on_behalf_of_user_id`, `policy_id` של סוכן AI). כאן אין סוכנים, אין פעולות מטעם, ואין ORM מחייב — לקוח Supabase רגיל עוקף כל middleware של ORM. Trigger ב-DB תופס **כל** נתיב כתיבה כולל SQL Editor ידני ו-service_role.

אירועים שאינם DML נכתבים דרך `public.log_event()` (D11) או מתוך פונקציית ה-RPC הרלוונטית.

**⚠️ טעון אישור CEO** — סטייה מ-ADR-006.

### D7 — מפת scoping: לכל טבלה ב-`public` יש עמודת scope מוצהרת *(Amendment A-2, A-5)*

| קטגוריה | טבלאות | עמודת scoping | RLS |
|---|---|---|---|
| **1. Business-scoped** (ברירת מחדל) | `customers`, `items`, `documents`, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `customer_document_consents`, `business_signing_keys`, `audit_log`, `business_members` | `business_id` | חובה |
| **2. Scope-root** | `businesses` | `id` | חובה (D3.1) |
| **3. Self-scoped** | `users` | `id = auth.uid()` | חובה |
| **4. Reference data גלובלי** | `vat_rates` | — | ENABLE + policy SELECT לכולם, ללא policy כתיבה |

**כל טבלה ב-`public` חייבת להשתייך לאחת מארבע הקטגוריות.** קטגוריות 2-4 הן רשימה סגורה; הוספה מחייבת עדכון ADR.

`_migrations` **הוסרה**: Supabase CLI מנהל היסטוריית migrations ב-`supabase_migrations.schema_migrations` — schema נפרד שאינו `public`, שסינון ה-`nspname` בבדיקות ה-CI מוציא ממילא.

### D8 — אכיפת "אילו מסמכים מותרים לפי סוג ישות": **CHECK constraint על snapshot בשורת המסמך**

```sql
-- על documents:
business_entity_type entity_type not null,   -- snapshot, לא join

constraint doc_type_allowed_for_entity check (
  business_entity_type <> 'patur'
  or type not in ('tax_invoice','tax_invoice_receipt')
),
constraint patur_has_no_vat check (
  business_entity_type <> 'patur' or (vat_rate = 0 and vat_amount = 0)
)
```

העמודה מאוכלסת ב-`BEFORE INSERT` trigger מתוך `businesses`, ומאוכלסת **מחדש** במעבר `draft → issued` (מסמך נוצר משפטית ברגע ההפקה).

| חלופה | למה נדחתה |
|---|---|
| אכיפה באפליקציה (zod) בלבד | נעקפת ע"י service_role, ע"י SQL ידני, וע"י כל באג בנתיב חדש. מסמך לא-חוקי שהופק = אירוע מס. |
| Trigger שעושה `SELECT entity_type FROM businesses` | ניתן להשבתה ב-`DISABLE TRIGGER`; ומסתמך על **המצב הנוכחי** של `businesses` — עוסק פטור שהופך למורשה היה מחליק אחורה על המסמכים ההיסטוריים. |
| Composite FK `(business_id, entity_type)` | מקבע: העסק לא יוכל **לעולם** לשנות `entity_type` כשקיימים מסמכים (RESTRICT) או יגרור עדכון היסטוריה (CASCADE). |

ה-snapshot פותר את שלושתם, והופך את ההיסטוריה ל**מתארת את עצמה** — מסמך מ-2026 יודע שהופק ע"י עוסק פטור גם אחרי שהעסק עבר למורשה ב-2028.

**שלוש שכבות:** CHECK ב-DB (סמכותי) ← `public.issue_document()` מאמתת שוב עם הודעה בעברית ← ה-UI לא מציג טיפוס אסור.

| טיפוס | patur | murshe |
|---|---|---|
| `price_quote` | ✅ | ✅ |
| `proforma_invoice` (חשבונית עסקה) | ✅ | ✅ |
| `receipt` | ✅ | ✅ |
| `credit_note` | ✅ (כ"הודעת זיכוי", ללא מע"מ) | ✅ |
| `tax_invoice` | ❌ | ✅ |
| `tax_invoice_receipt` | ❌ | ✅ |

### D9 — מדיניות מספור: המונה ממשיך בין שנות מס (`continuous`), עם אפשרות `yearly`

שורת מונה קיימת תמיד פר `(business_id, document_type, tax_year)`. במצב `continuous` (ברירת מחדל), שורת שנה חדשה נזרעת מ-`next_number` של השנה הקודמת; במצב `yearly` היא נזרעת מ-`start_number`. אין ערך sentinel ואין שינוי במפתח הראשי.

*נימוק לברירת המחדל:* רציפות גורפת היא הפרשנות השמרנית של "מספור עוקב"; איפוס שנתי מייצר שני מסמכים שונים עם אותו מספר. **⚠️ טעון אישור רו"ח.**

### D10 — Bootstrap של עסק: `public.create_business()` ב-`SECURITY DEFINER` *(Amendment A-3; schema עודכן ב-B-2)*

```sql
create or replace function public.create_business(
  p_legal_name  text,
  p_entity_type public.entity_type,
  p_tax_id      text,
  p_tax_id_type text default 'vat',
  p_display_name text default null
) returns public.businesses
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_row public.businesses; v_count int;
begin
  if v_uid is null then raise exception 'INV_UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.users where id = v_uid) then
    raise exception 'INV_NO_PROFILE';                     -- פרופיל נוצר ב-handle_new_auth_user
  end if;

  select count(*) into v_count from public.businesses where created_by = v_uid;
  if v_count >= 10 then raise exception 'INV_BUSINESS_LIMIT'; end if;

  if p_tax_id !~ '^[0-9]{9}$' then raise exception 'INV_BAD_TAX_ID'; end if;

  begin
    insert into public.businesses (legal_name, display_name, entity_type, tax_id, tax_id_type, created_by)
    values (p_legal_name, coalesce(p_display_name, p_legal_name),
            p_entity_type, p_tax_id, p_tax_id_type, v_uid)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'INV_TAX_ID_EXISTS';
  end;

  insert into public.business_members (business_id, user_id, role)
  values (v_row.id, v_uid, 'owner');

  insert into public.audit_log (business_id, actor_type, actor_id, action,
                                table_name, record_id, after_data)
  values (v_row.id, 'user', v_uid, 'business_create', 'businesses', v_row.id, to_jsonb(v_row));

  return v_row;
end $$;

revoke execute on function public.create_business(text, public.entity_type, text, text, text)
  from public, anon;
grant  execute on function public.create_business(text, public.entity_type, text, text, text)
  to authenticated;
```

**למה RPC ולא policy:**

| חלופה | למה נדחתה |
|---|---|
| policy `INSERT` על `business_members` בנוסח "החבר הראשון רשאי להוסיף את עצמו" | (א) הזרימה נשברת לשתי קריאות REST נפרדות ללא transaction. כשל בשנייה משאיר **עסק יתום ללא חברים** — בלתי-נראה ל-RLS, בלתי-ניתן לשחזור, ו**שורף את ה-`tax_id` לצמיתות**. זה השיקול המכריע. (ב) ה-`not exists` שדרוש כדי לחסום self-grant חוזר מפעיל את ה-RLS של `business_members` מתוך policy על אותה טבלה ← רקורסיה. |
| trigger `AFTER INSERT ON businesses` | אטומי, אבל רץ בזהות הקורא ולכן חסום ע"י `bm_manage`; הפיכתו ל-definer מייצרת דילוג-RLS **סמוי** שנורה בכל INSERT מכל נתיב עתידי, ולא יכול להחזיר שגיאות ממופות. |
| endpoint ב-`service_role` | היה מוסיף נתיב service_role רביעי ושובר את הרשימה הסגורה של D5. |

**מגבלת 10 עסקים למשתמש:** בהיעדר INSERT policy אין בודק חיצוני, ומשתמש מאומת יכול לקרוא ל-RPC בלולאה. בלם abuse, לא כלל עסקי.

**סדר ההקמה המלא** (המשך ב-ADR-INV-003 §D4): `create_business()` מסתיימת בעסק **ללא מפתח חתימה**. ה-route קורא מיד ל-`api/keygen.py`. עד שהמפתח נוצר, `public.issue_document()` מעלה `INV_NO_SIGNING_KEY` וה-UI מציג באנר עם "נסה שוב". לא מוסיפים עמודת סטטוס לעסק — קיום שורה פעילה ב-`business_signing_keys` הוא מקור האמת היחיד.

### D11 — `public.log_event()`: אירועי audit שאינם DML, בפונקציה אחת *(Amendment B-4)*

`audit_log` היא ללא policy INSERT במכוון, ולכן **כל** אירוע שאינו DML (הורדה, צפייה, ייצוא, הסכמות, אירועי מפתח) היה דורש פונקציית definer ייעודית. בקצב הזה ה-whitelist של D3.2 היה תופח בכל פיצ'ר — ואיתו משטח הסיכון של דילוג-RLS.

```sql
create or replace function public.log_event(
  p_business_id uuid,
  p_action      text,
  p_table_name  text default null,
  p_record_id   uuid default null,
  p_meta        jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.has_role(p_business_id, array['owner','editor','viewer','accountant']::public.member_role[])
    then raise exception 'INV_FORBIDDEN'; end if;

  if p_action not in ('download','view_public','export',
                      'consent_grant','consent_revoke','key_create','key_revoke')
    then raise exception 'INV_BAD_EVENT'; end if;   -- ⬅ insert/update/delete/issue אסורים כאן

  insert into public.audit_log (business_id, actor_type, actor_id, action,
                                table_name, record_id, after_data)
  values (p_business_id, 'user', auth.uid(), p_action, p_table_name, p_record_id, p_meta);
end $$;

revoke execute on function public.log_event(uuid, text, text, uuid, jsonb) from public, anon;
grant  execute on function public.log_event(uuid, text, text, uuid, jsonb) to authenticated;
```

שלוש הגנות: אימות חברות מפורש, `actor_id` נכפה מ-`auth.uid()` ולא מפרמטר, ורשימת actions סגורה שאינה כוללת אף פעולת DML — כך שאי אפשר לזייף "מישהו אחר עדכן את המסמך". פעולות מטעם המערכת (`view_public` אנונימי, `sign`) ממשיכות להיכתב ב-service_role.

---

## Schema

### טבלאות גלובליות

```sql
-- הרחבת פרופיל בלבד. מקור הזהות הוא auth.users של Supabase.
create table users (
  id           uuid primary key references auth.users(id) on delete restrict,
  full_name    text not null,
  phone        text,
  locale       text not null default 'he',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- RLS: select/update רק על השורה של עצמך (id = auth.uid()).
-- השורה נוצרת ב-trigger public.handle_new_auth_user() על auth.users — לא ע"י הלקוח.
-- (§D3.3: נשאר ב-public; SECURITY DEFINER; search_path=''; on conflict do nothing;
--  revoke execute from public, anon, authenticated)

create table vat_rates (
  rate         numeric(5,2) not null,
  valid_from   date not null,
  valid_to     date,                          -- null = בתוקף
  primary key (valid_from),
  constraint vat_range check (valid_to is null or valid_to > valid_from)
);
-- seed: (17.00, 2015-10-01, 2024-12-31), (18.00, 2025-01-01, null)
-- RLS: select ל-authenticated; אין policy כתיבה כלל (service_role בלבד).
```

### עסקים וחברות

```sql
create table businesses (
  id                     uuid primary key default gen_random_uuid(),
  legal_name             text not null,
  display_name           text,
  entity_type            entity_type not null,
  tax_id                 text not null,                       -- ע.מ / ח.פ, 9 ספרות
  tax_id_type            text not null default 'vat'
                           check (tax_id_type in ('vat','company','id')),

  address_line1          text, address_line2 text, city text,
  postal_code            text, country char(2) not null default 'IL',
  phone                  text, email citext, website text,

  logo_path              text,                                -- storage: business-assets/<id>/logo.*
  accent_color           text not null default '#0f766e',
  invoice_footer_note    text,

  default_payment_terms_days int not null default 0,
  numbering_reset_policy text not null default 'continuous'
                           check (numbering_reset_policy in ('continuous','yearly')),

  is_active              boolean not null default true,
  created_by             uuid not null references users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint tax_id_digits check (tax_id ~ '^[0-9]{9}$'),
  constraint businesses_id_entity_uk unique (id, entity_type)   -- לשימוש עתידי בלבד
);
create unique index businesses_tax_id_uk on businesses (tax_id);   -- ⚠️ ראה סעיף האישורים

-- RLS: ראה D3.1 (SELECT לחברים, UPDATE ל-owner, ללא INSERT/DELETE)
-- trigger businesses_protect_identity_trg: חוסם שינוי ב-created_by / tax_id / entity_type
```

**`unique(tax_id)` הוא בקרה, לא נוחות:** שתי שורות `businesses` לאותה ישות משפטית = שתי סדרות מספור מקבילות לאותו עוסק = הפרה של המספור הרציף. ה-`unique_violation` ממופה ב-`create_business()` ל-`INV_TAX_ID_EXISTS`.

```sql
create table business_members (
  business_id  uuid not null references businesses(id) on delete restrict,
  user_id      uuid not null references users(id)      on delete restrict,
  role         member_role not null default 'owner',
  invited_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on business_members (user_id);
```

### מפתחות חתימה (פירוט מלא ב-ADR-INV-003)

```sql
create table business_signing_keys (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references businesses(id) on delete restrict,
  algorithm               text not null default 'RSA-3072',
  certificate_pem         text not null,          -- ציבורי, self-issued
  certificate_serial      text not null,
  subject_dn              text not null,
  fingerprint_sha256      bytea not null,
  not_before              timestamptz not null,
  not_after               timestamptz not null,

  private_key_ciphertext  bytea not null,         -- PKCS#8 DER, AES-256-GCM
  private_key_nonce       bytea not null,
  wrapped_dek             bytea not null,
  kek_id                  text  not null,         -- גרסת ה-master key

  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  revoked_at              timestamptz,
  revoke_reason           text
);
create unique index bsk_active_uk on business_signing_keys (business_id) where is_active;

alter table business_signing_keys enable row level security;
alter table business_signing_keys force  row level security;   -- ⬅ הטבלה היחידה עם FORCE (D3.2)
-- ⚠️ אין ולא תהיה אף policy. RLS ללא policy = דחייה גורפת.
--    service_role בלבד, מתוקף BYPASSRLS שגובר על FORCE.
-- ⚠️ אין audit trigger על הטבלה הזו (כדי לא לשכפל ciphertext ל-audit_log).
--    אירועי מפתח נרשמים דרך public.log_event() עם metadata בלבד.
```

### לקוחות, קטלוג, הסכמות

```sql
create table customers (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete restrict,
  name                  text not null,
  tax_id                text,                                  -- חובה להקצאה (Phase 2)
  tax_id_type           text check (tax_id_type in ('vat','company','id','foreign')),
  email                 citext, phone text,
  address_line1         text, address_line2 text, city text,
  postal_code           text, country char(2) not null default 'IL',
  payment_terms_days    int,
  withholding_tax_rate  numeric(5,2) not null default 0,        -- Phase 2
  notes                 text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint customers_id_business_uk unique (id, business_id)
);
create index        customers_lookup_idx on customers (business_id, is_active, name);
create unique index customers_taxid_uk   on customers (business_id, tax_id) where tax_id is not null;

create table items (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references businesses(id) on delete restrict,
  name                 text not null,
  description          text,                                   -- רב-שורתי; לב הדרישה של המייסד
  default_unit_price   numeric(14,2),                          -- ⬅ NULLABLE במכוון
  unit                 text not null default 'יח׳',
  default_vat_treatment vat_treatment not null default 'standard',
  is_active            boolean not null default true,
  usage_count          int not null default 0,
  last_used_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint items_id_business_uk unique (id, business_id)
);
create unique index items_name_uk on items (business_id, lower(name)) where is_active;
create index        items_recent_idx on items (business_id, last_used_at desc nulls last);

create table customer_document_consents (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete restrict,
  customer_id   uuid not null,
  channel       consent_channel not null,
  consented_at  timestamptz not null,
  consent_text  text not null,          -- snapshot של הנוסח המדויק שהוצג
  evidence      jsonb not null default '{}'::jsonb,   -- message-id / ip / ua / נתיב קובץ חתום
  revoked_at    timestamptz,
  revoke_reason text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  foreign key (customer_id, business_id) references customers (id, business_id)
);
create unique index consent_active_uk on customer_document_consents (business_id, customer_id)
  where revoked_at is null;
```

**ההסכמה היא חלק ממערכת החשבונות** (חוזר מ"ה 24/2004): `consent_text` נשמר כ-snapshot ולא כהפניה לנוסח נוכחי, והשורה immutable פרט ל-`revoked_at`/`revoke_reason`. **כלל אכיפה:** שליחת "מקור" ממוחשב במייל אסורה ללא הסכמה פעילה — נבדק ב-`public.send_document()`; ללא הסכמה, `documents.delivery_mode = 'print'`.

### מסמכים

```sql
create table documents (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete restrict,

  -- זהות ומספור
  type                  document_type not null,
  status                document_status not null default 'draft',
  document_number       bigint,                 -- null בטיוטה
  tax_year              int,                    -- null בטיוטה
  display_number        text,                   -- המחרוזת המודפסת בפועל
  issue_date            date,                   -- התאריך החשבונאי על המסמך
  issued_at             timestamptz,            -- רגע ההפקה בפועל
  due_date              date,

  -- קישור
  parent_document_id    uuid,
  credit_reason         text,

  -- snapshots (ADR-INV-002 §D4)
  customer_id           uuid,
  customer_snapshot     jsonb,
  business_snapshot     jsonb,
  business_entity_type  entity_type not null,

  -- כספים (₪ בלבד ב-Phase 1)
  currency              char(3) not null default 'ILS',
  exchange_rate         numeric(18,6) not null default 1,
  subtotal_amount       numeric(14,2) not null default 0,
  discount_amount       numeric(14,2) not null default 0,
  net_amount            numeric(14,2) not null default 0,
  vat_rate              numeric(5,2)  not null default 0,
  vat_amount            numeric(14,2) not null default 0,
  total_amount          numeric(14,2) not null default 0,
  withholding_rate      numeric(5,2)  not null default 0,   -- Phase 2
  withholding_amount    numeric(14,2) not null default 0,   -- Phase 2
  payable_amount        numeric(14,2) not null default 0,
  signed_total          numeric(14,2) generated always as
                          (case when type = 'credit_note' then -total_amount else total_amount end) stored,

  -- מצב נגזר (mutable אחרי הפקה — ראה whitelist ב-ADR-INV-002)
  paid_amount           numeric(14,2) not null default 0,
  credited_amount       numeric(14,2) not null default 0,
  settled_at            timestamptz,

  -- מסירה
  delivery_mode         text not null default 'computerized'
                          check (delivery_mode in ('computerized','print')),
  sent_at               timestamptz,
  sent_to               text[],

  -- PDF וחתימה (ADR-INV-003)
  pdf_status            pdf_status not null default 'pending',
  pdf_original_path     text,
  pdf_copy_path         text,
  pdf_sha256            bytea,
  signing_key_id        uuid references business_signing_keys(id),
  signed_at             timestamptz,
  pdf_attempts          int not null default 0,
  pdf_error             text,

  -- Phase 2 — חשבוניות ישראל
  allocation_number     text,
  allocation_request_id uuid,

  notes                 text,          -- מודפס
  internal_note         text,          -- לא מודפס; mutable תמיד

  created_by            uuid not null references users(id),
  issued_by             uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint documents_id_business_uk unique (id, business_id),
  foreign key (parent_document_id, business_id) references documents (id, business_id),
  foreign key (customer_id,        business_id) references customers (id, business_id),

  constraint draft_has_no_number check (status <> 'draft' or document_number is null),
  constraint issued_is_complete  check (
    status = 'draft' or (document_number is not null and tax_year is not null
                         and issued_at is not null and issue_date is not null
                         and customer_snapshot is not null and business_snapshot is not null)),
  constraint credit_needs_parent check (
    type <> 'credit_note' or (parent_document_id is not null and credit_reason is not null)),
  constraint amounts_non_negative check (total_amount >= 0 and net_amount >= 0),
  constraint credited_within_total check (credited_amount <= total_amount),
  constraint ils_only_phase1 check (currency = 'ILS'),        -- יוסר ב-Phase 4
  constraint doc_type_allowed_for_entity check (
    business_entity_type <> 'patur' or type not in ('tax_invoice','tax_invoice_receipt')),
  constraint patur_has_no_vat check (
    business_entity_type <> 'patur' or (vat_rate = 0 and vat_amount = 0))
);

create unique index documents_number_uk
  on documents (business_id, type, tax_year, document_number)
  where document_number is not null;                          -- ⬅ ערובת המספור

create index documents_list_idx    on documents (business_id, status, issue_date desc);
create index documents_customer_idx on documents (business_id, customer_id, issue_date desc);
create index documents_drafts_idx  on documents (business_id, updated_at desc) where status = 'draft';
create index documents_parent_idx  on documents (parent_document_id) where parent_document_id is not null;
create index documents_pdf_retry_idx on documents (business_id, pdf_attempts) where pdf_status = 'failed';
create index documents_open_idx    on documents (business_id, due_date)
  where status = 'issued' and settled_at is null;             -- aging (Phase 3)
```

**`signed_total` כעמודה מחושבת:** זיכויים נשמרים בסכומים **חיוביים** (כך ה-PDF מרונדר טבעית ו-`amounts_non_negative` נשמר), והסימן החשבונאי נגזר בשאילתה. כל דוח מסכם `signed_total` ולא `total_amount`.

**קישור FK מורכב `(parent_document_id, business_id)`:** מונע ברמת ה-DB זיכוי שמצביע על מסמך של עסק אחר. אותו דפוס עבור `customer_id`. הגנת multi-tenancy שאינה תלויה ב-RLS.

```sql
create table document_lines (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null,
  business_id       uuid not null,                     -- מפוענח ל-RLS ללא join
  line_number       int  not null,
  item_id           uuid,
  name              text not null,                     -- snapshot של שם הפריט
  description       text,                              -- snapshot של התיאור המפורט
  quantity          numeric(14,3) not null default 1,
  unit              text,
  unit_price        numeric(14,2) not null,
  discount_percent  numeric(5,2)  not null default 0,
  discount_amount   numeric(14,2) not null default 0,
  vat_treatment     vat_treatment not null default 'standard',
  line_net          numeric(14,2) not null,
  line_vat          numeric(14,2) not null default 0,
  line_total        numeric(14,2) not null,
  foreign key (document_id, business_id) references documents (id, business_id) on delete cascade,
  foreign key (item_id,     business_id) references items     (id, business_id),
  unique (document_id, line_number),
  constraint discount_pct_range check (discount_percent between 0 and 100)
);
create index document_lines_doc_idx on document_lines (business_id, document_id, line_number);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null,
  business_id    uuid not null,
  line_number    int  not null,
  method         payment_method not null,
  amount         numeric(14,2) not null,       -- שלילי בזיכוי על קבלה
  payment_date   date not null,
  -- צ'ק
  bank_name text, bank_branch text, bank_account text,
  check_number text, check_due_date date,
  -- אשראי
  card_brand text, card_last4 char(4), card_auth_number text, installments int,
  -- העברה / ביט
  reference      text,
  notes          text,
  foreign key (document_id, business_id) references documents (id, business_id) on delete cascade,
  unique (document_id, line_number),
  constraint payment_amount_nonzero check (amount <> 0),
  constraint card_last4_digits check (card_last4 is null or card_last4 ~ '^[0-9]{4}$')
);
create index payments_doc_idx on payments (business_id, document_id);
```

**אין שמירה של מספר כרטיס מלא, CVV או פרטי חשבון מעבר למינימום.** 4 ספרות אחרונות + מספר אישור מספיקים לתיעוד הקבלה ואינם PCI-scope.

**`on delete cascade`** בטוח כאן דווקא בגלל ADR-INV-002: מסמך שהופק לא ניתן למחיקה (trigger חוסם), ולכן cascade יכול לפעול רק על טיוטות.

### מונים, הקצאה, קישורים ציבוריים, audit

```sql
create table document_counters (
  business_id     uuid not null references businesses(id) on delete restrict,
  document_type   document_type not null,
  tax_year        int not null,
  number_prefix   text not null default '',
  start_number    bigint not null default 1,
  next_number     bigint not null,
  last_issued_at  timestamptz,
  created_at      timestamptz not null default now(),
  primary key (business_id, document_type, tax_year),
  constraint counter_forward check (next_number >= start_number)
);
alter table document_counters enable row level security;
create policy counters_read on document_counters for select to authenticated
  using (business_id in (select app.current_business_ids()));
-- ⚠️ אין policy כתיבה. כתיבה רק דרך public.issue_document() ו-public.set_start_number().
--    בלי FORCE — אחרת הפונקציות עצמן היו נחסמות (D3.2).

create table allocation_requests (                       -- Phase 2; הטבלה נוצרת ב-Phase 0
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete restrict,
  document_id       uuid not null,
  status            text not null default 'pending'
                      check (status in ('pending','approved','rejected','error','not_required')),
  threshold_amount  numeric(14,2),         -- הסף שהיה בתוקף ברגע הבקשה
  requested_at      timestamptz not null default now(),
  responded_at      timestamptz,
  request_payload   jsonb not null,        -- בדיוק מה שנשלח
  response_payload  jsonb,                 -- בדיוק מה שחזר
  allocation_number text,
  rejection_code    text,
  rejection_reason  text,
  http_status       int,
  attempt           int not null default 1,
  foreign key (document_id, business_id) references documents (id, business_id)
);
create index alloc_doc_idx    on allocation_requests (business_id, document_id, attempt);
create index alloc_status_idx on allocation_requests (business_id, status, requested_at desc);
-- immutable אחרי responded_at (trigger). לעולם לא נמחק — זו ראיה מול רשות המסים.

create table document_public_links (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete restrict,
  document_id    uuid not null,
  token_sha256   bytea not null,
  serves_original boolean not null default false,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz,
  revoked_at     timestamptz,
  view_count     int not null default 0,
  last_viewed_at timestamptz,
  foreign key (document_id, business_id) references documents (id, business_id)
);
create unique index dpl_token_uk on document_public_links (token_sha256);

create table audit_log (
  id           bigint generated always as identity primary key,
  business_id  uuid references businesses(id),      -- null באירועי חשבון (הרשמה, התחברות)
  occurred_at  timestamptz not null default now(),
  actor_type   actor_type not null,
  actor_id     uuid,
  actor_email  text,
  action       text not null,       -- insert|update|delete|issue|cancel|send|download|
                                    -- view_public|sign|key_create|key_revoke|business_create|
                                    -- consent_grant|consent_revoke|export|login
  table_name   text,
  record_id    uuid,
  before_data  jsonb,
  after_data   jsonb,
  request_id   text,
  ip           inet,
  user_agent   text
);
create index audit_record_idx  on audit_log (business_id, table_name, record_id, occurred_at desc);
create index audit_recent_idx  on audit_log (business_id, occurred_at desc);
create index audit_actor_idx   on audit_log (business_id, actor_id, occurred_at desc);
-- RLS: select לחברי העסק; אין policy insert/update/delete כלל.
-- כתיבה: app.audit_trigger() (DML) ו-public.log_event() (לא-DML). ולכן בלי FORCE (D3.2).
-- trigger audit_log_immutable_trg מעלה exception על כל UPDATE/DELETE, גם ל-service_role.
```

---

## Consequences

**חיובי**
- שלוש שכבות בלתי-תלויות מגנות על הבידוד: RLS policy, FK מורכב `(x_id, business_id)`, ובדיקות CI. דליפה דורשת כשל בשלושתן.
- ה-schema של Phase 3 קיים מ-Phase 0 — כשמגיעים למספר הקצאה ולניכוי במקור, אין migration על טבלה שמכילה מסמכים immutable.
- `service_role` מצומצם לשלושה נתיבים; דילוג-RLS "לגיטימי" נוסף מרוכז ב-9 פונקציות definer עם whitelist ב-CI. סקירת "מי יכול לעקוף בידוד" היא שתי רשימות סופיות.
- **חלוקת ה-schemas (D3.3) הופכת את "מה נגיש מהאינטרנט" לניתן לקריאה מהקוד:** מה שב-`public` הוא חוזה, מה שב-`app` אינו קיים כלפי חוץ. אין צורך לבדוק קונפיג של PostgREST כדי לענות.
- ה-grants ב-D3 מפורשים בשתי שכבות במקום להישען על רזולוציית-שם כהגנה מקרית *(B-3)*.
- `log_event()` (D11) עוצרת את סחף ה-definer: פיצ'ר חדש שצריך לתעד אירוע לא מוסיף פונקציה מיוחסת חדשה.
- `signed_total` הופך את הדוחות (Phase 3) לחסינים בפני טעות הסימן של הזיכויים.

**שלילי / חוב טכני**
- **הורדת `FORCE`** (A-4) פירושה שכל פונקציית definer בבעלות `postgres` מדלגת על RLS. זו התכונה שעליה הארכיטקטורה נשענת, אבל גם משטח סיכון. ה-control היחיד הוא בדיקת CI (ה) — **חובה, לא nice-to-have.**
- **`public` מכיל עכשיו גם טבלאות וגם את חוזה ה-RPC.** כל פונקציה שתתווסף ל-`public` היא endpoint פוטנציאלי; לכן `revoke execute from public, anon` הוא חלק מהגדרת הפונקציה ולא שלב נפרד. בדיקת CI (ו) אוכפת.
- `business_id` משוכפל ל-`document_lines` ו-`payments` — denormalization מכוונת (RLS ללא join).
- מגבלת 10 עסקים למשתמש היא קבוע בקוד — שינוי דורש migration.
- סטייה מ-ADR-006 (triggers-only) פירושה שאם המערכת תתמזג לתוך ה-ERP, שכבת ה-audit תצטרך יישור.
- `unique(businesses.tax_id)` יחסום sandbox של אותו עוסק — פתרון: פרויקט Supabase נפרד ל-staging.

**השפעה על מודולים אחרים**
- **ADR-INV-002** נשען על `document_counters`, על ה-snapshots ועל `documents_number_uk`. **A-4 קריטי עבורו**; **B-2 משנה את שם הפונקציה** ל-`public.issue_document()` — ה-ADR ההוא מתייחס אליה כ-`app.issue_document()` ויש לקרוא אותו עם המיפוי הזה (`app.issue_document` → `public.issue_document`, `app.set_start_number` → `public.set_start_number`; `app.seed_for` ו-`app.documents_immutable` נשארים ב-`app`).
- **ADR-INV-003** נשען על `business_signing_keys` (הטבלה היחידה עם FORCE), `documents.pdf_*`, `document_public_links`. אירועי מפתח עוברים ל-`public.log_event()`.
- **Phase 3 (מבנה אחיד BKMVDATA)** — המבנה שנבחר (שורות + תקבולים כטבלאות נפרדות, snapshot של הלקוח) הוא בדיוק מה שהמבנה האחיד מצפה לו.

---

## Reversal Conditions

- **המערכת תיפתח למשתמשים שאינם החבורה** — נדרשים rate limiting, מכסות, בידוד חזק יותר, ורישום במרשם התוכנות. בנוסף — לשקול מחדש את הורדת ה-`FORCE`: אם `postgres` ב-Supabase יאומת כבעל `BYPASSRLS` בחוזה מתועד, אפשר להחזיר FORCE גורף.
- **תתגלה דליפה בין עסקים** — בדיקת יסוד של מודל ה-policy, ומעבר ל-`app.assert_member(business_id)` מפורש בכל RPC.
- **עסק ישנה `entity_type`** בפועל (פטור→מורשה) — נדרש נוהל מפורש; `businesses_protect_identity_trg` יחסום עד שייכתב. **צפוי לקרות.**
- **יידרש מט"ח** — הסרת `ils_only_phase1` והוספת שער יציג פר מסמך.
- **`public` יתפח מעבר ל-~10 פונקציות RPC** — אז שווה לשקול schema `api` ייעודי שנחשף, עם internals ב-`app` ו-`public` לטבלאות בלבד.
- **המערכת תהפוך למודול Billing של SUPER-MESHINE** — יישור מול ADR-002 ו-ADR-006.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | למה זה לא בסמכות הארכיטקט |
|---|---|---|
| A1 | `credit_note` יחיד גם לזיכוי קבלה | פרשנות חשבונאית — **חוות דעת רו"ח** |
| A2 | מספור `continuous` בין שנות מס | פרשנות "מספור עוקב" — **חוות דעת רו"ח** |
| A3 | `unique(businesses.tax_id)` — עסק אחד לכל ח.פ במערכת | החלטה מוצרית עם השלכה תפעולית |
| A4 | סטייה מ-ADR-006: audit ב-triggers בלבד | חריגה מ-ADR מאושר של הבית |
| A5 | אחסון PII של לקוחות צד ג' | **חוק הגנת הפרטיות תיקון 13** — שאלה משפטית |
| A6 | `viewer`/`accountant` ב-enum מ-Phase 0 | משנה scope של Phase 0 |

*Amendments A ו-B לא הוסיפו החלטות הטעונות אישור — כולם תיקוני נכונות בסמכות הארכיטקט.*

---

## Implementation Notes

1. **סדר ה-migrations ב-Phase 0** — `0001_extensions` → `0002_enums` → `0003a/b_core_tables` → `0004_rls_helpers` (schema `app` + שתי פונקציות ה-policy + **ה-grants המפורשים של B-3**) → `0005_rls_policies` (כולל D3.1 ו-FORCE על `business_signing_keys` בלבד) → `0006_auth_sync` (`public.handle_new_auth_user` + trigger על `auth.users`) → `0007_audit` → `0008_immutability` → `0009_rpc_issue` (`public.issue_document`, `public.set_start_number`) → `0010_rpc_create_business` → `0011_rpc_log_event` → `0012_storage_buckets` → `0013_seed_vat_rates`. לכל migration קובץ `down` מקביל (invariant #4).
   **הערה למימוש:** `0004`-`0008` כבר נכתבו ב-B5-B8 עם הפונקציות ב-`app`. ה-migration המתקן הוא **`ALTER FUNCTION ... SET SCHEMA public`** או `drop`+`create` ב-migration חדש — לא עריכה של קובץ שכבר בוצע.

2. **בדיקות CI חוסמות merge** — שש שאילתות מטא נגד DB זמני שעליו הורצו כל ה-migrations:

   ```sql
   -- (א) טבלה ב-public ללא RLS מופעל
   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

   -- (ב) FORCE מוחל בדיוק על business_signing_keys ועל שום טבלה אחרת  [A-4]
   select c.relname, c.relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relforcerowsecurity <> (c.relname = 'business_signing_keys');

   -- (ג) scoping: כל טבלה חייבת business_id, אלא אם היא במפת החריגים  [A-2]
   with expected(relname) as (values ('businesses'), ('users'), ('vat_rates'))
   select c.relname
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   left join expected e on e.relname = c.relname
   where n.nspname = 'public' and c.relkind = 'r' and e.relname is null
     and not exists (select 1 from pg_attribute a
                     where a.attrelid = c.oid and a.attname = 'business_id'
                       and a.attnum > 0 and not a.attisdropped);

   -- (ד) טבלה עם business_id ללא audit trigger (פרט ל-business_signing_keys ו-audit_log)

   -- (ה) SECURITY DEFINER functions מול whitelist סגור — 9 פונקציות  [A-4, B-1, B-4]
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname in ('public','app')
     and p.oid::regprocedure::text not in (
       'app.current_business_ids()',
       'app.has_role(uuid,member_role[])',
       'app.audit_trigger()',
       'public.handle_new_auth_user()',
       'public.create_business(text,entity_type,text,text,text)',
       'public.issue_document(uuid,date)',
       'public.set_start_number(uuid,document_type,integer,bigint)',
       'public.send_document(uuid,text[])',
       'public.log_event(uuid,text,text,uuid,jsonb)');

   -- (ו) אף פונקציה ב-public אינה נגישה ל-anon  [B-2]
   select p.oid::regprocedure
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute');

   -- (ז) ב-app: EXECUTE ל-authenticated רק על שתי פונקציות ה-policy  [B-3]
   select p.oid::regprocedure
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.oid::regprocedure::text not in
       ('app.current_business_ids()', 'app.has_role(uuid,member_role[])');
   ```
   כל שאילתה שמחזירה שורות ⇒ build fail. הסינון `nspname = 'public'` מוציא את `supabase_migrations.schema_migrations` ממילא *(A-5)*.

3. **אימותים תפעוליים חד-פעמיים ב-B13 (לא בדיקות CI):**
   - `supabase/config.toml` § `[api] schemas` **אינו** כולל `app`. הערה בקובץ עם הפניה ל-§D3.3 *(B-2)*.
   - **`grant usage on schema app to authenticated` הזמני שנוסף ב-verification של B8 הוסר** ואינו בקוד *(B-3)*.

4. **בדיקת בידוד אמיתית ב-DoD של Phase 0:** שני משתמשים, שני עסקים, ואז assertions — SELECT/INSERT/UPDATE/DELETE של user A על כל אחת מטבלאות user B, כולל INSERT ל-`documents` עם `business_id` של B, ו-SELECT/UPDATE ישיר על `businesses` של B. כולן חייבות להיכשל. בנוסף:
   - `INSERT INTO businesses` ישיר מלקוח `authenticated` ⇒ נכשל; `DELETE FROM businesses` ⇒ נכשל *(A-1)*.
   - `create_business()` מוצלחת ⇒ שתי שורות (עסק + owner), ו-`current_business_ids()` מחזירה מיד את העסק. כשל מלאכותי אחרי ה-INSERT הראשון ⇒ אפס שורות ו-`tax_id` פנוי *(A-3)*.
   - **`supabase.rpc('issue_document', ...)` מלקוח `authenticated` מחזירה 200**, ו-`supabase.rpc('current_business_ids')` מחזירה 404 (אינה חשופה) *(B-2)*.
   - **`select * from customers` מלקוח `authenticated` עובד גם אחרי הסרת ה-`grant usage` הזמני** — הראיה ש-policies אינן תלויות ב-USAGE *(B-3)*.
   - **קריאה ישירה `select app.has_role(...)` מלקוח `authenticated` נכשלת** ב-`permission denied for schema app` — הראיה ששכבת השם עדיין חוסמת *(B-3)*.
   - `log_event()` עם `p_action='update'` ⇒ `INV_BAD_EVENT`; עם `business_id` זר ⇒ `INV_FORBIDDEN` *(B-4)*.

5. **`updated_at`** — extension `moddatetime` על `businesses`, `customers`, `items`, ועל `documents` **רק בסטטוס draft** (ה-trigger של ADR-INV-002 מטפל בשאר).

6. **Audit trigger** — `app.audit_trigger()` (definer, `search_path=''`) קוראת `auth.uid()`, `current_setting('request.jwt.claims', true)` ל-email, ו-`current_setting('app.request_id', true)`. מוחלת על כל טבלה עם `business_id` **פרט ל-`business_signing_keys` ו-`audit_log`**, וכן על `businesses`. helper `app.enforce_audit(regclass)` + בדיקת CI (ד).

7. **חישוב הכספים סמכותי ב-DB.** האפליקציה מחשבת לתצוגה חיה; `public.issue_document()` **מחשבת מחדש** את כל שדות הסכום מתוך `document_lines` ודורסת. עיגול: `round(x, 2)` half-up בכל שורה, וסכימה של שורות מעוגלות.

8. **`public.set_start_number(business_id, type, tax_year, n)`** — מעבר מ-Morning. definer, מותרת **רק** כש-`next_number = start_number` ורק ל-`owner`. כותבת audit_log.

9. **Storage RLS** — bucket `documents` פרטי, policy SELECT בלבד ל-`authenticated` לפי `(storage.foldername(name))[1]::uuid in (select app.current_business_ids())`; **ללא policy** INSERT/UPDATE/DELETE. bucket `business-assets` (לוגו): SELECT + INSERT ל-`owner` של אותו עסק.

10. **`SUPABASE_SERVICE_ROLE_KEY`** — ב-Vercel Environment Variables בלבד, מסומן Sensitive, ולא ב-Preview environments של PR-ים מפורקים.

11. **`public.create_business()` — הערות ל-builder** *(A-3)*: נקראת דרך `supabase.rpc('create_business', {...})`. ה-route קורא לה, ואז — **אחרי** שהיא החזירה בהצלחה — קורא ל-`api/keygen.py`. אין לאחד את שני השלבים (קריאת HTTP מתוך Postgres). כשל ב-keygen משאיר עסק תקין ללא יכולת הפקה — מצב מטופל, לא מצב שבור.
