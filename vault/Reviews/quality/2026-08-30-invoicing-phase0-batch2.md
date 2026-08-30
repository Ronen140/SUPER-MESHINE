# Code Quality Review: Invoicing Phase 0 — Batch 2 (B5-B8)

**תאריך:** 2026-08-30 11:15
**Base SHA:** ae24c22 (app shell and auth flow — F1-F2, last commit before batch 2 work)
**Head SHA:** 8741ea8 (batch 2 verification artifacts in progress — current HEAD)
**Spec:** `vault/Engineering/invoicing-phase-0-plan.md` (Revision 3, subtasks B5-B8); `invoicing-receipts/docs/adr/001-data-model-and-rls.md` (כולל Amendment A); `invoicing-receipts/docs/adr/002-immutability-and-numbering.md`
**Spec-reviewer:** ✅ (round #1) — `vault/Reviews/spec/2026-08-30-invoicing-phase0-batch2.md`
**סבב code-quality-reviewer:** #1
**Security checklist:** הופעל — ה-diff נוגע ב-RLS policies (`CREATE POLICY` נרחב ב-`0005_rls_policies.sql`), audit log (`0006_audit.sql`), ובידוד רב-עסקי (`business_id`, המקבילה הפרויקטלית ל-`tenant_id`).

## תוצאה: ⚠️ judgment-needed

**Severity counts:** 🔴 0 | 🟡 1 | 🟢 1

הבסיס הטכני של ה-batch מצוין ואומת אמפירית במלואו (ראה למטה) — אין שום ממצא חוסם. ה-⚠️ נובע משאלה ארכיטקטונית פתוחה אחת בתחום "נכונות חישובית" שה-CEO ביקש להתמקד בה במפורש (מוקד #4), ושמקורה בפרשנות תקפה אך לא-סגורה של הנוסח המילולי של ADR-INV-002 §D2 צעד 6. זו לא טעות מימוש — זו שאלת היקף/ADR שדורשת הכרעת ארכיטקט לפני שה-Phase 1 PDF renderer נבנה על גביה.

## Strengths

- **הקצאת מספור נבדקה אמפירית תחת race אמיתי, לא רק בקריאת קוד.** הרצתי 20 קריאות מקבילות בפועל ל-`app.issue_document()` (20 session נפרדים, `pg_sleep` לסנכרון) מול Postgres 16 מקומי עם כל 5 המיגרציות (`0004`-`0008`) מותקנות. התוצאה: `document_number` 1-20 בדיוק, ללא חור וללא כפילות — התאמה מדויקת ל-DoD שמוגדר ל-B12 (עדיין לא מומש כ-test file בבטא זו, אבל ההתנהגות שהוא אמור לאמת כבר נכונה).
- **race על עדכון `credited_amount` באב נבדק אמפירית ונמצא תקין.** הרצתי שני `issue_document()` מקבילים לשני `credit_note` כנגד אותו מסמך אב (59.00 כל אחד, סה"כ שווה בדיוק ל-`total_amount`=118.00 של האב). התוצאה: `credited_amount` הסתיים ב-118.00 בדיוק (לא lost update, לא double-count) — נעילת ה-`for update` על האב (`0008_issue_function.sql:138`) עובדת כמתוכנן.
- **חמשת בדיקות ה-CI המוגדרות ב-ADR-INV-001 Implementation Notes #2 (א-ה) הורצו בפועל מול ה-DB לאחר כל המיגרציות — כולן מחזירות 0 שורות** (RLS מופעל בכל 15 טבלה; FORCE בדיוק על `business_signing_keys`; מפת ה-scoping בת 4 הקטגוריות; whitelist ה-`SECURITY DEFINER` הסגור — `handle_new_auth_user` עלה כצפוי, זהו הממצא שכבר הוסלם לארכיטקט, לא נספר שוב). כמו כן נוספה שאילתת בדיקה (ד) — audit trigger על כל טבלה רלוונטית כולל `businesses` — גם היא 0 שורות.
- **בידוד RLS נבדק אמפירית עם שני משתמשים/שני עסקים אמיתיים**, לא רק בקריאת policy: SELECT על עסק זר מסונן; UPDATE על עסק זר משפיע על 0 שורות; INSERT ישיר ל-`businesses` נחסם (`new row violates row-level security policy`); DELETE מה-`businesses` של עצמך נחסם (אין policy כלל, בדיוק כמתוכנן); `customers` של עסק זר לא נראים.
- **`EXPLAIN` בפועל מאשר את טענת ה-initplan caching בהערות הקוד:** `app.current_business_ids()` מתוכנן כ-`SubPlan` יחיד עם hash (מחושב פעם אחת לכל statement), לא per-row — בדיוק כפי שההערה ב-`0004_rls_helpers.sql:12` (`STABLE` functions) טוענת.
- **כל שרשרת ה-immutability/audit נבדקה אמפירית ולא רק נקראה:** שינוי שדה לא-ברשימה במסמך `issued` → `INV_IMMUTABLE_FIELDS`; שינוי שדה מותר (`paid_amount`) → מצליח **וגם** יוצר שורת `audit_log` עם `before`/`after` נכונים (0.00→10.00); `DELETE` על מסמך `issued` → `INV_IMMUTABLE_DELETE`; `INSERT` ל-`document_lines` של מסמך `issued` → `INV_IMMUTABLE_CHILD`; `UPDATE audit_log` → `INV_AUDIT_IMMUTABLE` (גם כ-`postgres`, ללא bypass); הפקה כפולה → `INV_ALREADY_ISSUED`; זיכוי שחורג מהיתרה → `INV_CREDIT_EXCEEDS_PARENT`.
- **תיעוד קוד ברמה גבוהה במיוחד.** כל אחד מ-5 המקרים ש"אומתו אמפירית" (לא הונחו) ע"י ה-implementer בהערות (`0007_immutability.sql`) — אופרטור `text[] - text[]` לא קיים, generated column לא נראה ל-`NEW` ב-`BEFORE` trigger, cast ל-`text` להשוואת ערך enum שטרם קיים, MVCC visibility ב-cascade delete, ו-`schema USAGE` מול `EXECUTE` ל-`app.*` — כולם אומתו כאן שוב באופן עצמאי ונמצאו נכונים. זו בדיוק רמת התיעוד הנדרשת לקוד שאמור לשרוד 3 שנים בלי מי שכתב אותו.
- `src/lib/errors.ts`/`errors.test.ts` — מיפוי נקי, כולל אישור מפורש (לא הסתרה) של קודים שאינם מוזכרים מילולית ב-ADR ("flagged for review"), וטסטים שמכסים happy path, קוד לא-מוכר, ו-null/undefined.
- `pnpm test` (39/39), `pnpm typecheck`, `pnpm lint` — כולם ירוקים.

## Quality Checklist

### A. Naming & Structure
- [x] שמות פונקציות/policies תיאוריים (`app.documents_immutable`, `customers_read`/`customers_write`).
- [x] גודל קבצים סביר — הקובץ הגדול ביותר בבatch (`0008_issue_function.sql`) הוא 380 שורות, מתחת לסף ה-400.
- [x] אחריות ברורה לכל migration — כל קובץ עושה דבר אחד (helpers / policies / audit / immutability / issue function).

### B. Type Safety
- [x] אין `any`/`as` רלוונטי (SQL/PL-pgSQL — כל הפרמטרים טיפוסיים: `uuid`, `document_type`, `date`, `bigint`).
- [x] כל פונקציה ציבורית מקבלת טיפוסים מדויקים; Postgres דוחה קלט לא-תואם בזמן קריאה (מקביל ל-zod ב-boundary).
- [x] `errors.ts` — `Record<string, string>`, אין `any`.

### C. Error Handling
- [x] כל `raise exception` נושא קוד `INV_*` + `errcode = 'P0001'`, לא הודעה גנרית.
- [x] הודעות actionable — כוללות מזהה מסמך/עסק ופרטי ההפרה, לא רק "error".
- [x] `toUserMessage()` — fallback גנרי ל-null/undefined/קוד לא-מוכר, לא חושף שגיאת Postgres גולמית ללקוח.
- [x] אין `catch` ריק — כל האכיפה קורית ב-DB triggers, אין קוד אפליקציה בסקופ ה-batch הזה שבולע שגיאות.

### D. Database Queries
- [x] הקצאת המספר ב-`UPDATE ... RETURNING` (לא `SEQUENCE`) — אומת race-safe אמפירית (20/20 עוקבים).
- [x] אין N+1 — אין לולאות על קלט משתמש בפונקציות האלה.
- [x] אינדקסים קיימים על עמודות ה-`WHERE` הרלוונטיות (`documents_number_uk`, `documents_drafts_idx` וכו', מ-batch 1 — לא השתנו כאן).
- [x] אין שימוש ב-service_role client בקבצים האלה — כל האכיפה היא `SECURITY DEFINER` צר (whitelist סגור, אומת ב-CI check ה).
- [x] Transaction אטומי סביב mutation+audit — כל `app.issue_document()`/`app.set_start_number()` הוא פונקציה אחת = transaction אחד; ה-audit נכתב אוטומטית ע"י ה-trigger באותה עסקה, לא בקריאה נפרדת.
- [ ] **🟡 `documents.updated_at` אינו מתעדכן — לא ב-draft, לא בהפקה, לא בעדכוני post-issue** (ראה Issues).

### E. Performance
- [x] אין O(n²)/unbounded loop.
- [x] `EXPLAIN` מאשר `SubPlan` יחיד (hashed) ל-`app.current_business_ids()` — לא נקרא per-row.

### F. Tests
- [x] `errors.test.ts` מכסה happy path, unknown code, null/undefined — התנהגות, לא implementation details.
- [x] `no-restricted-imports.test.ts` מריץ Biome אמיתי מול fixture — לא מדמה את הכלל, אלא מוכיח שהוא עדיין קיים.
- [x] `pnpm test` ירוק (39/39).
- **n/a לבatch זה:** `isolation.test.ts`/`numbering-race.test.ts` הם B11/B12 — subtasks נפרדים בתוכנית, לא בסקופ B5-B8. אימתתי ידנית את שתי ההתנהגויות שהם אמורים להוכיח (ראה Strengths) כדי לא לסמוך על הצהרת ה-implementer בלבד.

### G. Comments
- [x] הערות רק היכן שה-WHY לא ברור מהקוד — ורמה גבוהה מהרגיל של תיעוד "אומת אמפירית, לא הונח" לכל אחד מ-5 הסטיות מהניסוח המילולי של ה-ADR.
- [x] אין TODO/FIXME ללא בעלים — ה"flagged for review" ב-`errors.ts` וה"judgment call, לא נבדק ב-Phase 0" ב-`app.seed_for()` הם גילוי-נאות מפורש, לא הסתרה.

### H. Dead Code
- [x] אין פונקציה שאף אחד לא קורא לה.
- [x] אין `if (false)`/בלוקים מוערים.
- [x] אין תכונה חצי-מחוברת בסקופ ה-batch.

## Security Checklist

### 1. Auth
- [n/a] ה-diff הזה לא נוגע בזרימות login/JWT/refresh/logout עצמן — אלו ב-F1/F2 (נסקרו בנפרד). `auth.uid()` נקרא כאן רק לצורך RBAC/audit, לא מיושם מחדש.
- [x] אין hashing מותאם-אישית של סיסמאות — לא רלוונטי לקבצים האלה כלל.
- [x] אין credentials מודלפים ל-log/audit — `audit_log` שומר `actor_email` בלבד (לא סיסמה/טוקן).

### 2. Multi-Tenancy (business_id — המקבילה הפרויקטלית ל-tenant_id)
- [x] כל query על טבלה עם `business_id` מוגן ב-RLS דרך `app.current_business_ids()`/`app.has_role()` — אומת אמפירית (Strengths).
- [x] `businesses` (scope-root, ללא `business_id` משלה) מקבלת RLS מקביל לפי `id` — SELECT+UPDATE בלבד, ללא INSERT/DELETE — אומת.
- [x] אין query חוצה-עסק ללא הערה+אישור — לא נמצא אחד.
- [x] אין שימוש ב-service_role client בקבצים האלה כלל.
- [x] FORCE ROW LEVEL SECURITY מוחל רק על `business_signing_keys` — אומת מול `pg_class.relforcerowsecurity` בפועל.

### 3. RBAC (member_role: owner/editor/viewer/accountant)
- [x] כל mutation policy/function בודקת `app.has_role()` לפני כתיבה (`documents_write`, `app.issue_document`, `app.set_start_number`).
- [x] אין `default: allow` — ה-whitelist ב-`app.documents_immutable()` הוא **default-deny** (אומת: שינוי שדה לא-ברשימה נכשל).
- [x] אין role של "agent" מוגדר כ-owner — אין agents בפרויקט הזה כלל.
- [x] כשל הרשאה מחזיר קוד ממופה (`INV_FORBIDDEN`/`INV_NOT_OWNER`), לא נבלע בשקט.

### 4. Agent Actions
- [n/a] הפרויקט הזה לא כולל Process Agents (מוצהר במפורש ב-ADR-INV-001 Context: invariant #3 של ה-CLAUDE.md אינו רלוונטי כאן).

### 5. Secrets
- [n/a] אין secrets בקבצי SQL/TS האלה. `business_signing_keys` (מפתחות חתימה מוצפנים) לא נוצרת/נכתבת בבatch זה.

### 6. Input Validation
- [x] כל פונקציית `app.*` מקבלת פרמטרים טיפוסיים (`uuid`, `document_type`, `date`, `bigint`) — שקול ל-zod ב-boundary עבור שכבת ה-DB.
- [x] אין `sql.raw`/string concat עם קלט משתמש. `app.enforce_audit()` בונה SQL דינמי עם `format(%I, %s)`, אך מקבל אך ורק שמות טבלה קבועים-בקוד בזמן migration (לא קלט משתמש) — לא וקטור הזרקה.
- [n/a] אין file upload בקבצים האלה.

### 7. OWASP Quick Scan
- [n/a] XSS/SSRF — לא רלוונטי לשכבת ה-DB.
- [x] IDOR — אומת אמפירית: `SELECT`/`UPDATE` על עסק זר מסונן/משפיע-אפס.
- [x] Broken auth — כל ה-write paths דורשים `authenticated` + `app.has_role()`; אין `publicProcedure`-מקביל.
- [x] Sensitive data exposure — `business_signing_keys` ללא policies כלל (FORCE); `audit_log` מסונן ל-`business_id` של הצופה.

## Issues

### 🟡 Important (Should fix)

1. **`documents.updated_at` אינו מתעדכן אף פעם — לא ב-edit, לא בהפקה, לא בעדכון post-issue**
   - File: לא קיים trigger כזה באף אחד מ-`0003a/0003b` (batch 1) או `0006/0007/0008` (batch זה); `0007_immutability.sql` כולל `updated_at` ב-whitelist (מרמז שמשהו אמור לגעת בו) אבל שום קוד לא כותב לעמודה.
   - עדות אמפירית: הרצתי `app.issue_document()` ואז `UPDATE documents SET paid_amount = 10` (שדה מותר ב-whitelist) על אותו מסמך — `updated_at` נשאר זהה ל-`created_at` המקורי אחרי שני השינויים.
   - למה זה חשוב: ADR-INV-001 Implementation Notes #4 קובע במפורש: *"`updated_at` — extension `moddatetime` על טבלאות עריכות (`businesses`, `customers`, `items`) ו**על `documents` רק בסטטוס draft** (ה-trigger של ADR-INV-002 מטפל בשאר)"*. שני החלקים חסרים: אין `moddatetime` על `documents` בכלל (גם לא ב-draft), ואין מנגנון ב-`0007`/`0008` שמטפל ב"שאר" (המצב שאחרי הפקה). התוצאה בפועל: `documents_drafts_idx` (שממוין לפי `updated_at desc`, מיועד ל"טיוטות שנערכו לאחרונה") לעולם לא ישקף עריכה אמיתית; ומנגנון "טיוטה שלא נגעו בה 180 יום" (ADR-INV-002 Implementation Notes #8) ימדוד תמיד מרגע היצירה, לא מרגע העריכה האחרונה — מה שעלול להציע מחיקה של טיוטה שנערכה אתמול.
   - איך לתקן: להוסיף `moddatetime` trigger על `documents` מותנה ב-`when (new.status = 'draft')` (ל-draft), ולוודא ש-`app.issue_document()`/כל UPDATE post-issue ממלא `updated_at = now()` בעצמו (הפונקציה כבר כותבת ל-DB עם הרשאות מלאות, זו תוספת שורה אחת לכל UPDATE statement קיים).

## ⚠️ Judgment-Needed

1. **סמכות החישוב של `document_lines` עצמו — לא נאכפת ב-DB, רק סכומי המסמך**
   - File: `0008_issue_function.sql:153-233` (`app.issue_document()`), לצד `0003b_document_tables.sql` (`document_lines` ללא CHECK מקביל).
   - הממצא: `app.issue_document()` מחשב מחדש **בדיוק** את סכומי רמת-המסמך (`subtotal_amount`, `discount_amount`, `net_amount`, `vat_amount`, `total_amount`) מתוך `quantity`/`unit_price`/`discount_percent`/`vat_treatment` של `document_lines` — ומדרוס כל מה שהלקוח שלח ברמת המסמך. **אך** השדות המקבילים על השורות עצמן — `document_lines.line_net`/`line_vat`/`line_total`/`discount_amount` — אינם נכתבים-מחדש ע"י הפונקציה, ואין שום CHECK constraint שקושר אותם לנוסחה. בדקתי את `0003b_document_tables.sql` במלואו — אין קונסטרינט כזה.
   - למה זה טעון החלטה ולא באג: ADR-INV-002 §D2 צעד 6 כתוב "חישוב מחדש של **כל הסכומים** מתוך `document_lines`... דורס כל מה שהלקוח שלח" — ניסוח שתומך בקריאה של המימוש (הכוונה לסכומי-מסמך, בעוד `document_lines` הן ה-*מקור* לחישוב, לא יעד לדריסה) *וגם* בקריאה מחמירה יותר ("כל הסכומים" = כולל אלו שעל השורות). spec-reviewer אישר את הפרשנות הנוכחית (checklist item #26), וזו קריאה סבירה של הטקסט — לכן אין כאן חריגה ממה שאושר.
   - הסיכון בפועל: לפי ADR-INV-002 §D4, ה-PDF (Phase 1, טרם נבנה) קורא **אך ורק** מ-`documents`+`document_lines`+`payments`+snapshots, ללא join חוזר. אם `document_lines.line_total` על השורות אי-פעם לא תואם את הסכום שדורש ה-DB ברמת המסמך (למשל עריכה ישירה/באג בעורך שטרם נבנה, לפני שההפקה מוחקת אותו), **המסמך המס המודפס יראה שורות שלא מסתכמות לסכום הכולל שמופיע עליו** — בדיוק סוג הפגם שה-ADR הזה כולו נועד למנוע ברמת ה-DB.
   - המלצה: להעביר לארכיטקט **לפני** שמתחיל הבנייה של Phase 1 PDF renderer (ADR-INV-003) — להכריע אם `app.issue_document()` צריכה גם לדרוס את `document_lines`'s derived columns (עקבי עם "הלקוח לעולם לא נאמן"), או שדי ב-CHECK constraint על `document_lines` שאוכף `line_total = round(quantity*unit_price,2) - discount_amount + line_vat` בזמן ההפקה. שתי הדרכים סוגרות את הפער; אף אחת מהן לא בסקופ B5-B8 כפי שתוכנן.

2. **(קטן, לא-חוסם) `app.seed_for()` — פרשנות `yearly` לשנה שנייה-ואילך היא ניחוש לא-נבדק**
   - File: `0008_issue_function.sql:35-55`, מתועד עצמאית ע"י ה-implementer כ"judgment call... לא נבדק על ידי אף acceptance test של Phase 0".
   - למה זה טעון החלטה: `numbering_reset_policy='yearly'` אינה ברירת המחדל ואינה חלק מתרחישי הבדיקה של B8/B11/B12, כך שזהו נתיב קוד פעיל, במערכת שמפיקה מסמכי מס, שמעולם לא הורץ — לא ע"י מבחן אוטומטי ולא ע"י בדיקה ידנית באת ה-review הזה. אם עסק כלשהו יבחר `yearly` (למשל בהעברה ממערכת קודמת), הפרשנות ("שנה חדשה מתחילה מ-`start_number`, לא מ-1") היא ניחוש-לגיטימי-אך-לא-מאושר.
   - המלצה: הוסף Phase 0 test מפורש ל-`yearly` (גם ידני מספיק) לפני ש-B11/B13 נסגרים, או ודא עם רו"ח/ADR שהפרשנות נכונה לפני שהעסק הראשון שבוחר במדיניות הזו יפיק מסמך.

## הערכה כללית

זהו אחד מה-batches האיכותיים ביותר שנבדקו בפרויקט הזה: כל אחת מחמש נקודות המיקוד שה-CEO ביקש (concurrency, SECURITY DEFINER, נכונות ה-RLS, נכונות חישובית, triggers/down migrations) אומתה לא רק בקריאת קוד אלא **בהרצה אמיתית מול Postgres 16 מקומי** — כולל race אמיתי של 20 הפקות מקבילות (תוצאה: 1-20 בדיוק), race אמיתי של שני זיכויים מקבילים על אותו אב (תוצאה: `credited_amount` מדויק, ללא lost update), וכל חמשת בדיקות ה-CI המוגדרות ב-ADR. לא נמצא אף ממצא 🔴. הממצא ה-🟡 היחיד (`updated_at` קפוא) הוא תיקון קטן וממוקד. ה-⚠️ המרכזי — סמכות החישוב של `document_lines` עצמו — הוא לא כשל של ה-batch הזה אלא שאלת-scope לגיטימית שכדאי לסגור מול הארכיטקט **לפני** שמתחילה עבודת ה-PDF renderer של Phase 1, כי משם הפער הזה, אם קיים, יהפוך לגלוי ללקוח.

---
