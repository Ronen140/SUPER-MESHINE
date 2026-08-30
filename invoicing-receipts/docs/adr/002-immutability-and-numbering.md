# ADR-INV-002: אי-שינוי מסמכים ומספור רציף

**Date:** 2026-08-30
**Status:** Accepted
**Amended:** 2026-08-30 — Amendment A (ראה סעיף "Amendment Log")
**Decider:** Architect (proposed), CEO (final approval)
**Related:** ADR-INV-001 (schema, RLS), ADR-INV-003 (PDF וחתימה)

---

## Amendment Log

### Amendment A — 2026-08-30 (ממצאי QA על B5-B8; חוסם acceptance של Batch 2)

שני reviewers בלתי-תלויים התכנסו לאותו פגם — erp-domain-expert (🔴) ו-code-quality (⚠️). דוחות: `vault/Reviews/domain/2026-08-30-invoicing-phase0-batch2.md`, `vault/Reviews/quality/2026-08-30-invoicing-phase0-batch2.md`.

| # | הממצא | התיקון |
|---|---|---|
| **A-1** | 🔴 **`issue_document()` מקפיאה את סכומי הכותרת אך לא את ערכי השורות.** `document_lines.line_net/line_vat/line_total/discount_amount` הן עמודות רגילות, ללא CHECK שקושר אותן ל-`quantity`×`unit_price`×הנחה, וניתנות לכתיבה חופשית ע"י `editor`/`owner` תחת ה-policy הגנרית. מאחר ש-ADR-INV-003 מרנדר את ה-PDF מ-`documents` + `document_lines`, **מסמך שהופק יכול להציג פירוט שורות שאינו מסתכם לסכום הכותרת** | **§D8 חדש** — שלוש שכבות: trigger מחשב על `document_lines`, חישוב חוזר ב-`issue_document()`, ו-CHECK של עקביות פנימית. §D2 קיבל שלב 6א |
| **A-2** | זיכוי יכול להצביע על אב מסוג `price_quote`/`proforma_invoice` — מסמכים שאינם מייצרים אירוע הכנסה/מע"מ, ולכן אין מה להפוך | **§D6** — `parent.type` חייב להיות ב-`{receipt, tax_invoice, tax_invoice_receipt}`. קוד שגיאה `INV_CREDIT_PARENT_TYPE`. **⚠️ טעון אישור רו"ח (B5)** |
| **A-3** | `documents.updated_at` קפוא — אין עליו trigger, בניגוד ל-ADR-INV-001 §Implementation Notes #4. `documents_drafts_idx` ממיין לפי `updated_at desc` ⇒ **רשימת הטיוטות ממוינת שגוי** | trigger `set_updated_at` על `documents` ל**כל** UPDATE (לא "רק בטיוטה"). **מתקן את הניסוח ב-ADR-INV-001 §Implementation Notes #4** |
| **A-4** | (עקבי) שמות הפונקציות `app.issue_document`/`app.set_start_number` עודכנו ל-`public.*` בכל ה-ADR | לפי ADR-INV-001 Amendment B-2 |

**למה A-1 הוא הפגם החמור ביותר שנמצא עד כה בפרויקט.** ADR-INV-002 קבע נכון ש"החישוב סמכותי ב-DB" — אבל יישם את העיקרון על שורת ה-header בלבד. השורות, שהן **מה שהלקוח ורואה החשבון קוראים בפועל**, נשארו ככל שהלקוח שלח. מסמך כזה עומד בכל ה-constraints שכתבתי, נחתם דיגיטלית, ונשלח — ועדיין "לא מסתכם". זו לא בעיית תצוגה: מסמך שהפירוט בו אינו מסתכם לסכום הוא מסמך פגום לצורכי ניהול ספרים, והוא immutable, כלומר התיקון היחיד הוא זיכוי. הפגם היה מתגלה אצל הרו"ח, לא ב-CI.

*Amendment A הוסיף החלטה אחת הטעונה אישור רו"ח (B5, סוגי אב מותרים לזיכוי). שאר התיקונים בסמכות הארכיטקט.*

---

## Context

הוראות ניהול ספרים קובעות שלושה כללים שאינם ניתנים למשא ומתן מוצרי:

1. **מספור עוקב** לכל סוג מסמך — ללא חורים, ללא שימוש חוזר במספר.
2. **מסמך שהופק אינו נערך ואינו נמחק.** תיקון = מסמך נגדי מקושר בלבד.
3. **המסמך משקף את המצב ברגע ההפקה** — שינוי מאוחר בכרטיס הלקוח או במחיר הפריט אינו רשאי לשנות מסמך היסטורי.

