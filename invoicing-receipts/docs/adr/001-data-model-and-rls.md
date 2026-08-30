# ADR-INV-001: מודל נתונים ובידוד רב-עסקי (RLS)

**Date:** 2026-08-30
**Status:** Accepted
**Amended:** 2026-08-30 — Amendment A (ראה סעיף "Amendment Log")
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
| A-3 | ביצה-ותרנגולת ביצירת עסק — `bm_manage` דורשת owner קיים | אושר: **`app.create_business()` ב-`SECURITY DEFINER`** (§D10). אין policy bootstrap ואין נתיב service_role רביעי |
| A-4 | **⚠️ פער שלא דווח:** `FORCE ROW LEVEL SECURITY` הגורף ב-§D3 **שובר את כל דפוס ה-SECURITY DEFINER של ה-ADR** | §D3 תוקן: FORCE יורד מכל הטבלאות **פרט ל-`business_signing_keys`**. בדיקת CI (ב) התהפכה |
| A-5 | (קוסמטי) D7 הניחה טבלת `_migrations` | הוסרה — Supabase CLI כותב ל-`supabase_migrations.schema_migrations`, מחוץ ל-`public` |

**הסבר ל-A-4, כי הוא משנה הנחת יסוד:** תחת `FORCE ROW LEVEL SECURITY`, גם בעלת הטבלה כפופה ל-policies. פונקציית `SECURITY DEFINER` רצה בזהות הבעלים שלה (`postgres`), שאינו חבר ב-`authenticated` — ולכן שום policy לא חלה עליו והתוצאה היא **דחייה**, לא בייפאס. שלוש תוצאות מעשיות שהיו מתגלות רק בזמן ריצה:

1. `app.current_business_ids()` הייתה מחזירה 0 שורות ← **נעילה מוחלטת של כל המערכת** (או רקורסיה ב-`bm_peers`).
2. `app.issue_document()` לא הייתה יכולה לכתוב ל-`document_counters`, שלה אין policy כתיבה **במכוון** ← אין הפקת מסמכים.
3. ה-audit trigger לא היה יכול לכתוב ל-`audit_log`, שלה אין policy INSERT **במכוון** ← כל mutation נכשלת.

תיעוד Postgres מפורש בנקודה: פונקציית security-definer מדלגת על RLS רק אם בעליה יכול — כלומר בעל התכונה `BYPASSRLS`, או בעלות על טבלה שאינה `FORCE`. הסתמכות על `BYPASSRLS` של `postgres` ב-Supabase היא הנחה על התנהגות פלטפורמה שאינה מתועדת כחוזה; לכן נבחרה הדרך הניידת — הורדת FORCE.

שאר ה-ADR נותר כפי שאושר. ההחלטות A1-A6 שנשלחו לאישור לא הושפעו.

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

**enum ולא text+CHECK:** ערכי ה-enum האלה נגזרים מהחוק ולא מהמוצר — הם לא ישתנו לפי גחמה. Postgres enum נותן טיפוס בסיס ל-FK-ים לוגיים (`document_counters.document_type`) ומייצר טעות בזמן compile ב-Drizzle/Kysely. המחיר — `ALTER TYPE ... ADD VALUE` אינו ניתן להרצה בתוך transaction בגרסאות ישנות — לא רלוונטי (PG 12+ תומך; Supabase על PG 15+).

**הרחבות מתוכננות (additive, לא breaking):**
- `document_status` יקבל `'pending_allocation'` ב-Phase 2 (ראה ADR-INV-002 §D5).
- `payment_method` עשוי לקבל `'withholding'` ב-Phase 2 (ניכוי מס במקור כרכיב תקבול).

**החלטה על `credit_note` יחיד:** אין טיפוס נפרד ל"קבלת זיכוי". `credit_note` הוא מסמך ההיפוך היחיד; **הכותרת המודפסת נגזרת ממסמך האב ומסוג הישות** — "חשבונית זיכוי" מול `tax_invoice`/`tax_invoice_receipt`, "הודעת זיכוי" מול `receipt`/`proforma_invoice` או כשהעסק פטור. סדרת מספור אחת לזיכויים בכל עסק.
*נימוק:* טיפוס שביעי היה מכפיל את מטריצת המספור, את מטריצת ההרשאות לפי סוג ישות ואת תבניות ה-PDF, בשביל הבחנה שהיא ויזואלית בלבד. **⚠️ טעון אישור רו"ח** — ראה סעיף האישורים.

### D3 — RLS: helper functions ב-`SECURITY DEFINER`; FORCE **רק** על `business_signing_keys`

