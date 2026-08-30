# ADR-INV-002: אי-שינוי מסמכים ומספור רציף

**Date:** 2026-08-30
**Status:** Accepted
**Amended:** 2026-08-30 — Amendment A + addendum A′ (ראה סעיף "Amendment Log")
**Decider:** Architect (proposed), CEO (final approval)
**Related:** ADR-INV-001 (schema, RLS), ADR-INV-003 (PDF וחתימה)

---

## Amendment Log

### Amendment A — 2026-08-30 (ממצאי QA על B5-B8; חסם acceptance של Batch 2)

שני reviewers בלתי-תלויים התכנסו לאותו פגם — erp-domain-expert (🔴) ו-code-quality (⚠️).

| # | הממצא | התיקון |
|---|---|---|
| **A-1** | 🔴 **`issue_document()` מקפיאה את סכומי הכותרת אך לא את ערכי השורות.** `document_lines.line_net/line_vat/line_total/discount_amount` ניתנות לכתיבה חופשית, ו-ADR-INV-003 מרנדר את ה-PDF מהן ⇒ **מסמך שהופק יכול להציג פירוט שאינו מסתכם לסכום הכותרת** | **§D8 חדש** — שלוש שכבות: trigger מחשב על `document_lines`, חישוב חוזר ב-`issue_document()`, ו-CHECK של עקביות פנימית |
| **A-2** | זיכוי יכול להצביע על אב מסוג `price_quote`/`proforma_invoice` — מסמכים שאינם מייצרים אירוע הכנסה/מע"מ | **§D6** — `parent.type` חייב להיות ב-`{receipt, tax_invoice, tax_invoice_receipt}`. `INV_CREDIT_PARENT_TYPE`. **טעון אישור רו"ח (B5)** |
| **A-3** | `documents.updated_at` קפוא; `documents_drafts_idx` ממיין לפיו ⇒ **רשימת הטיוטות ממוינת שגוי** | trigger `set_updated_at` על `documents` ל**כל** UPDATE. **מתקן את ADR-INV-001 §Implementation Notes #4** |
| **A-4** | (עקבי) `app.issue_document`/`app.set_start_number` → `public.*` | לפי ADR-INV-001 Amendment B-2 |

### Addendum A′ — 2026-08-30 (סקירת המימוש בפועל, commit `7f50e53` / `0009_amendments.sql`)

ה-builder מימש את Amendment A ומצא בדרך שגיאה בנוסח ה-ADR. **הוא צדק, והנוסח תוקן.** בסקירת המימוש עלו שני דברים נוספים.

| # | הנושא | ההכרעה |
|---|---|---|
| **A′-1** | **`coalesce(parent.vat_rate, השיעור בתוקף היום)` ב-§D8 שכבה 1 הוא dead code.** `documents.vat_rate` הוא `not null default 0` ומאוכלס רק ע"י `issue_document()` עצמה ⇒ בטיוטה הוא **תמיד 0**, ה-`coalesce` לעולם לא נופל לענף השני, וכל שורת טיוטה הייתה מוצגת ב-0% מע"מ — כלומר שכבה 1 הייתה מפספסת בדיוק את מטרתה | **מאושר. הנוסח תוקן.** לא `parent.vat_rate` — השיעור נגזר מ**תאריך**, ראה A′-2 |
| **A′-2** | **🔴 באג חי שנמצא בסקירה, לא דווח:** `issue_document()` מחשבת `v_issue_date := coalesce(p_issue_date, current_date)` ומתעלמת לחלוטין מ-`documents.issue_date` שהמשתמש הגדיר בטיוטה — ואז **דורסת אותו** (`issue_date = v_issue_date`). קבלה שתוארכה במכוון ל-15.7 מונפקת בשקט בתאריך היום. אובדן נתונים שקט, במסמך immutable | **תיקון מחייב:** `v_issue_date := coalesce(p_issue_date, v_doc.issue_date, current_date)`. בנוסף: `issue_date` בעתיד נדחה (`INV_FUTURE_ISSUE_DATE`) |
| **A′-3** | ההחלטה "טיוטה = שיעור היום" משאירה פער מיותר: תיארוך אחורה מציג preview בשיעור לא נכון | **מעודן:** שכבה 1 נגזרת מ-`coalesce(documents.issue_date, current_date)` — אותו כלל בדיוק כמו שכבה 2. הפער היחיד שנשאר הוא שינוי שיעור מע"מ בין העריכה האחרונה להפקה — וזה בדיוק המקרה שבשבילו שכבה 2 קיימת |
| **A′-4** | `app.recompute_draft_lines()` (search_path רגיל) כעוקף את `app.child_rows_locked()` מ-`0007`, שמצהיר `v_status document_status` ללא schema ולכן נשבר תחת `search_path=''` | **מאושר כפתרון ביניים**, אבל **שורש הבעיה חייב תיקון** — ראה §Implementation Notes #14. לא נכנס ל-whitelist של ADR-INV-001 §D3.2: הוא `SECURITY INVOKER` (אומת בקוד), ולכן מחוץ ל-scope של בדיקת CI (ה) |