ה-ADR הזה קובע איך שלושת הכללים נאכפים ברמה שלא ניתנת לעקיפה — לא ע"י באג באפליקציה, לא ע"י `service_role`, ולא ע"י SQL Editor של Supabase. הרציונל: מסמך שגוי שהופק הוא אירוע מס עם חשיפה כספית ופלילית, לא באג שמתקנים בסבב הבא.

אילוץ טכני מכריע: **הפקת ה-PDF איטית** (Chromium cold start ~3-5 שניות, ADR-INV-003) בעוד שהקצאת המספר חייבת להיות אטומית ומהירה. אסור להחזיק transaction פתוח על שורת המונה בזמן שרץ דפדפן.

---

## Decision

### D1 — המספר מוקצה מטבלת מונים ב-`UPDATE ... RETURNING`, לא מ-Postgres `SEQUENCE`

```sql
-- בתוך public.issue_document(), ב-transaction אחד:
insert into document_counters (business_id, document_type, tax_year, next_number, start_number)
values (p_business, p_type, p_year, app.seed_for(p_business, p_type, p_year),
                                    app.seed_for(p_business, p_type, p_year))
on conflict (business_id, document_type, tax_year) do nothing;

update document_counters
   set next_number = next_number + 1,
       last_issued_at = now()
 where business_id = p_business and document_type = p_type and tax_year = p_year
returning next_number - 1 into v_number;      -- ⬅ נועל את השורה עד סוף ה-transaction
```

**למה לא `SEQUENCE`:** רצפים ב-Postgres הם non-transactional במכוון — `nextval` לא חוזר אחורה ב-`ROLLBACK`. כל כשל אחרי שליפת המספר (validation, כשל רשת, deadlock) היה מייצר **חור במספור** — הפרה ישירה של הדרישה החוקית. שורת מונה בטבלה רגילה נעולה ומגולגלת אחורה יחד עם ה-transaction. הסריאליזציה שזה כופה (עסק+סוג+שנה) היא בדיוק ההתנהגות הרצויה, והמחיר שלה ב-~2 מסמכים/חודש הוא אפס.

**למה `UPDATE ... RETURNING` ולא `SELECT ... FOR UPDATE` ואז `UPDATE`:** משפט אחד, נעילה אטומית, אין חלון בין קריאה לכתיבה.

**`app.seed_for()`** מיישם את D9 של ADR-INV-001: במצב `continuous` מחזיר את `next_number` של השנה הקודמת (או 1); במצב `yearly` מחזיר את `start_number` המוגדר לעסק.

**ערובת ה-DB:** `unique index documents_number_uk on documents (business_id, type, tax_year, document_number)`. גם אם המונה ייכשל, שני מסמכים לא יוכלו לשאת אותו מספר.

### D2 — ההפקה היא פונקציה אחת ב-`SECURITY DEFINER`; אין נתיב שני

```sql
create or replace function public.issue_document(p_document_id uuid, p_issue_date date default null)
returns public.documents
language plpgsql security definer set search_path = ''
as $$ ... $$;
```

הרצף בתוך ה-transaction, לפי הסדר:

1. `select ... from documents where id = p_document_id for update` — נעילת המסמך.
2. **אימות חברות והרשאה:** `app.has_role(business_id, {'owner','editor'})`. הפונקציה היא definer ולכן RLS לא מגן עליה — האימות מפורש וחובה.
3. **אימות מצב:** `status = 'draft'`, אחרת `INV_ALREADY_ISSUED`.
4. **רענון `business_entity_type`** מתוך `businesses` (המסמך נולד משפטית עכשיו).
5. **אימותי תוכן:** יש לפחות שורה אחת; יש `customer_id`; טיפוס מותר לסוג הישות; פטור ⇒ מע"מ 0; `credit_note` ⇒ יש `parent_document_id` + `credit_reason` + האב `issued` + האב באותו עסק + **סוג האב מותר (D6)** + `parent.credited_amount + total ≤ parent.total_amount`; מסמכי תקבול ⇒ `sum(payments.amount) = payable_amount`.
6. **קביעת שיעור המע"מ** מ-`vat_rates` לפי `issue_date` (או 0 אם העסק פטור).
   **6א. חישוב מחדש ודריסה של כל שורות המסמך** — `app.compute_line()` על כל שורה ב-`document_lines`, עם שיעור המע"מ משלב 6. **זה השלב שנוסף ב-Amendment A-1** (§D8).
7. **חישוב מחדש של סכומי ה-header** מתוך השורות **שזה עתה חושבו מחדש** (לא מהערכים שהלקוח שלח).
8. **קיבוע snapshots:** `customer_snapshot`, `business_snapshot` (D4).
9. **הקצאת המספר** (D1) + `display_number`, `tax_year = extract(year from issue_date)`.
10. **מעבר סטטוס** ל-`issued` (או `pending_allocation` ב-Phase 2, D5), `issued_at = now()`, `issued_by = auth.uid()`, `pdf_status = 'pending'`.
11. **עדכון האב** בזיכוי: `credited_amount += total_amount`.
12. `audit_log` נכתב אוטומטית ע"י ה-trigger; בנוסף שורה מפורשת עם `action='issue'`.