```sql
-- schema נפרד ללוגיקה פנימית; לא חשוף ל-PostgREST
create schema app;
revoke all on schema app from anon, authenticated;

create or replace function app.current_business_ids()
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select business_id from public.business_members where user_id = auth.uid() $$;

create or replace function app.has_role(p_business uuid, p_roles member_role[])
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.business_members
                     where business_id = p_business and user_id = auth.uid() and role = any(p_roles)) $$;
```

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

שתי נקודות קריטיות:

1. **`SECURITY DEFINER` הוא חובה, לא אופטימיזציה.** policy על `customers` שעושה subquery ל-`business_members` היה מפעיל את ה-RLS של `business_members` ← רקורסיה אינסופית. פונקציית definer שוברת את המעגל **בתנאי שבעליה באמת מדלג על RLS** (ראה D3.2). זו התקלה מספר 1 של RLS ב-Supabase והיא נמנעת בתכנון, לא ב-debug.
2. **`stable`** מאפשר ל-planner לקרוא לפונקציה פעם אחת לכל statement במקום לכל שורה.

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

- **אין INSERT policy** — יצירת עסק עוברת אך ורק ב-`app.create_business()` (D10). זהו אותו דפוס שכבר נקבע ל-`document_counters` ול-`documents.status`: כשלכתיבה יש בדיוק נתיב לגיטימי אחד, הוא פונקציה צרה ולא policy רחבה.
- **אין DELETE policy — לעולם.** מסמכים מפנים ל-`businesses` ב-`on delete restrict`, וארכיון של 7 שנים לא מוחקים. השבתה נעשית ב-`is_active = false`.
- **`created_by`, `tax_id` ו-`entity_type` אינם ניתנים לשינוי** דרך ה-UPDATE policy: trigger `businesses_protect_identity_trg` חוסם שינוי בשלושתם. שינוי `tax_id` היה מנתק את המסמכים ההיסטוריים מהישות המשפטית שהפיקה אותם; שינוי `entity_type` הוא אירוע רגולטורי שדורש נוהל (ראה Reversal Conditions), לא עריכת טופס.

#### D3.2 — `FORCE ROW LEVEL SECURITY`: רק על `business_signing_keys` *(Amendment A-4)*

**הכלל:** כל הטבלאות מקבלות `ENABLE ROW LEVEL SECURITY` בלבד. `FORCE` מוחל על טבלה אחת בלבד — `business_signing_keys`.

**נימוק.** תחת `FORCE`, גם בעלת הטבלה כפופה ל-policies. פונקציית `SECURITY DEFINER` רצה בזהות בעליה (`postgres`), שאינו חבר ב-`authenticated`, ולכן אף policy לא חלה עליו — התוצאה היא דחייה. זה היה שובר בבת אחת את שלושת עמודי התווך של ה-ADR: את `app.current_business_ids()` (נעילה מוחלטת), את הכתיבה ל-`document_counters` (שאין לה policy כתיבה במכוון), ואת ה-audit trigger שכותב ל-`audit_log` (שאין לה policy INSERT במכוון). בייפאס דרך `BYPASSRLS` של `postgres` ב-Supabase הוא התנהגות פלטפורמה שאינה חוזה מתועד — לא בסיס לתכנון.

**`business_signing_keys` היא החריג הנכון** בדיוק משום שאף פונקציית definer אינה נוגעת בה: הקורא הלגיטימי היחיד שלה הוא `service_role`, שמדלג על RLS מתוקף התכונה `BYPASSRLS` — ותכונה זו גוברת על `FORCE`. כלומר FORCE כאן חוסם את בעלת הטבלה מבלי לחסום את הנתיב הלגיטימי. זה בדיוק מה שרוצים ממפתחות חתימה.

**מה איבדנו ומה מחליף אותו.** FORCE נועד למנוע מ-session שרץ כ-`postgres` (SQL Editor, migration) לראות נתונים חוצי-עסקים. שלושה controls מחליפים אותו:
1. האפליקציה **לעולם** אינה מתחברת כ-`postgres` — קיימים בה רק `anon`, `authenticated` ו-`service_role`.
2. `service_role` דילג על FORCE ממילא (BYPASSRLS), כך ש-FORCE מעולם לא הגן מפני נתיב האיום הריאלי.
3. **בדיקת CI (ה) חדשה:** רשימת ה-`SECURITY DEFINER` functions ב-DB נבדקת מול whitelist סגור. פונקציית definer חדשה שלא ב-ADR = build fail. זה ה-control האמיתי, כי דילוג-בעלים הוא בדיוק מה שהפונקציות האלה עושות.