**הערכת המימוש.** `0009_amendments.sql` נאמן ל-ADR ומשפר עליו בשלוש נקודות שראוי לציין, כי הן מונעות באגים עתידיים: (1) שיתוף trigger function אחת בין שכבה 1 לשכבה 2 דרך GUC transaction-local `app.issuing_as_of`, במקום לשכפל את לוגיקת הקריאה ל-`compute_line()` — התיעוד מסביר נכון ש-`UPDATE ... FROM app.compute_line(...)` ישיר היה נדרס ע"י אותו trigger שיורה מחדש בשיעור של היום; (2) חישוב ה-header בשלב 7 מ-`sum()` של השורות המחושבות במקום מנוסחה שנייה — מסיר בדיוק את הכפילות ש-A-1 נועד לחסל; (3) שם ה-trigger `lines_values_compute_trg` נבחר כך שיסודר אחרי `lines_locked_trg` (`'l' < 'v'`), לפי §Implementation Notes #12.

*Addendum A′ הוסיף החלטה אחת הטעונה אישור רו"ח (B6, תיארוך אחורה חוצה-שנות-מס). שאר התיקונים בסמכות הארכיטקט.*

---

## Context

הוראות ניהול ספרים קובעות שלושה כללים שאינם ניתנים למשא ומתן מוצרי:

1. **מספור עוקב** לכל סוג מסמך — ללא חורים, ללא שימוש חוזר במספר.
2. **מסמך שהופק אינו נערך ואינו נמחק.** תיקון = מסמך נגדי מקושר בלבד.
3. **המסמך משקף את המצב ברגע ההפקה** — שינוי מאוחר בכרטיס הלקוח או במחיר הפריט אינו רשאי לשנות מסמך היסטורי.

ה-ADR הזה קובע איך שלושת הכללים נאכפים ברמה שלא ניתנת לעקיפה — לא ע"י באג באפליקציה, לא ע"י `service_role`, ולא ע"י SQL Editor של Supabase.

אילוץ טכני מכריע: **הפקת ה-PDF איטית** (Chromium cold start ~3-5 שניות, ADR-INV-003) בעוד שהקצאת המספר חייבת להיות אטומית ומהירה. אסור להחזיק transaction פתוח על שורת המונה בזמן שרץ דפדפן.

---

## Decision

### D1 — המספר מוקצה מטבלת מונים ב-`UPDATE ... RETURNING`, לא מ-Postgres `SEQUENCE`

```sql
-- בתוך public.issue_document(), ב-transaction אחד:
insert into document_counters (business_id, document_type, tax_year, next_number, start_number)
values (p_business, p_type, p_year, app.seed_for(...), app.seed_for(...))
on conflict (business_id, document_type, tax_year) do nothing;

update document_counters
   set next_number = next_number + 1, last_issued_at = now()
 where business_id = p_business and document_type = p_type and tax_year = p_year
returning next_number - 1 into v_number;      -- ⬅ נועל את השורה עד סוף ה-transaction
```

**למה לא `SEQUENCE`:** רצפים ב-Postgres הם non-transactional במכוון — `nextval` לא חוזר אחורה ב-`ROLLBACK`. כל כשל אחרי שליפת המספר היה מייצר **חור במספור** — הפרה ישירה של הדרישה החוקית. שורת מונה בטבלה רגילה נעולה ומגולגלת אחורה יחד עם ה-transaction.

**ערובת ה-DB:** `unique index documents_number_uk on documents (business_id, type, tax_year, document_number)`.

### D2 — ההפקה היא פונקציה אחת ב-`SECURITY DEFINER`; אין נתיב שני

```sql
create or replace function public.issue_document(p_document_id uuid, p_issue_date date default null)
returns public.documents
language plpgsql security definer set search_path = ''
as $$ ... $$;
```

**קביעת `issue_date` — סדר עדיפות מחייב** *(Addendum A′-2)*:
```
v_issue_date := coalesce(p_issue_date, v_doc.issue_date, current_date)
```
ארגומנט מפורש ב-RPC גובר על מה שהמשתמש הגדיר בטיוטה, שגובר על היום. **`coalesce(p_issue_date, current_date)` בלבד הוא באג** — הוא דורס בשקט תיארוך שהמשתמש הזין, במסמך שאי אפשר לתקן אחר כך.
בנוסף: `v_issue_date > current_date` נדחה ב-`INV_FUTURE_ISSUE_DATE` — מסמך לא יכול להיות מתוארך אחרי הרגע שבו הוא נוצר.