`COMMIT`. **מכאן ואילך המסמך קיים משפטית.** הפקת ה-PDF מתרחשת מחוץ ל-transaction.

**סדר קריטי:** 6א חייב לרוץ **לפני** 7. חישוב ה-header מסכם את השורות המתוקנות; ההפך היה משאיר בדיוק את הפער ש-A-1 מתאר.

**כלל אכיפה:** אין ל-`authenticated` שום policy שמאפשרת `UPDATE documents SET status = 'issued'` — הפונקציה היא הנתיב היחיד.

### D3 — אי-שינוי נאכף ב-trigger ב-DB, עם whitelist מפורש ו-**default deny**

```sql
create or replace function app.documents_immutable()
returns trigger language plpgsql as $$
declare
  allowed text[] := array[
    -- מצב מסירה
    'sent_at','sent_to','delivery_mode',
    -- מצב נגזר: תשלום וזיכוי
    'paid_amount','credited_amount','settled_at',
    -- Phase 2: תוצאת ההקצאה
    'allocation_number','allocation_request_id','status',
    -- הערה פנימית שאינה מודפסת + חותמת עדכון
    'internal_note','updated_at',
    -- ⚠️ signed_total מוחרג מההשוואה תמיד: עמודה generated מוצגת NULL
    --    ב-NEW בתוך BEFORE UPDATE. השמירה עליה היא דרך total_amount.
    'signed_total'
  ];
  before_j jsonb; after_j jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'INV_IMMUTABLE_DELETE: מסמך שהופק אינו נמחק (מסמך %)', old.display_number;
  end if;

  -- שדות ה-PDF פתוחים רק כל עוד הצינור לא הסתיים
  if old.pdf_status <> 'ready' then
    allowed := allowed || array['pdf_status','pdf_original_path','pdf_copy_path',
                                'pdf_sha256','signing_key_id','signed_at',
                                'pdf_attempts','pdf_error'];
  end if;

  -- status: רק pending_allocation -> issued|cancelled מותר
  if new.status is distinct from old.status
     and not (old.status::text = 'pending_allocation'
              and new.status::text in ('issued','cancelled')) then
    raise exception 'INV_IMMUTABLE_STATUS: מעבר סטטוס % -> % אסור', old.status, new.status;
  end if;

  before_j := to_jsonb(old) - allowed;
  after_j  := to_jsonb(new) - allowed;
  if before_j is distinct from after_j then
    raise exception 'INV_IMMUTABLE_FIELDS: שינוי אסור במסמך %', old.display_number;
  end if;
  return new;
end $$;

create trigger documents_immutable_trg
  before update or delete on documents
  for each row when (old.status <> 'draft')
  execute function app.documents_immutable();
```

**התכונה החשובה ביותר: default deny.** ההשוואה היא של כל השורה פחות ה-whitelist. **עמודה שתתווסף בעתיד תהיה immutable אוטומטית** אלא אם מישהו יוסיף אותה ל-whitelist במפורש.

שלוש הערות מימוש שנלמדו מ-B7 בדם:
- `old.status::text = 'pending_allocation'` — השוואה גולמית ל-enum שערך זה עדיין לא קיים בו (Phase 2) מפילה כל UPDATE ב-`invalid input value for enum`.
- `text[] - text[]` אינו אופרטור תקף ב-Postgres. בונים את ה-whitelist בתוספת (`||`), לא בחיסור.
- `signed_total` (generated stored) מוצגת `NULL` ב-`NEW` בתוך `BEFORE UPDATE`; חייבת להיות מוחרגת מההשוואה, אחרת **כל** עדכון לגיטימי ייחסם.

**טריגרים מקבילים על `document_lines` ו-`payments`** — `app.child_rows_locked()` חוסם INSERT/UPDATE/DELETE כשההורה אינו `draft`. חריג מחויב: בזרימת `DELETE` שבה שאילתת ההורה מחזירה `NULL` (cascade ממחיקת טיוטה — ההורה כבר לא נראה ב-MVCC באותו statement) הפעולה **מותרת**, כי ההורה כבר עבר את בדיקת ה-draft-only שלו.

**`audit_log`** — trigger שמעלה exception על כל `UPDATE`/`DELETE`, ללא whitelist וללא חריגים, גם ל-`service_role`.

**`allocation_requests`** — trigger שחוסם `UPDATE` אחרי `responded_at is not null`, ו-`DELETE` תמיד.

### D4 — Snapshot מלא בהפקה: המסמך אינו קורא נתונים חיים