**Whitelist של `SECURITY DEFINER` functions (סגור):** `app.current_business_ids`, `app.has_role`, `app.create_business`, `app.issue_document`, `app.set_start_number`, `app.send_document`, `app.audit_trigger`. כל תוספת מחייבת עדכון ADR.

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

`service_role` עוקף RLS לחלוטין. לכן הרשימה סגורה ומנומקת:

| נתיב | למה חייב service_role | למה זה בטוח |
|---|---|---|
| **צינור החתימה** (`api/sign.py`) | `business_signing_keys` היא טבלה **ללא policies כלל ועם FORCE** — אין דרך אחרת לקרוא אותה | רץ server-only; מקבל `document_id` בלבד + טוקן HMAC פנימי קצר-מועד; מאמת בעצמו `status='issued'`; לא מחזיר חומר מפתח לעולם |
| **עמוד צפייה ציבורי** (`/d/[token]`) | הצופה אנונימי — אין `auth.uid()` | שאילתה **רק** לפי `sha256(token)`; תגובה מסוננת ל-whitelist שדות קבוע; קישור בר-ביטול; rate-limit |
| **גיבוי/ייצוא לילי** | חוצה-עסקים בהגדרה | read-only; רץ ב-GitHub Actions; פלט מוצפן |

**כלל אכיפה:** כל קריאה עם `service_role` חייבת לשבת תחת `src/server/service-role/`. ESLint rule (`no-restricted-imports`) חוסם import של המודול הזה מכל מקום אחר. `SUPABASE_SERVICE_ROLE_KEY` לעולם לא בקידומת `NEXT_PUBLIC_`.

**מה **לא** עובר ב-service_role, בניגוד לאינטואיציה:**
- **יצירת עסק** — `app.create_business()` (D10).
- **המונים והפקת מסמך** — `app.issue_document()` (ADR-INV-002).
- **audit_log** — `app.audit_trigger()`.
- **שליחת מייל** — רצה עם ה-JWT של המשתמש.

פונקציית definer עדיפה על service_role בכל אחד מהמקרים האלה: היא מוגבלת לפעולה אחת מוגדרת, מאמתת חברות בעצמה, ו-`auth.uid()` ממשיך להחזיר את המשתמש האמיתי בתוכה (הוא נקרא מ-GUC של ה-JWT, לא מ-`current_user`) — כך שה-audit נשאר מדויק.

### D6 — Audit log ב-triggers בלבד (סטייה מודעת מ-ADR-006)

ADR-006 בחר app-layer middleware + triggers כ-defense-in-depth. כאן: **triggers בלבד**.

*נימוק:* ב-ERP ה-middleware נדרש כדי לתפוס context שרק האפליקציה מכירה (`on_behalf_of_user_id`, `policy_id` של סוכן AI). כאן אין סוכנים, אין פעולות מטעם, ואין ORM מחייב — לקוח Supabase רגיל עוקף כל middleware של ORM. Trigger ב-DB תופס **כל** נתיב כתיבה כולל SQL Editor ידני ו-service_role. זו הפחתה של שכבה ושל סיכון בו-זמנית.

אירועים שאינם DML (שליחה, הורדה, צפייה ציבורית, ייצוא, הפקת/ביטול מפתח, יצירת עסק) נכתבים ב-INSERT מפורש מהשרת עם `action` ייעודי.

**⚠️ טעון אישור CEO** — סטייה מ-ADR-006.

### D7 — מפת scoping: לכל טבלה ב-`public` יש עמודת scope מוצהרת *(Amendment A-2, A-5)*

הניסוח הקודם ("רשימה סגורה של טבלאות ללא `business_id`") היה שגוי: הוא התייחס ל-`businesses` כאל חריג גלובלי, בעוד שהיא **הטבלה המבודדת ביותר במערכת** — פשוט לפי `id` ולא לפי `business_id`. הניסוח המתוקן הוא **מפה**, לא רשימה:

| קטגוריה | טבלאות | עמודת scoping | RLS |
|---|---|---|---|
| **1. Business-scoped** (ברירת מחדל) | `customers`, `items`, `documents`, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `customer_document_consents`, `business_signing_keys`, `audit_log`, `business_members` | `business_id` | חובה |
| **2. Scope-root** | `businesses` | `id` | חובה (D3.1) |
| **3. Self-scoped** | `users` | `id = auth.uid()` | חובה |
| **4. Reference data גלובלי** | `vat_rates` | — | ENABLE + policy SELECT לכולם, ללא policy כתיבה |