הרצף בתוך ה-transaction:

1. `select ... for update` — נעילת המסמך.
2. **אימות חברות והרשאה** — `app.has_role(business_id, {'owner','editor'})`. definer מבטל RLS; זה השומר היחיד.
3. **אימות מצב:** `status = 'draft'`, אחרת `INV_ALREADY_ISSUED`.
4. **טעינת ה-business** (entity_type + snapshot + לוגיקת מע"מ).
5. **אימותי תוכן:** יש שורות; יש `customer_id`; טיפוס מותר לסוג הישות; `credit_note` ⇒ אב קיים, `issued`, באותו עסק, **מסוג מותר (D6)**, ובתוך היתרה.
6. **קביעת שיעור המע"מ** מ-`vat_rates` לפי `v_issue_date` (או 0 לעוסק פטור).
   **6א. חישוב מחדש ודריסה של כל שורות המסמך** בשיעור משלב 6 (§D8 שכבה 2).
7. **חישוב ה-header כ-`sum()` של השורות שזה עתה חושבו מחדש** — לא מנוסחה שנייה ולא מערכים שהלקוח שלח.
8. **קיבוע snapshots** (D4).
9. **הקצאת המספר** (D1) + `display_number` + `tax_year`.
10. **מעבר סטטוס** ל-`issued`, `issued_at`, `issued_by`, `pdf_status='pending'`.
11. **עדכון האב** בזיכוי: `credited_amount += total_amount`.
12. `audit_log` — שורה מפורשת עם `action='issue'` מעל מה שה-trigger כתב.

**סדר קריטי:** 6א לפני 7. חישוב ה-header מסכם את השורות המתוקנות; ההפך היה משאיר בדיוק את הפער ש-A-1 מתאר.

**כלל אכיפה:** אין ל-`authenticated` policy שמאפשרת `UPDATE documents SET status='issued'` — הפונקציה היא הנתיב היחיד.

### D3 — אי-שינוי נאכף ב-trigger ב-DB, עם whitelist מפורש ו-**default deny**

whitelist (כל השאר — כולל עמודות שיתווספו בעתיד — חסום אוטומטית):
`sent_at`, `sent_to`, `delivery_mode`, `paid_amount`, `credited_amount`, `settled_at`, `allocation_number`, `allocation_request_id`, `status`, `internal_note`, `updated_at` — ובנוסף שדות ה-PDF (`pdf_status`, `pdf_original_path`, `pdf_copy_path`, `pdf_sha256`, `signing_key_id`, `signed_at`, `pdf_attempts`, `pdf_error`) **רק כל עוד `pdf_status <> 'ready'`**.

`DELETE` על מסמך שאינו `draft` — תמיד `INV_IMMUTABLE_DELETE`.
`status` — רק המעבר `pending_allocation → issued|cancelled` (Phase 2).

שלוש הערות מימוש שנלמדו ב-B7 בדם:
- **`old.status::text = 'pending_allocation'`** — השוואה גולמית ל-enum שערך זה עדיין לא קיים בו מפילה כל UPDATE ב-`invalid input value for enum`.
- **`text[] - text[]` אינו אופרטור תקף.** בונים את ה-whitelist בתוספת (`||`), לא בחיסור.
- **`signed_total` (generated stored) מוצגת `NULL` ב-`NEW` בתוך `BEFORE UPDATE`** — חייבת להיות מוחרגת מההשוואה לגמרי, אחרת **כל** עדכון לגיטימי ייחסם.

**`app.child_rows_locked()`** חוסם INSERT/UPDATE/DELETE על `document_lines`/`payments` כשההורה אינו `draft`. חריג מחויב: בזרימת `DELETE` שבה שאילתת ההורה מחזירה `NULL` (cascade ממחיקת טיוטה — ההורה כבר לא נראה ב-MVCC באותו statement) הפעולה **מותרת**.

**`audit_log`** — exception על כל `UPDATE`/`DELETE`, ללא חריגים, גם ל-`service_role`.
**`allocation_requests`** — `UPDATE` חסום אחרי `responded_at`, `DELETE` תמיד.

### D4 — Snapshot מלא בהפקה: המסמך אינו קורא נתונים חיים

1. **`document_lines.name`/`.description`** — מועתקים מהקטלוג בזמן העריכה (`item_id` הפניה בלבד).
2. **`customer_snapshot jsonb`** — `{name, tax_id, tax_id_type, address..., email, phone}`.
3. **`business_snapshot jsonb`** — `{legal_name, entity_type, tax_id, address..., phone, email, logo_path, accent_color, invoice_footer_note}`.

**למה snapshot ולא SCD-2:** גרסאות היו נכונות אילו היינו צריכים "איך נראה הלקוח ב-2027"; אנחנו צריכים בדיוק דבר אחד — "מה כתוב על המסמך". `jsonb` על השורה נותן את זה בקריאה אחת ללא join, שורד מחיקת לקוח, והוא בדיוק המבנה שצינור ה-PDF צורך לרינדור דטרמיניסטי.

**כלל ברזל לרינדור:** התבנית קוראת **אך ורק** מ-`documents` + `document_lines` + `payments` + ה-snapshots. **הכלל הזה הוא בדיוק מה שהופך את A-1 לחמור:** אם השורות אינן נכונות, אין מקור אחר שיתקן אותן בזמן הרינדור.

### D5 — סטטוסים: מכונת מצבים סגורה

```
  draft ──issue()──▶ pending_allocation (Phase 2)  ──אושר──▶ issued
    │                        └──סורב/כשל סופי──▶ cancelled
    └────issue()──────────────────────────────────▶ issued
                                                      │ תיקון/ביטול
                                                      ▼ credit_note חדש
```

1. **`issued` הוא מצב סופי.** מסמך שהופק **לעולם** לא עובר ל-`cancelled`.
2. **"מבוטל" הוא תכונה נגזרת** (`credited_amount = total_amount`), לא סטטוס.
3. **`cancelled` שמור למקרה אחד:** מסמך שצרך מספר אך לא הפך למסמך תקף — סירוב סופי של מספר הקצאה. המספר נשאר תפוס כדי שמבקר יראה רצף ללא חורים.

**סדר קריטי ב-Phase 2:** ה-API של רשות המסים דורש את מספר החשבונית בגוף הבקשה ⇒ המספר מוקצה **לפני** הפנייה ⇒ **סירוב שורף מספר**. עלות בלתי נמנעת של הסדר שהרשות כפתה.

### D6 — זיכוי: מסמך נגדי מקושר, בכיוון אחד, ורק מול מסמך הכנסה *(Amendment A-2)*

- מסמך רגיל לכל דבר: מספר מסדרה משלו, snapshot, PDF חתום, immutable.
- `parent_document_id` חובה; FK מורכב `(parent_document_id, business_id)` מונע קישור חוצה-עסקים ב-DB.
- `credit_reason` חובה, מודפס.
- **סוג האב חייב להיות מסמך הכנסה מוכר** — `parent.type in ('receipt','tax_invoice','tax_invoice_receipt')`, אחרת `INV_CREDIT_PARENT_TYPE`.
  *נימוק:* זיכוי הופך **אירוע הכנסה/מע"מ שכבר הוכר**. `price_quote` הוא הצעה, ו-`proforma_invoice` הוא מסמך תיעודי שאינו מדווח למע"מ ואינו מכיר בהכנסה — אין בהם מה להפוך. זיכוי מולם היה יוצר מסמך חשבונאי שמפחית הכנסה שמעולם לא נרשמה. הרשימה החיובית הזו **בולעת** גם את איסור זיכוי-על-זיכוי. **טעון אישור רו"ח (B5).**
- **זיכוי חלקי נתמך:** `parent.credited_amount + credit.total_amount ≤ parent.total_amount`, תחת `for update` על האב.
- **זיכוי על קבלה** גורר `payments` שליליים; `sum(payments) = -payable_amount`.
- **הסכומים חיוביים**; הסימן מגיע מ-`signed_total`.
- **הכותרת נגזרת:** "חשבונית זיכוי" מול חשבונית מס, "הודעת זיכוי" מול קבלה או כשהעסק פטור.

### D7 — הפקת ה-PDF מחוץ ל-transaction; כשל PDF אינו מבטל הפקה

`issue_document()` מסתיימת ב-`pdf_status='pending'`. כשל ⇒ `failed` + `pdf_attempts++` + cron. **המסמך נשאר `issued`** — הוא נוצר משפטית בהקצאת המספר ובקיבוע התוכן; לגלגל אחורה בגלל כשל Chromium היה מייצר חור במספור מסיבה טכנית. הצינור **אידמפוטנטי** כי התוכן קפוא.

### D8 — ערכי השורות מחושבים ב-DB, לא מתקבלים מהלקוח *(Amendment A-1, מעודן ב-A′)*

**הבעיה.** `line_net`, `line_vat`, `line_total`, `discount_amount` היו עמודות שהלקוח כותב ואיש לא מאמת. ה-PDF מרונדר מהן (D4). מסמך שהופק יכול היה להציג פירוט שאינו מסתכם לכותרת — פגם שאינו ניתן לתיקון אחרי ההפקה אלא בזיכוי.

**ההכרעה — שלוש שכבות, עם פונקציית חישוב אחת משותפת:**

```sql
create or replace function app.compute_line(
  p_quantity numeric, p_unit_price numeric, p_discount_percent numeric,
  p_vat_treatment public.vat_treatment, p_vat_rate numeric
) returns table (discount_amount numeric, line_net numeric, line_vat numeric, line_total numeric)
language sql immutable set search_path = '' as $$ ... $$;
```

**שכבה 1 — `BEFORE INSERT OR UPDATE ON document_lines`** (`app.document_lines_compute()`): מחשב ו**דורס** את ארבע העמודות. שיעור המע"מ:

> **`v_as_of := coalesce(app.issuing_as_of, documents.issue_date, current_date)`**, ואז שליפת השיעור התקף ב-`v_as_of` מ-`vat_rates`; ו-**0 כפוי** כאשר `business_entity_type = 'patur'` או `vat_treatment in ('zero','exempt')`.

⚠️ **תיקון לנוסח קודם** *(A′-1)*: הנוסח הישן אמר `coalesce(parent.vat_rate, השיעור בתוקף היום)` — **זה היה שגוי**. `documents.vat_rate` הוא `not null default 0` ומאוכלס רק ע"י `issue_document()`, כך שבטיוטה הוא תמיד 0, ה-`coalesce` לעולם אינו נופל לענף השני, וכל שורת טיוטה הייתה מוצגת ב-0% מע"מ. **השיעור נגזר מתאריך, לא משורת ההורה.**

⚠️ **`documents.issue_date` ולא `current_date` בלבד** *(A′-3)*: כך שכבה 1 משתמשת **באותו כלל בדיוק** כמו שכבה 2. משתמש שמתארך קבלה אחורה רואה בתצוגה המקדימה את השיעור הנכון לאותו תאריך. הפער היחיד שנשאר הוא שינוי שיעור מע"מ בין העריכה האחרונה לרגע ההפקה — וזה בדיוק המקרה שבשבילו שכבה 2 קיימת.

**שכבה 2 — שלב 6א ב-`issue_document()`:** אותו trigger יורה מחדש על כל שורות המסמך, הפעם עם השיעור הסמכותי שנגזר מ-`v_issue_date`, **לפני** חישוב ה-header.

*מנגנון מאושר (מהמימוש, ראוי לקיבוע):* ההעברה נעשית ב-GUC transaction-local `app.issuing_as_of` + כתיבת no-op (`update document_lines set quantity = quantity where document_id = ...`) שמאלצת את ה-BEFORE trigger לרוץ. הסיבה שזה עדיף על `UPDATE ... FROM app.compute_line(...)` ישיר: אותו trigger היה יורה על ה-UPDATE הזה עצמו ודורס את התוצאה בשיעור של היום. הדפוס הזה שומר על **קריאה יחידה** ל-`compute_line()` בכל המערכת ומונע שכפול של לוגיקת בחירת השיעור.

**שכבה 3 — `check (line_total = line_net + line_vat)`:** invariant אריתמטי מדויק, ללא פונקציית עיגול וללא הפניה חוצה-טבלה — ולכן אינו יכול להיכשל בגלל אי-הסכמת עיגול בין JS ל-Postgres.

**למה trigger ולא עמודות `generated`:** `line_vat` תלוי ב-`vat_rate` של **שורת ההורה**, ועמודה generated אינה יכולה להפנות לטבלה אחרת. בנוסף, B7 הוכיח שעמודות generated מתנהגות מלכודתית בתוך `BEFORE UPDATE` (`NEW.signed_total` הוא `NULL`).

**למה גם trigger וגם חישוב בהפקה:** רק-trigger לא מטפל בשינוי שיעור מע"מ בין העריכה להפקה; רק-הפקה שובר את ההבטחה המרכזית של ADR-INV-003 §D1 (**תבנית אחת ל-preview ול-PDF**) — אם ההפקה מתקנת בשקט, המשתמש רואה בתצוגה המקדימה מספרים אחרים מאלה שיודפסו.

**נגזרת ל-UI:** הלקוח **לא מחשב סכומים**. הוא שולח `quantity`, `unit_price`, `discount_percent`, `vat_treatment`, וקורא בחזרה את הערכים המחושבים. כל חישוב כספי ב-JS הוא באג.

**`discount_amount` נגזרת מ-`discount_percent`.** אם יידרש להזין הנחה בשקלים — שינוי בפונקציה אחת, **לא** שתי עמודות קלט מתחרות.

---

## חלופות שנדחו

| שאלה | חלופה | למה נדחתה |
|---|---|---|
| מקור המספר | `SEQUENCE` / `identity` | non-transactional ⇒ חורים במספור בכל rollback. פסול חוקית. |
| מקור המספר | `max(document_number)+1` | race מובהק; דורש `SERIALIZABLE` ו-retries. |
| נעילה | advisory lock | מפזר את הנעילה מחוץ לנתונים. שורת מונה נעולה היא הנעילה **וגם** מקור האמת. |
| אכיפת immutability | הרשאות בלבד | `service_role` וה-SQL Editor עוקפים RLS. Trigger לא נעקף. |
| אכיפת immutability | blacklist | כל עמודה חדשה בעתיד הייתה נפתחת לעריכה בשקט. |
| ערכי שורות | עמודות `generated always as` | `line_vat` תלוי ב-`vat_rate` של ההורה — generated לא חוצה טבלאות. ובנוסף מלכודת ה-`NULL` ב-`BEFORE UPDATE`. |
| ערכי שורות | CHECK מלא שקושר `line_net` ל-`quantity*unit_price` | מפיל כל שמירת טיוטה שבה ה-JS עיגל אחרת מ-Postgres. CHECK שיכול להיכשל על קלט לגיטימי הוא מטרד, לא הגנה. |
| ערכי שורות | חישוב רק בהפקה | שובר את "preview == מסמך מופק" של ADR-INV-003 §D1. |
| שיעור המע"מ בטיוטה | `documents.vat_rate` | dead code — תמיד 0 בטיוטה (A′-1). |
| שיעור המע"מ בטיוטה | `current_date` בלבד | מתעלם מתיארוך אחורה שהמשתמש הזין, ומייצר פער preview↔מסמך שאפשר למנוע (A′-3). |
| ביטול | `status='cancelled'` על מסמך שהופק | הפרה ישירה של "תיקון בזיכוי בלבד". |
| כשל PDF | rollback של ההפקה | חור במספור מסיבה טכנית. פסול. |

---

## Consequences

**חיובי**
- שלוש שכבות בלתי-תלויות שומרות על המספור: שורת מונה נעולה, `unique index`, ו-CHECK שדורש מספר בכל מסמך שאינו טיוטה.
- ה-immutability אינה תלויה באפליקציה — פיתוח עתידי, סקריפט תחזוקה או קונסולת Supabase נחסמים באותה שגיאה.
- Default-deny הופך את הנכונות לתכונה של ה-schema ולא של המשמעת של המפתח.
- **אחרי A-1, "החישוב סמכותי ב-DB" חל על כל המסמך.** אין שום ערך כספי במסמך שמקורו בלקוח.
- **אחרי A′, שכבה 1 ושכבה 2 חולקות כלל זהה לבחירת התאריך** — ה-preview נכון גם בתיארוך אחורה, וההבדל היחיד האפשרי הוא שינוי חקיקה באמצע.
- כשל בצינור ה-PDF הוא אירוע תפעולי בלבד, לא חשבונאי.

**שלילי / חוב טכני**
- **`app.compute_line()` היא נקודת כשל יחידה של כל הכספים במערכת.** דורשת כיסוי טסטים ברמת יחידה (כולל עיגול) ו-review של erp-domain-expert בכל נגיעה.
- **GUC `app.issuing_as_of` הוא coupling סמוי** בין `issue_document()` ל-trigger. הוא transaction-local ולכן בטוח, אבל מי שיקרא רק את ה-trigger לא יבין מאיפה הערך מגיע. מחייב את ההערה שכבר קיימת בשני המקומות.
- **ה-no-op `quantity = quantity` מייצר שורת `audit_log` לכל שורת מסמך בכל הפקה**, עם diff שנראה ריק פרט לעמודות המחושבות. לא באג — למעשה תיעוד נכון של החישוב מחדש — אבל מנפח את ה-audit ומבלבל בקריאה. לתעד ב-UI של ה-audit.
- **`app.recompute_draft_lines()` הוא עקיפה, לא פתרון** (A′-4). כל עוד שורש הבעיה לא תוקן, כל שלב עתידי ב-`issue_document()` שייגע בטבלה עם trigger ישן ייתקל באותו קיר, והפתרון המתבקש יהיה עוד helper. ראה §Implementation Notes #14.
- ה-whitelist ב-D3 דורש עדכון מודע בכל הוספת עמודה — **זו ההתנהגות הרצויה**, אבל תפתיע מפתח שלא קרא את ה-ADR.
- ה-trigger על `document_lines` רץ בכל autosave. זניח בנפח הזה, אך מחייב את ה-UI לרענן ערכים אחרי כתיבה.
- `credited_amount`/`paid_amount` הם denormalized aggregates — בדיקת עקביות לילית מתריעה על פער.
- סירוב הקצאה שורף מספר (Phase 2) — יידרש הסבר לרו"ח.

**השפעה על מודולים אחרים**
- **ADR-INV-003:** הצינור מקבל `document_id` בלבד ומרנדר מהתוכן הקפוא; אידמפוטנטי; אסור לו לכתוב מחוץ ל-whitelist.
- **Frontend:** העורך **לא מחשב סכומים** (D8). בנוסף — שדה `issue_date` בטיוטה הוא כעת בעל משמעות אמיתית: הוא קובע גם את שיעור המע"מ בתצוגה וגם את התאריך והשנה בהפקה.
- **Phase 3 (מבנה אחיד):** רשומות D110 קוראות את שורות המסמך ישירות — A-1 היה מייצר קובץ ביקורת שאינו מסתכם.

---

## Reversal Conditions

- **רו"ח יקבע שאיפוס שנתי נדרש** — שינוי ב-`app.seed_for()` בלבד.
- **רו"ח יקבע שחשבונית עסקה כן דורשת ביטול פורמלי** — הרחבת הרשימה ב-D6.
- **רו"ח יקבע שתיארוך אחורה לשנת מס קודמת מותר/אסור** — B6; כרגע מותר ללא הגבלה מלבד איסור עתיד.
- **יידרש להזין הנחה בשקלים** — שינוי ב-`app.compute_line()` והגדרה מפורשת מי גובר; **לא** שתי עמודות קלט מתחרות.
- **תרחיש שבו נדרש לתקן מסמך שהופק** — הנוהל הוא זיכוי + הפקה מחדש. אם יתברר כבלתי-נסבל, "חלון תיקון" קצר **דורש חוות דעת רו"ח ו-ADR חדש.**
- **מעבר ל-100+ הפקות ביום** — advisory lock ובחינה מחדש של ה-transaction boundary.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | הסיבה |
|---|---|---|
| B1 | סירוב הקצאה שורף מספר ומשאיר שורת `cancelled` ברצף | **חוות דעת רו"ח** |
| B2 | אין שום נתיב לתיקון מסמך שהופק, גם לא בדקה הראשונה | החלטה מוצרית עם חיכוך תפעולי |
| B3 | זיכוי חלקי מותר; זיכוי על זיכוי אסור | **חוות דעת רו"ח** |
| B4 | מסמך `issued` שכשל ב-PDF נשאר תקף ומספרו נצרך | **חוות דעת רו"ח** |
| B5 | *(A-2)* זיכוי רק מול `receipt`/`tax_invoice`/`tax_invoice_receipt` | **חוות דעת רו"ח** |
| B6 | *(A′-2, חדש)* **תיארוך אחורה מותר ללא הגבלה** (רק עתיד נחסם) — כולל לשנת מס קודמת, מה שמכניס מסמך לתקופה שאולי כבר דווחה, ומייצר מספר גבוה עם תאריך מוקדם | **חוות דעת רו"ח.** אם ייאסר — התיקון הוא CHECK על `tax_year` בהפקה |

---

## Implementation Notes

1. **`public.issue_document` הוא ה-RPC היחיד שנחשף** (schema `public`, ADR-INV-001 §D3.3). `grant execute` ל-`authenticated`; `revoke` מ-`public, anon`.

2. **בדיקת race חובה:** 20 קריאות מקבילות על 20 טיוטות של אותו עסק ואותו סוג ⇒ 20 מספרים עוקבים ללא חזרה וללא חור. ב-CI.

3. **בדיקות immutability:** לכל שדה שאינו ב-whitelist — `UPDATE` על מסמך `issued` נכשל, גם ב-`service_role`. וכן `DELETE`, `INSERT` ל-`document_lines` של מסמך שהופק, ו-`UPDATE` על `audit_log`.

4. **בדיקות D8:**
   - INSERT ל-`document_lines` עם ערכים מחושבים **שגויים בכוונה** ⇒ הנקראים בחזרה נכונים.
   - **`sum(line_total)` על מסמך שהופק שווה בדיוק ל-`documents.total_amount`** — בדיקת ה-"foots" הקנונית, על כל אחד מששת סוגי המסמכים.
   - טיוטה תחת 17% שמופקת עם `issue_date` בתקופת 18% ⇒ שורות ו-header שניהם ב-18%.
   - עסק פטור ⇒ `line_vat = 0` בכל שורה גם אם `vat_treatment='standard'` נשלח.
   - מקרי עיגול ל-`app.compute_line()` ברמת יחידה: כמויות שבריריות, הנחות שמייצרות חצי אגורה, ווידוא שסכימת שורות מעוגלות = ה-header.
   - `check (line_total = line_net + line_vat)` נכשל על UPDATE ידני שמפר אותו.

5. **בדיקות `issue_date` (חדשות, A′-2/A′-3):**
   - טיוטה עם `issue_date = <לפני חודשיים>` שמופקת ללא `p_issue_date` ⇒ המסמך יוצא **בתאריך שהוגדר**, לא בתאריך היום, ו-`tax_year` נגזר ממנו.
   - `p_issue_date` מפורש גובר על `documents.issue_date`.
   - `issue_date` עתידי ⇒ `INV_FUTURE_ISSUE_DATE`.
   - שורות טיוטה שנשמרו כשה-`issue_date` בתקופת 17% מציגות 17% **עוד לפני ההפקה** (שכבה 1 קוראת את אותו תאריך).

6. **בדיקת D6:** `credit_note` מול `price_quote`/`proforma_invoice` ⇒ `INV_CREDIT_PARENT_TYPE`; מול שלושת המותרים ⇒ מצליח.

7. **`documents.updated_at` (A-3):** trigger `set_updated_at` ל**כל** UPDATE. `updated_at` ב-whitelist של D3 בדיוק כדי שעדכוני מצב אחרי הפקה ישתקפו. **מתקן את ADR-INV-001 §Implementation Notes #4**, ומתקן באג: `documents_drafts_idx` ממיין לפיו.

8. **מיפוי שגיאות** (`src/lib/errors.ts`): `INV_ALREADY_ISSUED`, `INV_IMMUTABLE_DELETE`, `INV_IMMUTABLE_FIELDS`, `INV_IMMUTABLE_STATUS`, `INV_IMMUTABLE_CHILD`, `INV_TYPE_NOT_ALLOWED`, `INV_PAYMENTS_MISMATCH`, `INV_CREDIT_EXCEEDS_PARENT`, `INV_CREDIT_PARENT_TYPE`, `INV_NO_SIGNING_KEY`, `INV_NO_LINES`, `INV_NO_VAT_RATE`, **`INV_FUTURE_ISSUE_DATE`**, `INV_ALLOCATION_REQUIRED`.

9. **`display_number`** = `number_prefix || document_number::text`. אין padding באפסים.

10. **בדיקת עקביות לילית:** אין חורים ברצף; `credited_amount` תואם ל-`sum()` של הזיכויים; **`sum(line_total)` תואם ל-`total_amount` בכל מסמך שהופק**; אין `issued` ללא `pdf_status='ready'` מעל 24 שעות.

11. **הערת אזהרה בראש `documents`:** "הוספת עמודה כאן חייבת החלטה מודעת — היא immutable אחרי הפקה אלא אם תתווסף ל-whitelist ב-`app.documents_immutable()`."

12. **הערת אזהרה בראש `app.compute_line()`:** "מקור האמת היחיד לכל סכום כספי במערכת. שינוי כאן משנה כל מסמך עתידי — דורש review של erp-domain-expert."

13. **סדר ה-BEFORE triggers על `document_lines`:** Postgres מפעיל לפי סדר אלפביתי של שם ה-trigger. `lines_locked_trg` < `lines_values_compute_trg` ⇒ החוסם יורה ראשון. נכון במימוש; לשמר בכל שינוי שם.

14. **חוב מ-A′-4 — לסגור לפני B13, לא אחריו.** `app.recompute_draft_lines()` קיים רק משום ש-`app.child_rows_locked()` (`0007`) מצהיר `v_status document_status` ללא schema ואין לו `set search_path`, ולכן הוא נשבר כשהוא נורה מתוך פונקציה עם `search_path=''`. העקיפה תקינה ומאושרת, אבל **השורש חייב תיקון**:
    - `create or replace` (ב-migration מתקן — **לא** עריכה של `0007`) על `app.child_rows_locked()` וכל trigger function אחרת מ-`0006`/`0007` שאין לה `set search_path`, עם `set search_path = ''` ושמות מלאים.
    - **כלל חדש:** כל פונקציה ב-`app`/`public` — definer או invoker — חייבת `set search_path` מפורש. פונקציה בלי הצהרה יורשת את ה-search_path של הקורא, וזו בדיוק המלכודת שנתקלנו בה.
    - **בדיקת CI (ח) חדשה** (מתווספת ל-ADR-INV-001 §Implementation Notes #2):
      ```sql
      select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public','app') and p.prokind = 'f'
        and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c
                        where c like 'search\_path=%');
      ```
    - אחרי התיקון, `app.recompute_draft_lines()` יכול להישאר (הוא מבודד יפה את שלב 6א) אך ה-search_path שלו יהודק ל-`''`.

15. **`app.recompute_draft_lines()` אינו נכנס ל-whitelist של ADR-INV-001 §D3.2** — הוא `SECURITY INVOKER` (אומת בקוד), ולכן מחוץ ל-scope של בדיקת CI (ה). כשהוא נקרא מתוך `public.issue_document()` הוא ממילא רץ בהקשר המוגבר של הקורא; כשהוא נקרא ישירות הוא כפוף ל-RLS של `document_lines`, ובנוסף `authenticated` אינו יכול אפילו לנקוב בשמו (אין USAGE על schema `app`). שתי שכבות — אין התנגדות.

16. **טיוטות ננטשות** — טיוטה שלא נגעו בה 180 יום ניתנת למחיקה ע"י ה-owner (רק `draft`). לא מחיקה אוטומטית.