1. **`document_lines.name` + `.description`** — מועתקים משורת הקטלוג בזמן העריכה (`item_id` נשמר כהפניה בלבד). שינוי או מחיקה של פריט בקטלוג אינם נוגעים במסמכים.
2. **`customer_snapshot jsonb`** — `{name, tax_id, tax_id_type, address..., email, phone}` כפי שהיו ברגע ההפקה.
3. **`business_snapshot jsonb`** — `{legal_name, entity_type, tax_id, address..., phone, email, logo_path, accent_color, invoice_footer_note}`.

**למה snapshot ולא היסטוריית גרסאות (SCD-2):** גרסאות היו נכונות אילו היינו צריכים לשאול "איך נראה הלקוח ב-2027"; אנחנו צריכים בדיוק דבר אחד — "מה כתוב על המסמך". `jsonb` על שורת המסמך נותן את זה בקריאה אחת ללא join, שורד מחיקה של הלקוח, והוא בדיוק המבנה שצינור ה-PDF צורך כדי לרנדר מחדש מסמך היסטורי דטרמיניסטית.

**כלל ברזל לרינדור:** תבנית ה-PDF קוראת **אך ורק** מ-`documents` + `document_lines` + `payments` + ה-snapshots. אסור לה join ל-`customers`/`businesses`/`items`. **הכלל הזה הוא בדיוק מה שהופך את A-1 לחמור:** אם השורות אינן נכונות, אין שום מקור אחר שיתקן אותן בזמן הרינדור.

### D5 — סטטוסים: מכונת מצבים סגורה

```
                     ┌────────────────────────────────────────────┐
                     │                                            │
  draft ──issue()──▶ │ pending_allocation (Phase 2, מעל הסף בלבד) │
    │                └──────┬──────────────────────┬──────────────┘
    │                       │ אושר                 │ סורב / כשל סופי
    │                       ▼                      ▼
    └────issue()──────▶  issued              cancelled
                             │
                             │ תיקון/ביטול = מסמך נגדי
                             ▼
                     credit_note חדש (issued) עם parent_document_id
```

1. **`issued` הוא מצב סופי.** מסמך שהופק **לעולם** לא עובר ל-`cancelled`. ה-trigger ב-D3 אוכף זאת מכנית.
2. **"מבוטל" הוא תכונה נגזרת, לא סטטוס.** מסמך נחשב מבוטל כאשר `credited_amount = total_amount`. ה-UI מציג "בוטל בזיכוי #NNN"; ה-DB לא משנה דבר.
3. **`cancelled` שמור למקרה אחד בלבד:** מסמך שצרך מספר אך לא הפך למסמך תקף — סירוב סופי של מספר הקצאה (Phase 2). המספר נשאר תפוס והשורה נשמרת עם הסבר, כדי שמבקר יראה רצף ללא חורים. מסמך `cancelled` לא נשלח, לא מקבל PDF חתום, ואינו נכלל בדוחות.

`'pending_allocation'` נוסף ל-enum ב-Phase 2 (`ALTER TYPE ... ADD VALUE` — additive). ב-Phase 0/1 מכונת המצבים היא `draft → issued` בלבד.

**סדר קריטי ב-Phase 2:** ה-API של רשות המסים דורש את **מספר החשבונית** בגוף הבקשה, ולכן `issue_document()` מקצה את המספר **לפני** הפנייה. מסמך מעל הסף עובר `draft → pending_allocation`, ורק תשובת ה-API קובעת `issued` או `cancelled`. **סירוב שורף מספר** — עלות בלתי נמנעת של הסדר שהרשות כפתה.

### D6 — זיכוי: מסמך נגדי מקושר, בכיוון אחד, ורק מול מסמך הכנסה *(הורחב ב-Amendment A-2)*

- `credit_note` הוא מסמך רגיל לכל דבר: מספר מסדרה משלו, snapshot, PDF חתום, immutable.
- `parent_document_id` חובה; FK מורכב `(parent_document_id, business_id)` מונע קישור חוצה-עסקים ברמת ה-DB.
- `credit_reason` חובה (טקסט חופשי, מודפס על המסמך).
- **סוג האב חייב להיות מסמך הכנסה מוכר** — `parent.type in ('receipt','tax_invoice','tax_invoice_receipt')`. אחרת `INV_CREDIT_PARENT_TYPE`.
  *נימוק:* זיכוי הופך **אירוע הכנסה/מע"מ שכבר הוכר**. `price_quote` הוא הצעה בלבד, ו-`proforma_invoice` (חשבונית עסקה) הוא מסמך תיעודי שאינו מדווח למע"מ ואינו מכיר בהכנסה — אין בהם מה להפוך. הפעולה הנכונה מולם היא פשוט לא לפעול לפיהם, או להפיק חדש. הפקת זיכוי מול הצעת מחיר הייתה יוצרת מסמך חשבונאי שמפחית הכנסה שמעולם לא נרשמה. **⚠️ טעון אישור רו"ח (B5).**