**כל טבלה ב-`public` חייבת להשתייך לאחת מארבע הקטגוריות.** קטגוריות 2-4 הן רשימה סגורה; הוספה אליהן מחייבת עדכון ADR.

`_migrations` **הוסרה** מהמסמך: Supabase CLI מנהל היסטוריית migrations ב-`supabase_migrations.schema_migrations`, כלומר ב-schema נפרד שאינו `public` — סינון ה-`nspname = 'public'` בבדיקת ה-CI מוציא אותו ממילא. (אותו דבר נכון ל-`drizzle.__drizzle_migrations` אם ייבחר Drizzle.) אין צורך בחריג.

### D8 — אכיפת "אילו מסמכים מותרים לפי סוג ישות": **CHECK constraint על snapshot בשורת המסמך**

זו השאלה החדה ביותר ב-ADR הזה. ההחלטה:

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

העמודה מאוכלסת ב-`BEFORE INSERT` trigger מתוך `businesses`, ומאוכלסת **מחדש** במעבר `draft → issued` (מסמך נוצר משפטית ברגע ההפקה, לא ברגע פתיחת הטיוטה).

**למה CHECK על snapshot ולא כל חלופה אחרת:**

| חלופה | למה נדחתה |
|---|---|
| אכיפה באפליקציה (zod) בלבד | נעקפת ע"י service_role, ע"י SQL ידני, וע"י כל באג בנתיב חדש. מסמך לא-חוקי שהופק = אירוע מס. |
| Trigger שעושה `SELECT entity_type FROM businesses` | ניתן להשבתה ב-`ALTER TABLE ... DISABLE TRIGGER` (ולו בטעות במהלך תחזוקה); ומסתמך על **המצב הנוכחי** של `businesses` — עוסק פטור שהופך למורשה היה מחליק אחורה על המסמכים ההיסטוריים בכל בדיקה עתידית. |
| Composite FK `(business_id, entity_type) → businesses(id, entity_type)` | אלגנטי אך מקבע: העסק לא יוכל **לעולם** לשנות `entity_type` כשקיימים מסמכים (RESTRICT) או יגרור עדכון היסטוריה (CASCADE). שניהם שגויים. |

ה-snapshot פותר את שלושתם: הוא declarative, לא ניתן להשבתה סלקטיבית, והוא הופך את ההיסטוריה ל**מתארת את עצמה** — מסמך משנת 2026 יודע שהוא הופק ע"י עוסק פטור גם אחרי שהעסק עבר למורשה ב-2028.

**שלוש שכבות, סדר עדיפות ברור:** CHECK ב-DB (סמכותי) ← `app.issue_document()` מאמתת שוב עם הודעת שגיאה בעברית ← ה-UI לא מציג טיפוס אסור. השכבות 2-3 הן UX; שכבה 1 היא הביטחון.

**מטריצת ההיתרים המלאה:**

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

*נימוק לברירת המחדל:* רציפות גורפת היא הפרשנות השמרנית של "מספור עוקב" בהוראות ניהול ספרים; איפוס שנתי מייצר שני מסמכים שונים עם אותו מספר. **⚠️ טעון אישור רו"ח.**

### D10 — Bootstrap של עסק: `app.create_business()` ב-`SECURITY DEFINER` *(Amendment A-3)*

הצעת ה-EM מאושרת. הפונקציה היא **נתיב הכתיבה היחיד** ל-`businesses`, ו-`INSERT` ל-`business_members` בשורת ה-owner הראשונה מתבצע בתוכה.

```sql
create or replace function app.create_business(
  p_legal_name  text,
  p_entity_type entity_type,
  p_tax_id      text,
  p_tax_id_type text default 'vat',
  p_display_name text default null
) returns businesses
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_row businesses; v_count int;
begin
  if v_uid is null then raise exception 'INV_UNAUTHENTICATED'; end if;
  if not exists (select 1 from users where id = v_uid) then
    raise exception 'INV_NO_PROFILE';                     -- פרופיל נוצר ב-trigger על auth.users
  end if;

  select count(*) into v_count from businesses where created_by = v_uid;
  if v_count >= 10 then raise exception 'INV_BUSINESS_LIMIT'; end if;   -- ראה נימוק להלן

  if p_tax_id !~ '^[0-9]{9}$' then raise exception 'INV_BAD_TAX_ID'; end if;

  begin
    insert into businesses (legal_name, display_name, entity_type, tax_id, tax_id_type, created_by)
    values (p_legal_name, coalesce(p_display_name, p_legal_name),
            p_entity_type, p_tax_id, p_tax_id_type, v_uid)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'INV_TAX_ID_EXISTS';                  -- מיפוי ידידותי ל-unique(tax_id)
  end;

  insert into business_members (business_id, user_id, role)
  values (v_row.id, v_uid, 'owner');

  insert into audit_log (business_id, actor_type, actor_id, action, table_name, record_id, after_data)
  values (v_row.id, 'user', v_uid, 'business_create', 'businesses', v_row.id, to_jsonb(v_row));

  return v_row;
end $$;

revoke execute on function app.create_business from public, anon;
grant  execute on function app.create_business to authenticated;
```

