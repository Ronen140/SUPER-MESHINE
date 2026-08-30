# ADR-INV-002: אי-שינוי מסמכים ומספור רציף

**Date:** 2026-08-30
**Status:** Accepted (2026-08-30, CEO, ע"פ מנדט המייסד ל-Phase 0). שאלות הרו"ח (B1-B4) פתוחות — משפיעות על התנהגות, לא על מבנה; ייסגרו לפני production.
**Decider:** Architect (proposed), CEO (final approval)
**Related:** ADR-INV-001 (schema, RLS), ADR-INV-003 (PDF וחתימה)

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
-- בתוך app.issue_document(), ב-transaction אחד:
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

**למה לא `SEQUENCE`:** רצפים ב-Postgres הם non-transactional במכוון — `nextval` לא חוזר אחורה ב-`ROLLBACK`. כל כשל אחרי שליפת המספר (validation, כשל רשת, deadlock) היה מייצר **חור במספור** — הפרה ישירה של הדרישה החוקית. שורת מונה בטבלה רגילה נעולה ומגולגלת אחורה יחד עם ה-transaction. הסריאליזציה שזה כופה (עסק+סוג+שנה) היא בדיוק ההתנהגות הרצויה, והמחיר שלה בנפח של ~2 מסמכים/חודש הוא אפס.

**למה `UPDATE ... RETURNING` ולא `SELECT ... FOR UPDATE` ואז `UPDATE`:** משפט אחד, נעילה אטומית, אין חלון בין קריאה לכתיבה. פשוט וללא race מעצם המבנה.

**`app.seed_for()`** מיישם את D9 של ADR-INV-001: במצב `continuous` מחזיר את `next_number` של השנה הקודמת (או 1); במצב `yearly` מחזיר את `start_number` המוגדר לעסק.

**ערובת ה-DB:** `unique index documents_number_uk on documents (business_id, type, tax_year, document_number)`. גם אם המונה ייכשל, שני מסמכים לא יוכלו לשאת אותו מספר — שגיאת unique תגלגל את ה-transaction.

### D2 — ההפקה היא פונקציה אחת ב-`SECURITY DEFINER`; אין נתיב שני

```sql
create or replace function app.issue_document(p_document_id uuid, p_issue_date date default null)
returns documents
language plpgsql security definer set search_path = public, pg_temp
as $$ ... $$;
```

הרצף בתוך ה-transaction, לפי הסדר:

1. `select ... from documents where id = p_document_id for update` — נעילת המסמך.
2. **אימות חברות והרשאה:** `app.has_role(business_id, {'owner','editor'})`. הפונקציה היא definer ולכן RLS לא מגן עליה — האימות מפורש וחובה.
3. **אימות מצב:** `status = 'draft'`, אחרת `raise exception 'INV_ALREADY_ISSUED'`.
4. **רענון `business_entity_type`** מתוך `businesses` (המסמך נולד משפטית עכשיו).
5. **אימותי תוכן:** יש לפחות שורה אחת; יש `customer_id`; טיפוס מותר לסוג הישות; פטור ⇒ מע"מ 0; `credit_note` ⇒ יש `parent_document_id` + `credit_reason` + האב `issued` + האב באותו עסק + `parent.credited_amount + total ≤ parent.total_amount`; מסמכי תקבול (`receipt`, `tax_invoice_receipt`) ⇒ `sum(payments.amount) = payable_amount`.
6. **חישוב מחדש של כל הסכומים** מתוך `document_lines` ו-`vat_rates` לפי `issue_date`. דורס כל מה שהלקוח שלח.
7. **קיבוע snapshots:** `customer_snapshot`, `business_snapshot` (D4).
8. **הקצאת המספר** (D1) + `display_number`, `tax_year = extract(year from issue_date)`.
9. **מעבר סטטוס** ל-`issued` (או `pending_allocation` ב-Phase 2, D5), `issued_at = now()`, `issued_by = auth.uid()`, `pdf_status = 'pending'`.
10. **עדכון האב** בזיכוי: `credited_amount += total_amount`.
11. `audit_log` נכתב אוטומטית ע"י ה-trigger; בנוסף שורה מפורשת עם `action='issue'`.

`COMMIT`. **מכאן ואילך המסמך קיים משפטית.** הפקת ה-PDF מתרחשת מחוץ ל-transaction.

**כלל אכיפה:** אין ל-`authenticated` שום policy שמאפשרת `UPDATE documents SET status = 'issued'` — הפונקציה היא הנתיב היחיד (ראה D3).

### D3 — אי-שינוי נאכף ב-trigger ב-DB, עם whitelist מפורש ו-**default deny**

```sql
create or replace function app.documents_immutable()
returns trigger language plpgsql as $$
declare
  allowed text[] := array[
    -- מצב PDF וחתימה (רק כל עוד ה-PDF לא הושלם)
    'pdf_status','pdf_original_path','pdf_copy_path','pdf_sha256',
    'signing_key_id','signed_at','pdf_attempts','pdf_error',
    -- מצב מסירה
    'sent_at','sent_to','delivery_mode',
    -- מצב נגזר: תשלום וזיכוי
    'paid_amount','credited_amount','settled_at',
    -- Phase 2: תוצאת ההקצאה
    'allocation_number','allocation_request_id','status',
    -- הערה פנימית שאינה מודפסת
    'internal_note','updated_at'
  ];
  before_j jsonb; after_j jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'INV_IMMUTABLE_DELETE: מסמך שהופק אינו נמחק (מסמך %)', old.display_number;
  end if;

  -- PDF שהושלם — קפוא לחלוטין
  if old.pdf_status = 'ready' then
    allowed := allowed - array['pdf_status','pdf_original_path','pdf_copy_path',
                               'pdf_sha256','signing_key_id','signed_at','pdf_attempts','pdf_error'];
  end if;

  -- status: רק pending_allocation -> issued|cancelled מותר
  if new.status is distinct from old.status
     and not (old.status = 'pending_allocation' and new.status in ('issued','cancelled')) then
    raise exception 'INV_IMMUTABLE_STATUS: מעבר סטטוס % -> % אסור', old.status, new.status;
  end if;

  before_j := to_jsonb(old) - allowed;
  after_j  := to_jsonb(new) - allowed;
  if before_j is distinct from after_j then
    raise exception 'INV_IMMUTABLE_FIELDS: שינוי אסור במסמך % — שדות: %',
      old.display_number, (select string_agg(key,', ') from jsonb_each(after_j)
                           where value is distinct from before_j->key);
  end if;
  return new;
end $$;

create trigger documents_immutable_trg
  before update or delete on documents
  for each row when (old.status <> 'draft')
  execute function app.documents_immutable();
```

**התכונה החשובה ביותר: default deny.** ההשוואה היא של כל השורה פחות ה-whitelist. **עמודה שתתווסף בעתיד תהיה immutable אוטומטית** אלא אם מישהו יוסיף אותה ל-whitelist במפורש — כלומר בטעות אי אפשר לפרוץ את החומה, רק בכוונה מתועדת. ההיפך (blacklist) היה נכשל בכל migration עתידי.

**נימוק לשדות ה-whitelist:**

| שדה | למה מותר לשנות אחרי הפקה |
|---|---|
| `pdf_*`, `signed_at`, `signing_key_id` | ה-PDF הוא **רינדור** של המסמך, לא המסמך. עד ש-`pdf_status='ready'` הצינור עדיין רץ/נכשל/חוזר. אחרי `ready` — נעול גם הוא (ראה הסרת ה-whitelist בקוד). |
| `paid_amount`, `settled_at` | מצב הגבייה הוא עובדה חיצונית מאוחרת, לא תוכן המסמך. |
| `credited_amount` | מתעדכן כשמופק זיכוי נגד המסמך. |
| `sent_at`, `sent_to`, `delivery_mode` | מטא-דאטה של מסירה. |
| `allocation_number`, `status` | Phase 2 בלבד ורק במעבר המבוקר של D5. |
| `internal_note` | אינו מודפס ואינו חלק מהמסמך. |

**טריגרים מקבילים על `document_lines` ו-`payments`:**
```sql
create trigger lines_locked_trg before insert or update or delete on document_lines
  for each row execute function app.child_rows_locked();   -- בודק parent.status <> 'draft' ⇒ exception
```
חריג יחיד: `app.issue_document()` (definer) מריצה את חישוב הסכומים **לפני** מעבר הסטטוס, ולכן ה-trigger לא מפריע.

**`audit_log` — trigger נפרד** שמעלה exception על כל `UPDATE`/`DELETE`, ללא whitelist וללא חריגים. בשונה מ-ADR-006, כאן גם אין `audit_admin` role: אין דרישת מחיקה (GDPR erasure אינו רלוונטי — מסמכי חשבונאות חסינים מפני מחיקה גם תחת חוק הפרטיות).

**`allocation_requests`** — trigger שחוסם `UPDATE` אחרי ש-`responded_at is not null`, ו-`DELETE` תמיד. תשובת רשות המסים היא ראיה.

### D4 — Snapshot מלא בהפקה: המסמך אינו קורא נתונים חיים

בהפקה מקובעים שלושה סוגי snapshot:

1. **`document_lines.name` + `.description`** — כבר מועתקים משורת הקטלוג בזמן העריכה (`item_id` נשמר כהפניה בלבד, לצורך סטטיסטיקה). שינוי או מחיקה של פריט בקטלוג אינם נוגעים במסמכים.
2. **`customer_snapshot jsonb`** — `{name, tax_id, tax_id_type, address_line1, address_line2, city, postal_code, country, email, phone}` כפי שהיו ברגע ההפקה.
3. **`business_snapshot jsonb`** — `{legal_name, entity_type, tax_id, address..., phone, email, logo_path, accent_color, invoice_footer_note}`.

**למה snapshot ולא היסטוריית גרסאות (SCD-2) על `customers`/`businesses`:** גרסאות היו נכונות אילו היינו צריכים לשאול "איך נראה הלקוח ב-2027"; אנחנו צריכים בדיוק דבר אחד — "מה כתוב על המסמך". `jsonb` על שורת המסמך נותן את זה בקריאה אחת ללא join, שורד מחיקה של הלקוח, והוא בדיוק המבנה שצינור ה-PDF (ADR-INV-003) צורך כדי לרנדר מחדש מסמך היסטורי בצורה דטרמיניסטית.

**המחיר:** נתונים משוכפלים. מקובל — ~1KB למסמך, ~24KB לשנה לעסק.

**כלל ברזל לרינדור:** תבנית ה-PDF קוראת **אך ורק** מ-`documents` + `document_lines` + `payments` + ה-snapshots. אסור לה לעשות join ל-`customers`/`businesses`/`items`. אכיפה: ה-loader של תבנית המסמך יושב בקובץ אחד, ובדיקת code review מוודאת שאין בו את שמות הטבלאות האלה. **הלוגו הוא החריג היחיד** — הוא נטען מ-`business_snapshot.logo_path`, שהוא נתיב אחסון immutable (ADR-INV-003 קובע שקבצי לוגו לא נדרסים אלא נכתבים בנתיב חדש בכל העלאה).

### D5 — סטטוסים: מכונת מצבים סגורה

```
                     ┌────────────────────────────────────────────┐
                     │                                            │
  draft ──issue()──▶ │ pending_allocation (Phase 2, מעל הסף בלבד) │
    │                └──────┬──────────────────────┬──────────────┘
    │                       │ אושר                 │ סורב / כשל סופי
    │                       ▼                      ▼
    └────issue()──────▶  issued              cancelled
         (מתחת לסף /                            (המספר נצרך ונשמר —
          לא רלוונטי)                            אין חור ברצף)
                             │
                             │ תיקון/ביטול = מסמך נגדי
                             ▼
                     credit_note חדש (issued) עם parent_document_id
```

**שלושת הכללים החדים:**

1. **`issued` הוא מצב סופי.** מסמך שהופק **לעולם** לא עובר ל-`cancelled`. ה-trigger ב-D3 אוכף זאת מכנית.
2. **"מבוטל" הוא תכונה נגזרת, לא סטטוס.** מסמך נחשב מבוטל כאשר `credited_amount = total_amount`. ה-UI מציג "בוטל בזיכוי #NNN"; ה-DB לא משנה דבר.
3. **`cancelled` שמור למקרה אחד בלבד:** מסמך שצרך מספר אך לא הפך למסמך תקף — כלומר סירוב סופי של מספר הקצאה (Phase 2). המספר נשאר תפוס והשורה נשמרת עם `credit_reason`/`internal_note` המסביר, כדי שמבקר יראה רצף ללא חורים. **מסמך `cancelled` לא נשלח, לא מקבל PDF חתום, ואינו נכלל בדוחות** (הוא מסונן ב-`signed_total` ע"י `status = 'issued'`).

`'pending_allocation'` נוסף ל-enum ב-Phase 2 (`ALTER TYPE ... ADD VALUE` — additive, לא breaking). ב-Phase 0/1 מכונת המצבים היא `draft → issued` בלבד.

**סדר קריטי ב-Phase 2 שחייב להיקבע כאן:** ה-API של רשות המסים דורש את **מספר החשבונית** כחלק מגוף הבקשה. כלומר `issue_document()` חייבת להקצות את המספר **לפני** הפנייה. לכן מסמך מעל הסף עובר `draft → pending_allocation` (מספר מוקצה, snapshot קפוא, לא נשלח ללקוח), ורק תשובת ה-API קובעת `issued` או `cancelled`. **סירוב שורף מספר** — זו עלות בלתי נמנעת של סדר הפעולות שהרשות כפתה, והפתרון הוא לשמר את המספר עם רשומה מוסברת ולא לנסות "למחזר" אותו.

### D6 — זיכוי: מסמך נגדי מקושר, בכיוון אחד

- `credit_note` הוא מסמך רגיל לכל דבר: מספר מסדרה משלו, snapshot, PDF חתום, immutable.
- `parent_document_id` חובה; FK מורכב `(parent_document_id, business_id)` מונע קישור חוצה-עסקים ברמת ה-DB.
- `credit_reason` חובה (טקסט חופשי, מודפס על המסמך).
- **זיכוי חלקי נתמך:** `parent.credited_amount + credit.total_amount ≤ parent.total_amount`, נבדק ב-`issue_document()` תחת `for update` על האב.
- **אין שרשור:** אסור זיכוי על זיכוי. `parent.type <> 'credit_note'`.
- **זיכוי על קבלה** גורר שורות `payments` עם סכומים **שליליים** המשקפים את החזר התקבול. `payment_amount_nonzero` מתיר זאת; `issue_document()` דורשת `sum(payments) = -payable_amount` בזיכוי מול מסמך תקבול.
- **הסכומים בזיכוי חיוביים**; הסימן החשבונאי מגיע מ-`signed_total` (ADR-INV-001).
- **כותרת המסמך** נגזרת: "חשבונית זיכוי" מול חשבונית מס, "הודעת זיכוי" מול קבלה/חשבונית עסקה או כשהעסק פטור.

### D7 — הפקת ה-PDF מחוץ ל-transaction; כשל PDF אינו מבטל הפקה

`issue_document()` מסתיימת ב-`pdf_status='pending'`. הנתיב באפליקציה קורא מיד לצינור (ADR-INV-003). אם הצינור נכשל: `pdf_status='failed'`, `pdf_attempts++`, `pdf_error`, ו-cron חוזר ומנסה.

**המסמך נשאר `issued`.** נימוק: המסמך נוצר משפטית בהקצאת המספר ובקיבוע התוכן; ה-PDF הוא רינדור שלו. לגלגל אחורה הפקה בגלל כשל Chromium היה מייצר חור במספור בגלל תקלה טכנית — בדיוק מה שאסור. הצינור **אידמפוטנטי** כי ה-snapshot קפוא: כל ריצה חוזרת מייצרת אותו מסמך.

ה-UI מציג באנר "המסמך הופק (מספר NNN). קובץ ה-PDF בהכנה" ומונע שליחה עד `ready`.

---

## חלופות שנדחו

| שאלה | חלופה | למה נדחתה |
|---|---|---|
| מקור המספר | `SEQUENCE` / `identity` | non-transactional ⇒ חורים במספור בכל rollback. פסול חוקית. |
| מקור המספר | `max(document_number)+1` בקריאה | race מובהק; דורש `SERIALIZABLE` והתמודדות עם retries. |
| נעילה | advisory lock פר עסק+סוג | עובד, אבל מפזר את הנעילה מחוץ לנתונים ולא נאכף ע"י ה-DB אם מישהו יעקוף. שורת מונה נעולה היא הנעילה **וגם** מקור האמת. |
| אכיפת immutability | הרשאות בלבד (אין policy UPDATE) | `service_role` וה-SQL Editor עוקפים RLS. Trigger לא נעקף. |
| אכיפת immutability | blacklist של שדות אסורים | כל עמודה חדשה בעתיד הייתה נפתחת לעריכה בשקט. default-deny הוא ההפך. |
| שימור היסטוריה | SCD-2 / temporal tables על `customers` | פותר בעיה שאין לנו (שאילתות "כפי שהיה בתאריך") במחיר של join היסטורי בכל רינדור. |
| ביטול | `status='cancelled'` על מסמך שהופק | הפרה ישירה של "תיקון בזיכוי בלבד". |
| כשל PDF | rollback של ההפקה | חור במספור מסיבה טכנית. פסול. |

---

## Consequences

**חיובי**
- שלוש שכבות בלתי-תלויות שומרות על המספור: שורת מונה נעולה, `unique index`, ו-CHECK שדורש מספר בכל מסמך שאינו טיוטה.
- ה-immutability אינה תלויה באפליקציה. פיתוח עתידי, סקריפט תחזוקה או קונסולת Supabase — כולם נחסמים באותה שגיאה.
- Default-deny ב-trigger הופך את הנכונות לתכונה של ה-schema ולא של המשמעת של המפתח.
- ה-snapshots הופכים כל מסמך למכל עצמאי — שינוי לוגו, שינוי כתובת או מחיקת לקוח לא נוגעים בהיסטוריה, וייצוא מבנה אחיד (Phase 3) קורא מטבלה אחת.
- כשל בצינור ה-PDF הוא אירוע תפעולי בלבד, לא אירוע חשבונאי.

**שלילי / חוב טכני**
- הפקה מסריאליזציה פר `(business, type, year)`. חסר משמעות ב-2 מסמכים/חודש; היה צוואר בקבוק ב-100 הפקות/שנייה.
- ה-whitelist ב-D3 הוא מקום שדורש עדכון מודע בכל הוספת עמודה — אם שוכחים, migration שמעדכן את העמודה החדשה על מסמכים קיימים ייכשל. **זו ההתנהגות הרצויה**, אבל היא תפתיע מפתח שלא קרא את ה-ADR. יש להוסיף הערה בראש הגדרת הטבלה.
- `credited_amount` ו-`paid_amount` הם denormalized aggregates. אם ייפול חישוב, יהיה פער מול הסכימה בפועל. הפחתה: בדיקת עקביות לילית שמשווה מול `sum()` ומתריעה (לא מתקנת אוטומטית).
- סירוב הקצאה שורף מספר (Phase 2). בלתי נמנע בהינתן סדר הפעולות שה-API כופה, אך יידרש הסבר לרו"ח.
- הודעות השגיאה מה-trigger מגיעות ללקוח כשגיאת Postgres. נדרש מיפוי קודים (`INV_*`) להודעות עברית ב-UI.

**השפעה על מודולים אחרים**
- **ADR-INV-003:** הצינור מקבל `document_id` בלבד ומרנדר מה-snapshot; חייב להיות אידמפוטנטי; אסור לו לכתוב לשדות מחוץ ל-whitelist.
- **Phase 2 (הקצאה):** מכונת המצבים כבר מגדירה את המקום שלה. הקוד יוסיף ערך enum + ענף ב-`issue_document()` — לא שינוי מבני.
- **Phase 3 (דוחות ומבנה אחיד):** כל סכימה חייבת `sum(signed_total) where status='issued'`. מסמכי `cancelled` ו-`draft` מסוננים תמיד.
- **Frontend:** העורך פועל על טיוטה ומבצע autosave חופשי; "הפקה" היא RPC יחיד שאין לו undo. ה-UI חייב דיאלוג אישור מפורש שמציג את המספר הצפוי ואת הסכום.

---

## Reversal Conditions

- **רו"ח יקבע שאיפוס שנתי נדרש** (או שהמספור חייב להיות רציף גם על פני סוגי מסמכים) — שינוי ב-`app.seed_for()` בלבד; ה-schema תומך בשניהם.
- **רו"ח יקבע ש"קבלת זיכוי" חייבת סדרת מספור נפרדת** — הוספת ערך enum + שורת מונה. משנה את ADR-INV-001 §D2.
- **תרחיש שבו נדרש לתקן מסמך שהופק** (למשל טעות בח.פ של הלקוח שהתגלתה מיד) — הנוהל הנכון הוא זיכוי + הפקה מחדש. אם יתברר שהוא בלתי-נסבל תפעולית, נשקול "חלון תיקון" של דקות ספורות לפני שליחה — **החלטה כזו דורשת חוות דעת רו"ח ותיעוד ב-audit, ולא תתקבל בלי ADR חדש.**
- **סירובי הקצאה יהפכו לשכיחים** ויתחילו לשרוף מספרים בכמות מביכה — נשקול הקצאת מספר "מותנה" עם דחיית ההצמדה, בכפוף לכך שרשות המסים מאפשרת זאת.
- **מעבר ל-100+ הפקות ביום** — נשקול נעילת advisory במקום נעילת שורה, ובחינה מחדש של ה-transaction boundary.

---

## החלטות הדורשות אישור CEO/מייסד

| # | ההחלטה | הסיבה |
|---|---|---|
| B1 | סירוב הקצאה שורף מספר ומשאיר שורת `cancelled` ברצף | **חוות דעת רו"ח** — האם זה מקובל בביקורת |
| B2 | אין שום נתיב לתיקון מסמך שהופק, גם לא בדקה הראשונה | החלטה מוצרית עם חיכוך תפעולי אמיתי |
| B3 | זיכוי חלקי מותר; זיכוי על זיכוי אסור | **חוות דעת רו"ח** |
| B4 | מסמך `issued` שכשל ב-PDF נשאר תקף ומספרו נצרך | **חוות דעת רו"ח** — מסמך תקף שאין לו עדיין קובץ |

---

## Implementation Notes

1. **`app.issue_document` היא RPC יחיד שנחשף** (`supabase.rpc('issue_document', {...})`). אין endpoint אחר שמשנה `status`. `grant execute` ל-`authenticated` בלבד; `revoke` מ-`anon`.

2. **בדיקת race חובה ב-DoD של Phase 1:** 20 קריאות מקבילות ל-`issue_document()` על 20 טיוטות של אותו עסק ואותו סוג. התוצאה הנדרשת: 20 מספרים עוקבים ללא חזרה וללא חור. בדיקה זו רצה ב-CI.

3. **בדיקות immutability חובה:** לכל שדה שאינו ב-whitelist — ניסיון `UPDATE` ישיר על מסמך `issued` חייב להיכשל; גם ב-`service_role`. וכן ניסיון `DELETE`, ניסיון `INSERT` ל-`document_lines` של מסמך שהופק, וניסיון `UPDATE` על `audit_log`.

4. **מיפוי שגיאות:** קודי `INV_*` (`INV_ALREADY_ISSUED`, `INV_IMMUTABLE_DELETE`, `INV_IMMUTABLE_FIELDS`, `INV_IMMUTABLE_STATUS`, `INV_TYPE_NOT_ALLOWED`, `INV_PAYMENTS_MISMATCH`, `INV_CREDIT_EXCEEDS_PARENT`, `INV_ALLOCATION_REQUIRED`) → מילון עברית אחד ב-`src/lib/errors.ts`.

5. **`display_number`** מחושב בפונקציה: `number_prefix || document_number::text`. אין padding באפסים כברירת מחדל (מונע בלבול "0012 מול 12"), והוא נשמר כמחרוזת כדי שהמסמך יידע לתמיד איך הוא מוצג.

6. **בדיקת עקביות לילית** (GitHub Actions, יחד עם ה-keepalive של ADR-INV-003): מוודאת לכל עסק שאין חורים ברצף (`document_number` עוקב לכל `type`+`tax_year`), ש-`credited_amount` תואם ל-`sum()` של הזיכויים, ושאין מסמך `issued` ללא `pdf_status='ready'` מעל 24 שעות. פלט לדוא"ל של המייסד.

7. **הערת אזהרה בראש הגדרת `documents`** (בקובץ ה-schema ובקובץ ה-Drizzle): "הוספת עמודה כאן חייבת החלטה מודעת — היא immutable אחרי הפקה אלא אם תתווסף ל-whitelist ב-`app.documents_immutable()`. ראה ADR-INV-002 §D3."

8. **טיוטות ננטשות** — טיוטה שלא נגעו בה 180 יום ניתנת למחיקה ע"י ה-owner (רק `draft`; ה-trigger מבטיח את השאר). לא מחיקה אוטומטית — רק הצעה ב-UI.