- **אין שרשור:** אסור זיכוי על זיכוי (`parent.type <> 'credit_note'` — נובע כבר מהרשימה הסגורה לעיל).
- **זיכוי חלקי נתמך:** `parent.credited_amount + credit.total_amount ≤ parent.total_amount`, נבדק תחת `for update` על האב.
- **זיכוי על קבלה** גורר שורות `payments` עם סכומים **שליליים**; `issue_document()` דורשת `sum(payments) = -payable_amount` בזיכוי מול מסמך תקבול.
- **הסכומים בזיכוי חיוביים**; הסימן החשבונאי מגיע מ-`signed_total`.
- **כותרת המסמך** נגזרת: "חשבונית זיכוי" מול חשבונית מס, "הודעת זיכוי" מול קבלה או כשהעסק פטור.

### D7 — הפקת ה-PDF מחוץ ל-transaction; כשל PDF אינו מבטל הפקה

`issue_document()` מסתיימת ב-`pdf_status='pending'`. הנתיב באפליקציה קורא מיד לצינור (ADR-INV-003). אם הצינור נכשל: `pdf_status='failed'`, `pdf_attempts++`, `pdf_error`, ו-cron חוזר ומנסה.

**המסמך נשאר `issued`.** המסמך נוצר משפטית בהקצאת המספר ובקיבוע התוכן; ה-PDF הוא רינדור שלו. לגלגל אחורה הפקה בגלל כשל Chromium היה מייצר חור במספור בגלל תקלה טכנית. הצינור **אידמפוטנטי** כי התוכן קפוא — כל ריצה חוזרת מייצרת אותו מסמך.

### D8 — ערכי השורות מחושבים ב-DB, לא מתקבלים מהלקוח *(Amendment A-1)*

**הבעיה.** `line_net`, `line_vat`, `line_total` ו-`discount_amount` היו עמודות שהלקוח כותב ואיש לא מאמת. ה-PDF מרונדר מהן (D4). מסמך שהופק יכול היה להציג פירוט שאינו מסתכם לכותרת — פגם שאינו ניתן לתיקון אחרי ההפקה אלא בזיכוי.

**ההכרעה — שלוש שכבות, עם פונקציית חישוב אחת משותפת:**

```sql
-- מקור אמת יחיד לחישוב שורה. נקראת משני מקומות בלבד.
create or replace function app.compute_line(
  p_quantity          numeric,
  p_unit_price        numeric,
  p_discount_percent  numeric,
  p_vat_treatment     public.vat_treatment,
  p_vat_rate          numeric
) returns table (discount_amount numeric, line_net numeric,
                 line_vat numeric, line_total numeric)
language sql immutable as $$
  select d, n,
         v,
         round(n + v, 2)
  from (
    select round(gross * p_discount_percent / 100, 2) as d,
           round(gross - round(gross * p_discount_percent / 100, 2), 2) as n
    from (select round(p_quantity * p_unit_price, 2) as gross) g
  ) x,
  lateral (select case when p_vat_treatment = 'standard'
                       then round(x.n * p_vat_rate / 100, 2) else 0 end as v) y;
$$;
```

**שכבה 1 — `BEFORE INSERT OR UPDATE ON document_lines`:** trigger `app.document_lines_compute()` מחשב את ארבע העמודות ו**דורס** כל ערך שהלקוח שלח. שיעור המע"מ נלקח כ-`coalesce(parent.vat_rate, השיעור בתוקף היום)`, ונכפה ל-0 כאשר `parent.business_entity_type = 'patur'` או `vat_treatment in ('zero','exempt')`.

**שכבה 2 — שלב 6א ב-`issue_document()`:** אותה פונקציה רצה שוב על כל השורות, הפעם עם השיעור הסמכותי שנגזר מ-`issue_date`. זה מכסה את המקרה שבו טיוטה נפתחה בדצמבר והופקה בינואר אחרי שינוי שיעור מע"מ. רק אחר כך מחושב ה-header מהשורות.

**שכבה 3 — `check (line_total = line_net + line_vat)` על `document_lines`:** invariant אריתמטי מדויק, ללא פונקציית עיגול וללא הפניה חוצה-טבלה — ולכן אינו יכול להיכשל בגלל אי-הסכמת עיגול בין JS ל-Postgres.