**למה RPC ולא policy:**

| חלופה | למה נדחתה |
|---|---|
| policy `INSERT` על `business_members` בנוסח "החבר הראשון רשאי להוסיף את עצמו" | (א) הזרימה נשברת לשתי קריאות REST נפרדות ללא transaction. כשל בשנייה משאיר **עסק יתום ללא חברים** — בלתי-נראה ל-RLS, בלתי-ניתן לשחזור, ו**שורף את ה-`tax_id` לצמיתות** דרך `unique(tax_id)`. זה השיקול המכריע. (ב) ה-`not exists` שדרוש כדי לחסום self-grant חוזר מפעיל את ה-RLS של `business_members` מתוך policy על אותה טבלה ← רקורסיה. |
| trigger `AFTER INSERT ON businesses` שיוצר את שורת ה-owner | אטומי, אבל ה-trigger רץ בזהות הקורא ולכן חסום ע"י `bm_manage`; הפיכתו ל-`SECURITY DEFINER` מייצרת דילוג-RLS **סמוי** שנורה בכל INSERT מכל נתיב עתידי. גם לא יכול להחזיר שגיאות ממופות. |
| endpoint ב-`service_role` | היה מוסיף נתיב service_role רביעי ושובר את הרשימה הסגורה של D5 — בשביל משהו שפונקציית definer צרה עושה טוב יותר. |

**מגבלת 10 עסקים למשתמש:** בהיעדר INSERT policy אין בודק חיצוני, ומשתמש מאומת יכול לקרוא ל-RPC בלולאה. המגבלה היא בלם abuse, לא כלל עסקי; היא מוגדרת כקבוע בקוד הפונקציה וניתנת לשינוי במיגרציה.

**סדר ההקמה המלא** (המשך ב-ADR-INV-003 §D4): `create_business()` מסתיימת בעסק **ללא מפתח חתימה**. ה-route באפליקציה קורא מיד ל-`api/keygen.py`. עד שהמפתח נוצר, `app.issue_document()` מעלה `INV_NO_SIGNING_KEY` וה-UI מציג באנר עם כפתור "נסה שוב". לא מוסיפים עמודת סטטוס לעסק — קיום שורה פעילה ב-`business_signing_keys` הוא מקור האמת היחיד.

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
-- השורה נוצרת ב-trigger על auth.users (דפוס Supabase סטנדרטי) — לא ע"י הלקוח.

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

**`unique(tax_id)` הוא בקרה, לא נוחות:** שתי שורות `businesses` לאותה ישות משפטית = שתי סדרות מספור מקבילות לאותו עוסק = הפרה של המספור הרציף. האינדקס הופך את התקלה לבלתי-אפשרית. ה-`unique_violation` ממופה ב-`create_business()` ל-`INV_TAX_ID_EXISTS`.

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
--    אירועי מפתח נרשמים ל-audit_log ידנית עם metadata בלבד.
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