**למה trigger ולא עמודות `generated`** (החלופה המתבקשת): `line_vat` תלוי ב-`vat_rate` של **שורת ההורה** ב-`documents`, ועמודה generated ב-Postgres אינה יכולה להפנות לטבלה אחרת. בנוסף, B7 כבר הוכיח שעמודות generated מתנהגות באופן מלכודתי בתוך `BEFORE UPDATE` triggers (`NEW.signed_total` הוא `NULL`) — הוספת עוד שלוש כאלה לטבלה שמכוסה ב-trigger השוואתי הייתה מזמינה חזרה על אותו באג.

**למה גם trigger וגם חישוב חוזר בהפקה, ולא רק אחד מהם:**
- **רק trigger** לא היה מטפל בשינוי שיעור מע"מ בין יצירת הטיוטה להפקה.
- **רק חישוב בהפקה** היה שובר את הבטחת המוצר המרכזית: ADR-INV-003 §D1 מבטיח **תבנית אחת** ל-live preview ול-PDF. אם ההפקה מתקנת בשקט את המספרים, המשתמש רואה בתצוגה המקדימה סכומים אחרים מאלה שיודפסו. ה-trigger מבטיח שהתצוגה המקדימה קוראת ערכים שכבר נכונים, ולכן **preview == מסמך מופק**.

**נגזרת ל-UI:** הלקוח **לא מחשב סכומים**. הוא שולח `quantity`, `unit_price`, `discount_percent`, `vat_treatment`, וקורא בחזרה את הערכים המחושבים (`returning`/refetch). כל חישוב כספי ב-JS הוא באג.

**`discount_amount` הופכת לנגזרת מ-`discount_percent`.** אם בעתיד יידרש להזין הנחה בשקלים ישירות, זה שינוי בפונקציה אחת — אבל **לא** שתי עמודות קלט מתחרות שאיש לא יודע איזו מהן גוברת.

---

## חלופות שנדחו

| שאלה | חלופה | למה נדחתה |
|---|---|---|
| מקור המספר | `SEQUENCE` / `identity` | non-transactional ⇒ חורים במספור בכל rollback. פסול חוקית. |
| מקור המספר | `max(document_number)+1` בקריאה | race מובהק; דורש `SERIALIZABLE` והתמודדות עם retries. |
| נעילה | advisory lock פר עסק+סוג | עובד, אבל מפזר את הנעילה מחוץ לנתונים. שורת מונה נעולה היא הנעילה **וגם** מקור האמת. |
| אכיפת immutability | הרשאות בלבד (אין policy UPDATE) | `service_role` וה-SQL Editor עוקפים RLS. Trigger לא נעקף. |
| אכיפת immutability | blacklist של שדות אסורים | כל עמודה חדשה בעתיד הייתה נפתחת לעריכה בשקט. |
| ערכי שורות | עמודות `generated always as` | `line_vat` תלוי ב-`vat_rate` של ההורה — generated לא יכולה לחצות טבלאות. ובנוסף: מלכודת ה-`NULL` ב-`BEFORE UPDATE`. |
| ערכי שורות | CHECK מלא שקושר `line_net` ל-`quantity*unit_price` | מפיל כל שמירת טיוטה שבה ה-JS עיגל אחרת מ-Postgres. CHECK שיכול להיכשל על קלט לגיטימי הוא מטרד, לא הגנה. |
| ערכי שורות | חישוב רק בהפקה | שובר את הבטחת "preview == מסמך מופק" של ADR-INV-003 §D1. |
| ביטול | `status='cancelled'` על מסמך שהופק | הפרה ישירה של "תיקון בזיכוי בלבד". |
| כשל PDF | rollback של ההפקה | חור במספור מסיבה טכנית. פסול. |

---

## Consequences

**חיובי**
- שלוש שכבות בלתי-תלויות שומרות על המספור: שורת מונה נעולה, `unique index`, ו-CHECK שדורש מספר בכל מסמך שאינו טיוטה.
- ה-immutability אינה תלויה באפליקציה. פיתוח עתידי, סקריפט תחזוקה או קונסולת Supabase — כולם נחסמים באותה שגיאה.
- Default-deny ב-trigger הופך את הנכונות לתכונה של ה-schema ולא של המשמעת של המפתח.
- **אחרי A-1, "החישוב סמכותי ב-DB" חל על כל המסמך ולא רק על הכותרת.** אין שום ערך כספי במסמך שמקורו בלקוח.
- ה-snapshots הופכים כל מסמך למכל עצמאי — שינוי לוגו, כתובת או מחיקת לקוח לא נוגעים בהיסטוריה.
- כשל בצינור ה-PDF הוא אירוע תפעולי בלבד, לא אירוע חשבונאי.

**שלילי / חוב טכני**
- הפקה מסריאליזציה פר `(business, type, year)`. חסר משמעות ב-2 מסמכים/חודש.
- ה-whitelist ב-D3 דורש עדכון מודע בכל הוספת עמודה — אם שוכחים, migration שמעדכן את העמודה החדשה על מסמכים קיימים ייכשל. **זו ההתנהגות הרצויה**, אבל היא תפתיע מפתח שלא קרא את ה-ADR.
- **`app.compute_line()` הופכת לנקודת כשל יחידה של כל הכספים במערכת.** שינוי בה משנה כל מסמך עתידי. היא חייבת כיסוי טסטים ברמת יחידה (כולל מקרי עיגול) ו-review מיוחד בכל נגיעה.
- ה-trigger על `document_lines` רץ בכל שמירת autosave של טיוטה. זניח בנפח הזה, אך הוא כן מחייב את ה-UI לרענן את הערכים אחרי כתיבה.
- `credited_amount` ו-`paid_amount` הם denormalized aggregates. בדיקת עקביות לילית מתריעה על פער (לא מתקנת).
- סירוב הקצאה שורף מספר (Phase 2) — יידרש הסבר לרו"ח.
- הודעות השגיאה מה-trigger מגיעות ללקוח כשגיאת Postgres; נדרש מיפוי `INV_*` להודעות עברית.

**השפעה על מודולים אחרים**
- **ADR-INV-003:** הצינור מקבל `document_id` בלבד ומרנדר מהתוכן הקפוא; חייב להיות אידמפוטנטי; אסור לו לכתוב מחוץ ל-whitelist.
- **Frontend:** העורך **לא מחשב סכומים** (D8). autosave שולח קלט גולמי וקורא בחזרה מחושב.
- **Phase 2 (הקצאה):** מכונת המצבים כבר מגדירה את המקום. הקוד יוסיף ערך enum + ענף — לא שינוי מבני.
- **Phase 3 (דוחות ומבנה אחיד):** כל סכימה `sum(signed_total) where status='issued'`. מסמכי `cancelled` ו-`draft` מסוננים תמיד. **מבנה אחיד (רשומות D110) קורא את שורות המסמך ישירות — A-1 היה מייצר קובץ ביקורת שאינו מסתכם.**

---

## Reversal Conditions

- **רו"ח יקבע שאיפוס שנתי נדרש** — שינוי ב-`app.seed_for()` בלבד.
- **רו"ח יקבע ש"קבלת זיכוי" חייבת סדרת מספור נפרדת** — הוספת ערך enum + שורת מונה.
- **רו"ח יקבע שחשבונית עסקה כן דורשת ביטול פורמלי** — הרחבת הרשימה ב-D6.
- **יידרש להזין הנחה בשקלים ישירות** (ולא באחוזים) — שינוי ב-`app.compute_line()` והגדרה מפורשת מי גובר; **לא** שתי עמודות קלט מתחרות.
- **תרחיש שבו נדרש לתקן מסמך שהופק** — הנוהל הנכון הוא זיכוי + הפקה מחדש. אם יתברר כבלתי-נסבל תפעולית, נשקול "חלון תיקון" של דקות ספורות לפני שליחה — **דורש חוות דעת רו"ח ו-ADR חדש.**
- **מעבר ל-100+ הפקות ביום** — נשקול advisory lock ובחינה מחדש של ה-transaction boundary.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | הסיבה |
|---|---|---|
| B1 | סירוב הקצאה שורף מספר ומשאיר שורת `cancelled` ברצף | **חוות דעת רו"ח** |
| B2 | אין שום נתיב לתיקון מסמך שהופק, גם לא בדקה הראשונה | החלטה מוצרית עם חיכוך תפעולי אמיתי |
| B3 | זיכוי חלקי מותר; זיכוי על זיכוי אסור | **חוות דעת רו"ח** |
| B4 | מסמך `issued` שכשל ב-PDF נשאר תקף ומספרו נצרך | **חוות דעת רו"ח** |
| B5 | *(Amendment A-2)* זיכוי מותר **רק** מול `receipt`/`tax_invoice`/`tax_invoice_receipt` — לא מול חשבונית עסקה או הצעת מחיר | **חוות דעת רו"ח** — האם חשבונית עסקה דורשת ביטול פורמלי |

---

## Implementation Notes

1. **`public.issue_document` הוא ה-RPC היחיד שנחשף** (`supabase.rpc('issue_document', {...})`, schema `public` לפי ADR-INV-001 §D3.3). `grant execute` ל-`authenticated` בלבד; `revoke` מ-`public, anon`.

2. **בדיקת race חובה ב-DoD של Phase 1:** 20 קריאות מקבילות ל-`issue_document()` על 20 טיוטות של אותו עסק ואותו סוג. התוצאה: 20 מספרים עוקבים ללא חזרה וללא חור. רצה ב-CI.