**ההסכמה היא חלק ממערכת החשבונות** (חוזר מ"ה 24/2004): לכן `consent_text` נשמר כ-snapshot ולא כהפניה לנוסח נוכחי, ולכן השורה immutable פרט ל-`revoked_at`/`revoke_reason`. **כלל אכיפה:** שליחת "מקור" ממוחשב במייל אסורה ללא הסכמה פעילה — נבדק ב-`app.send_document()`; ללא הסכמה, `documents.delivery_mode = 'print'` ו-ה-UI מציע הדפסה.

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

**`signed_total` כעמודה מחושבת:** זיכויים נשמרים בסכומים **חיוביים** (כך ה-PDF מרונדר טבעית ו-`amounts_non_negative` נשמר), והסימן החשבונאי נגזר בשאילתה. כל דוח הכנסות/מע"מ מסכם `signed_total` ולא `total_amount`. זה מונע את הטעות הקלאסית שבה זיכוי מנפח את ההכנסות.

**קישור FK מורכב `(parent_document_id, business_id)`:** מונע ברמת ה-DB זיכוי שמצביע על מסמך של עסק אחר. אותו דפוס עבור `customer_id`. זו הגנת multi-tenancy נוספת שאינה תלויה ב-RLS.

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

**אין שמירה של מספר כרטיס מלא, CVV או פרטי חשבון מעבר למינימום.** ב-4 ספרות אחרונות + מספר אישור די לתיעוד הקבלה, והן אינן PCI-scope.

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
-- ⚠️ אין policy כתיבה. כתיבה רק דרך app.issue_document() ו-app.set_start_number().
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
-- הכתיבה נעשית ע"י app.audit_trigger() (SECURITY DEFINER) — ולכן בלי FORCE (D3.2).
-- trigger audit_log_immutable_trg מעלה exception על כל UPDATE/DELETE, גם ל-service_role.
```

---

## Consequences

**חיובי**
- שלוש שכבות בלתי-תלויות מגנות על הבידוד: RLS policy, FK מורכב `(x_id, business_id)`, ובדיקות CI. דליפה דורשת כשל בשלושתן.
- ה-schema של Phase 3 קיים מ-Phase 0 — כשמגיעים למספר הקצאה ולניכוי במקור, אין migration על טבלה שמכילה מסמכים immutable.
- `service_role` מצומצם לשלושה נתיבים הניתנים לספירה ולאכיפה ב-lint; דילוג-RLS "לגיטימי" נוסף מרוכז ב-7 פונקציות definer עם whitelist ב-CI. סקירת "מי יכול לעקוף בידוד" היא שתי רשימות סופיות.
- הפרדת סוגי המסמכים לפי ישות היא declarative ב-schema: הקורא את `documents.sql` רואה את הכלל הרגולטורי.
- `signed_total` הופך את הדוחות (Phase 3) לחסינים בפני טעות הסימן של הזיכויים.
- כל נתיבי הכתיבה ה"מיוחדים" (יצירת עסק, הפקה, מונים, audit) חולקים דפוס אחד — פונקציית definer צרה עם `revoke ... from public`. אין שני דפוסים מתחרים.

**שלילי / חוב טכני**
- **הורדת `FORCE`** (Amendment A-4) פירושה שכל פונקציית `SECURITY DEFINER` בבעלות `postgres` מדלגת על RLS. זו התכונה שעליה הארכיטקטורה נשענת, אבל היא גם משטח סיכון: פונקציה עתידית שתיכתב בהיסח הדעת תראה הכול. ה-control היחיד הוא בדיקת CI (ה) — **היא חובה, לא nice-to-have.**
- `business_id` משוכפל ל-`document_lines` ו-`payments` — denormalization מכוונת (RLS ללא join). ה-FK המורכב מונע חוסר-עקביות, אך יש עמודה "מיותרת" בשתי טבלאות.
- שני snapshot-ים jsonb פר מסמך — עלות אחסון זניחה בנפח הזה, אבל השאילתות עליהם לא-מאונדקסות (אין צורך: תמיד ניגשים דרך `document_id`).
- מגבלת 10 עסקים למשתמש היא קבוע בקוד — שינוי דורש migration. מקובל בסדר הגודל הזה.
- סטייה מ-ADR-006 (triggers-only) פירושה שאם המערכת תתמזג לתוך ה-ERP, שכבת ה-audit תצטרך יישור.
- `unique(businesses.tax_id)` יחסום תרחיש שאולי לגיטימי (בדיקה/sandbox של אותו עוסק) — פתרון: פרויקט Supabase נפרד ל-staging, לא רכות ב-constraint.

**השפעה על מודולים אחרים**
- **ADR-INV-002** נשען על `document_counters`, על ה-snapshots ועל `documents_number_uk`. **Amendment A-4 קריטי עבורו** — בלעדיו `issue_document()` לא הייתה יכולה לכתוב למונים כלל.
- **ADR-INV-003** נשען על `business_signing_keys` (הטבלה היחידה עם FORCE), `documents.pdf_*`, `document_public_links`.
- **Phase 3 (מבנה אחיד BKMVDATA)** ידרוש מיפוי של `documents`/`document_lines`/`payments` לרשומות B100/C100/D110/D120 — המבנה שנבחר (שורות + תקבולים כטבלאות נפרדות, snapshot של הלקוח) הוא בדיוק מה שהמבנה האחיד מצפה לו.

---

## Reversal Conditions

נחזור ל-ADR הזה אם:
- **המערכת תיפתח למשתמשים שאינם החבורה** — אז נדרשים: rate limiting, מכסות, בידוד חזק יותר (schema-per-business או פרויקט Supabase נפרד ללקוחות גדולים), ורישום במרשם התוכנות. בנוסף — יש לשקול מחדש את הורדת ה-`FORCE`, ואם `postgres` ב-Supabase יאומת כבעל `BYPASSRLS` בחוזה מתועד, להחזיר FORCE גורף.
- **תתגלה דליפה בין עסקים** — בדיקת יסוד של מודל ה-policy, ומעבר ל-`app.assert_member(business_id)` מפורש בכל RPC.
- **עסק ישנה `entity_type`** בפועל (פטור→מורשה) — נדרש נוהל מפורש: המסמכים ההיסטוריים נשמרים כפי שהם (ה-snapshot מבטיח זאת), אך יש להכריע אם המונים ממשיכים או מתחילים סדרה חדשה. ה-trigger `businesses_protect_identity_trg` יחסום את השינוי עד שייכתב הנוהל. **צפוי לקרות** — המייסד עשוי לחצות את תקרת הפטור.
- **יידרש מט"ח** — הסרת `ils_only_phase1` והוספת שער יציג פר מסמך; המבנה כבר תומך.
- **המערכת תהפוך למודול Billing של SUPER-MESHINE** — יישור מול ADR-002 (`tenant_id`) ו-ADR-006 (audit middleware); ה-many-to-many של `business_members` לא קיים ב-ADR-002 ויחייב עדכון שלו.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | למה זה לא בסמכות הארכיטקט |
|---|---|---|
| A1 | `credit_note` יחיד גם לזיכוי קבלה (במקום "קבלת זיכוי" נפרדת) | פרשנות חשבונאית — **חוות דעת רו"ח** |
| A2 | מספור `continuous` בין שנות מס (ולא איפוס שנתי) | פרשנות "מספור עוקב" — **חוות דעת רו"ח** |
| A3 | `unique(businesses.tax_id)` — עסק אחד לכל ח.פ במערכת | החלטה מוצרית עם השלכה תפעולית |
| A4 | סטייה מ-ADR-006: audit ב-triggers בלבד, ללא app middleware | חריגה מ-ADR מאושר של הבית |
| A5 | אחסון PII של לקוחות צד ג' (שם, ת.ז/ע.מ, כתובת) של עסקים שאינם של המייסד | **חוק הגנת הפרטיות תיקון 13** (בתוקף מ-2025) — חובות מנהל מאגר. שאלה משפטית, לא ארכיטקטונית |
| A6 | `viewer`/`accountant` נכנסים ל-enum מ-Phase 0 אף שהמסכים ב-Phase 3 | קטן, אך משנה scope של Phase 0 |

*Amendment A לא הוסיף החלטות הטעונות אישור — כל ארבעת התיקונים הם תיקוני נכונות בתוך סמכות הארכיטקט.*

---

## Implementation Notes

1. **סדר ה-migrations ב-Phase 0** — `0001_extensions` (`pgcrypto`, `citext`) → `0002_enums` → `0003_core_tables` → `0004_rls_helpers` (schema `app` + definer functions) → `0005_rls_policies` (כולל D3.1 ו-FORCE על `business_signing_keys` בלבד) → `0006_audit` (trigger function + החלה על כל טבלה) → `0007_immutability` (ADR-INV-002) → `0008_issue_function` (ADR-INV-002) → **`0009_create_business`** (D10) → `0010_storage_buckets` (ADR-INV-003) → `0011_seed_vat_rates`. לכל migration קובץ `down` מקביל (invariant #4).

2. **בדיקות CI חוסמות merge** — חמש שאילתות מטא נגד DB זמני שעליו הורצו כל ה-migrations:

   ```sql
   -- (א) טבלה ב-public ללא RLS מופעל
   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

   -- (ב) FORCE מוחל בדיוק על business_signing_keys ועל שום טבלה אחרת  [Amendment A-4]
   select c.relname, c.relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relforcerowsecurity <> (c.relname = 'business_signing_keys');

   -- (ג) scoping: כל טבלה חייבת business_id, אלא אם היא במפת החריגים  [Amendment A-2]
   with expected(relname, scoping_column) as (values
     ('businesses','id'),      -- scope-root
     ('users','id'),           -- self-scoped
     ('vat_rates',null)        -- reference data גלובלי
   )
   select c.relname
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   left join expected e on e.relname = c.relname
   where n.nspname = 'public' and c.relkind = 'r' and e.relname is null
     and not exists (select 1 from pg_attribute a
                     where a.attrelid = c.oid and a.attname = 'business_id'
                       and a.attnum > 0 and not a.attisdropped);

   -- (ד) טבלה עם business_id ללא audit trigger (פרט ל-business_signing_keys ו-audit_log)

   -- (ה) SECURITY DEFINER functions מול whitelist סגור  [Amendment A-4]
   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname in ('public','app')
     and p.oid::regprocedure::text not in (
       'app.current_business_ids()',
       'app.has_role(uuid,member_role[])',
       'app.create_business(text,entity_type,text,text,text)',
       'app.issue_document(uuid,date)',
       'app.set_start_number(uuid,document_type,integer,bigint)',
       'app.send_document(uuid,text[])',
       'app.audit_trigger()');
   ```
   כל שאילתה שמחזירה שורות ⇒ build fail. שים לב ש-(א)-(ה) מסננות `nspname = 'public'` ולכן `supabase_migrations.schema_migrations` אינה נכללת — אין צורך בחריג עבורה *(Amendment A-5)*.

3. **בדיקת בידוד אמיתית ב-DoD של Phase 0** (לא רק "RLS מופעל"): שני משתמשים, שני עסקים, ואז assertions — SELECT/INSERT/UPDATE/DELETE של user A על כל אחת מטבלאות user B, כולל ניסיון INSERT ל-`documents` עם `business_id` של B, וכולל **ניסיון `SELECT`/`UPDATE` ישיר על `businesses` של B**. כולן חייבות להיכשל. בנוסף שלוש בדיקות חדשות *(Amendment A)*:
   - `INSERT INTO businesses` ישיר מלקוח `authenticated` ⇒ נכשל (אין policy).
   - `DELETE FROM businesses` ⇒ נכשל.
   - `app.create_business()` מוצלחת ⇒ נוצרו **שתי** שורות (עסק + owner) ו-`current_business_ids()` מחזירה מיד את העסק החדש. כשל מלאכותי אחרי ה-INSERT הראשון ⇒ **אפס** שורות נותרו ו-ה-`tax_id` פנוי לניסיון חוזר.

4. **`updated_at`** — extension `moddatetime` על טבלאות עריכות (`businesses`, `customers`, `items`) ועל `documents` **רק בסטטוס draft** (ה-trigger של ADR-INV-002 מטפל בשאר).

5. **Audit trigger** — פונקציה אחת `app.audit_trigger()` (`SECURITY DEFINER`) שקוראת `auth.uid()`, `current_setting('request.jwt.claims', true)` ל-email, ו-`current_setting('app.request_id', true)`. מוחלת על כל טבלה עם `business_id` **פרט ל-`business_signing_keys` ו-`audit_log`**, וכן על `businesses` (scope-root). helper `app.enforce_audit(regclass)` + בדיקת CI (ד).

6. **חישוב הכספים סמכותי ב-DB.** האפליקציה מחשבת לתצוגה חיה; `app.issue_document()` **מחשבת מחדש** את כל שדות הסכום מתוך `document_lines` ודורסת. לקוח לא יכול להפיק מסמך עם סכומים שגויים גם אם ישלח אותם. עיגול: `round(x, 2)` half-up בכל שלב שורה, וסכימה של שורות מעוגלות (לא עיגול של סכום) — כדי שהמסמך המודפס יסתכם בדיוק.

7. **`app.set_start_number(business_id, type, tax_year, n)`** — מאפשר להתחיל ממספר קיים במעבר מ-Morning. `SECURITY DEFINER`, מותרת **רק** כש-`next_number = start_number` (טרם הופק מסמך בסדרה) ורק ל-`owner`. כותבת audit_log.

8. **Storage RLS** — ב-`0010`: bucket `documents` פרטי, policy SELECT בלבד ל-`authenticated` לפי `(storage.foldername(name))[1]::uuid in (select app.current_business_ids())`; **ללא policy** INSERT/UPDATE/DELETE — העלאה רק ב-service_role מצינור ההפקה. bucket `business-assets` (לוגו): SELECT + INSERT ל-`owner` של אותו עסק.

9. **`SUPABASE_SERVICE_ROLE_KEY`** — ב-Vercel Environment Variables בלבד, מסומן Sensitive, ולא ב-Preview environments של PR-ים מפורקים. סיבוב מיידי אם דלף.

10. **`app.create_business()` — הערות ל-builder** *(Amendment A-3)*: הפונקציה מוחזרת ללקוח דרך `supabase.rpc('create_business', {...})`. ה-route ב-Next.js קורא לה, ואז — **אחרי** שהיא החזירה בהצלחה — קורא ל-`api/keygen.py`. אין לאחד את שני השלבים לפונקציה אחת (קריאת HTTP מתוך Postgres). כשל ב-keygen משאיר עסק תקין ללא יכולת הפקה — מצב מטופל, לא מצב שבור.