3. **בדיקות immutability חובה:** לכל שדה שאינו ב-whitelist — `UPDATE` ישיר על מסמך `issued` נכשל, גם ב-`service_role`. וכן `DELETE`, `INSERT` ל-`document_lines` של מסמך שהופק, ו-`UPDATE` על `audit_log`.

4. **בדיקות D8 חובה (חדשות, Amendment A-1):**
   - INSERT ל-`document_lines` עם `line_net`/`line_vat`/`line_total`/`discount_amount` **שגויים בכוונה** ⇒ הערכים הנקראים בחזרה נכונים (ה-trigger דרס).
   - `sum(line_total)` על מסמך שהופק **שווה בדיוק** ל-`documents.total_amount`. זו בדיקת ה-"foots" הקנונית, על כל אחד מששת סוגי המסמכים.
   - טיוטה שנוצרה תחת מע"מ 17% ומופקת עם `issue_date` בתקופת 18% ⇒ השורות וה-header שניהם ב-18%.
   - עסק פטור ⇒ `line_vat = 0` בכל שורה, גם אם `vat_treatment='standard'` נשלח.
   - מקרי עיגול ל-`app.compute_line()` ברמת יחידה: כמויות שבריריות, הנחות שמייצרות חצי אגורה, ווידוא שסכימת שורות מעוגלות = ה-header (ולא עיגול של סכום).
   - `check (line_total = line_net + line_vat)` נכשל על UPDATE ידני שמפר אותו.

5. **בדיקת D6 חדשה:** `credit_note` מול `price_quote` ומול `proforma_invoice` ⇒ `INV_CREDIT_PARENT_TYPE`; מול `receipt`/`tax_invoice`/`tax_invoice_receipt` ⇒ מצליח.

6. **`documents.updated_at` (Amendment A-3):** trigger `set_updated_at` על `documents` ל**כל** UPDATE — לא רק בטיוטה. `updated_at` נמצא ב-whitelist של D3 בדיוק כדי שעדכוני מצב אחרי הפקה (תשלום, PDF) ישתקפו בו. **זה מתקן את הניסוח ב-ADR-INV-001 §Implementation Notes #4** ("רק בסטטוס draft"), ומתקן באג פונקציונלי: `documents_drafts_idx` ממיין לפי `updated_at desc`, וללא ה-trigger רשימת הטיוטות ממוינת שגוי.

7. **מיפוי שגיאות:** קודי `INV_*` (`INV_ALREADY_ISSUED`, `INV_IMMUTABLE_DELETE`, `INV_IMMUTABLE_FIELDS`, `INV_IMMUTABLE_STATUS`, `INV_IMMUTABLE_CHILD`, `INV_TYPE_NOT_ALLOWED`, `INV_PAYMENTS_MISMATCH`, `INV_CREDIT_EXCEEDS_PARENT`, **`INV_CREDIT_PARENT_TYPE`**, `INV_NO_SIGNING_KEY`, `INV_NO_LINES`, `INV_ALLOCATION_REQUIRED`) → מילון עברית ב-`src/lib/errors.ts`.

8. **`display_number`** = `number_prefix || document_number::text`. אין padding באפסים כברירת מחדל.

9. **בדיקת עקביות לילית** (GitHub Actions cron): אין חורים ברצף לכל `type`+`tax_year`; `credited_amount` תואם ל-`sum()` של הזיכויים; **`sum(line_total)` תואם ל-`total_amount` בכל מסמך שהופק**; אין מסמך `issued` ללא `pdf_status='ready'` מעל 24 שעות. פלט לדוא"ל של המייסד.

10. **הערת אזהרה בראש הגדרת `documents`:** "הוספת עמודה כאן חייבת החלטה מודעת — היא immutable אחרי הפקה אלא אם תתווסף ל-whitelist ב-`app.documents_immutable()`. ראה ADR-INV-002 §D3."

11. **הערת אזהרה בראש `app.compute_line()`:** "מקור האמת היחיד לכל סכום כספי במערכת. נקראת מ-`app.document_lines_compute()` ומ-`public.issue_document()`. שינוי כאן משנה כל מסמך עתידי — דורש review של erp-domain-expert."

12. **סדר ה-BEFORE triggers על `document_lines`:** Postgres מפעיל BEFORE triggers בסדר אלפביתי לפי שם. יש לוודא ש-`app.child_rows_locked()` (החוסם) יורה **לפני** ה-trigger המחשב — שם כמו `a_child_rows_locked_trg` מול `b_compute_trg`, או שם מפורש שקובע את הסדר. אחרת מתבצע חישוב מיותר לפני הדחייה (לא באג נכונות, אבל מבלבל ב-debug).

13. **טיוטות ננטשות** — טיוטה שלא נגעו בה 180 יום ניתנת למחיקה ע"י ה-owner (רק `draft`). לא מחיקה אוטומטית — רק הצעה ב-UI.
