# Business-Logic Review: invoicing-receipts — Phase 0 Batch 2 (B5-B8)

**Date:** 2026-08-30 18:40
**Task brief:** RLS helpers/policies, audit trigger, immutability triggers, ומכונת ההפקה `app.issue_document()`/`app.seed_for()`/`app.set_start_number()` למערכת חשבוניות/קבלות ישראלית (עוסק פטור + עוסק מורשה). ביקורת ממוקדת בשאלות נכונות עסקית/רגולטורית בלבד — לא spec compliance ולא code quality.
**Files reviewed:**
- `invoicing-receipts/supabase/migrations/0007_immutability.sql`
- `invoicing-receipts/supabase/migrations/0008_issue_function.sql`
- `invoicing-receipts/supabase/migrations/0003b_document_tables.sql` (schema הרלוונטי ל-`document_lines`/`documents`, לצורך הבנת מה `issue_document()` כן/לא נוגע בו)
- `invoicing-receipts/docs/adr/002-immutability-and-numbering.md`
- `invoicing-receipts/docs/adr/001-data-model-and-rls.md` (§D3.1–D10, §Schema)
**Spec:** `vault/Engineering/invoicing-phase-0-plan.md` (Revision 3, B5-B8)
**Prior gates:**
- spec-reviewer: ✅ `vault/Reviews/spec/2026-08-30-invoicing-phase0-batch2.md`
- code-quality-reviewer: ✅ `vault/Reviews/quality/2026-08-30-invoicing-phase0-batch1.md` (batch 1; לא נמצא דוח quality נפרד ל-batch 2 בעת סבב זה — לא חוסם ביקורת דומיין, אך ראוי לציון ל-CEO)

**Domain rules in scope:**
1. מספור עוקב ("הוראות ניהול ספרים") — ADR-INV-002 §D1, §D9; ADR-INV-001 §D9
2. חישוב מע"מ — עיגול, שיוך שיעור מע"מ לפי תאריך המסמך — ADR-INV-002 §D2 שלב 6; חוק/תקנות מע"מ (מקורות משניים, ראה Sources)
3. מנגנון זיכוי (`credit_note`) — ADR-INV-002 §D6
4. מכונת מצבים — ADR-INV-002 §D5
5. Snapshot בהפקה — ADR-INV-002 §D4
6. עמודות Phase 2 (ניכוי במקור, הקצאה) — ADR-INV-001 §D3.2, §Schema; ADR-INV-002 §D5, §D3

## Result

**❌ business-logic flaws**

## Per-rule checks

### Rule 1: מספור עוקב — מונה פר עסק+סוג+שנת מס, הקצאה בעת הפקה בלבד
**Status:** ✅ (מבנה/מנגנון) / ⚠️ (מדיניות continuous מול yearly — כבר מסומן לרו"ח, נוספה תובנה חדשה)
**Evidence:** `0008_issue_function.sql:268-283` — `UPDATE ... RETURNING` על שורת מונה נעולה (לא `SEQUENCE`), `draft_has_no_number` (`0003b_document_tables.sql:93`) מבטיח שאין מספר לפני הפקה, `documents_number_uk` (`0003b:109-111`) הוא ה-uniqueness backstop.
**Citation:** קיבצי משנה (secondary sources — המקורות הרשמיים gov.il/nevo חסומים ב-proxy, כבר מתועד ב-vault): "כל סוג מסמך חייב להיות ממוספר בסדר רץ נפרד" ו"חשבוניות... ימוספרו בסדרת מספרים עוקבים נפרדת" (Google-indexed snippets מתוך הוראות מס הכנסה (ניהול פנקסי חשבונות), תשל"ג-1973 — לא אומת מול הטקסט המלא, ⚠️ unverified לרמת הסעיף המדויק).
**Notes:**
- המנגנון (הקצאה אטומית בעת הפקה בלבד, ללא חורים, `for update` על שורת המונה) **תקין ומדויק** — זו בדיוק הפרשנות השמרנית של "מספור עוקב ללא חורים". אין לי הסתייגות על עצם המנגנון.
- **חוות דעת עצמאית על continuous מול yearly (מעבר למה שכבר ב-A2):** ברירת המחדל `continuous` (המונה ממשיך בין שנות מס) היא הפרשנות השמרנית והנפוצה בפועל בתוכנות חיוב ישראליות מוכרות (Green Invoice/Morning, iCount, Rivhit — לפי הבנצ'מרק הקיים ב-`vault/Discovery/2026-08-30-invoicing-services-feature-benchmark.md:41`, מספור רץ אוטומטי פר סוג מסמך עם מספר התחלתי אחד, לא איפוס שנתי). זו דעתי המקצועית: continuous הוא הבררת-מחדל הנכונה עד שרו"ח יורה אחרת, ואני ממליץ **שלא** יאושר מעבר ל-`yearly` בפרודקשן בלי תיקון נלווה: `display_number` (`app.issue_document()` שורה 283: `coalesce(v_prefix,'') || v_number::text`) **אינו כולל את שנת המס**. במדיניות `yearly`, מספר "1" יופיע פעם בכל שנה — ייחודי ב-DB (המפתח `documents_number_uk` כולל `tax_year`), אבל **לא מובחן חזותית על שני מסמכים מודפסים משנים שונות**, מה שעלול להיראות כמו "שימוש חוזר במספר" בעיני מבקר, גם אם מבחינה טכנית זה לא. `number_prefix` יכול לפתור זאת (ניתן להגדיר פר `(business, type, tax_year)`), אך זה תלוי בהגדרה ידנית של המשתמש בכל שנה — לא אכיפה אוטומטית. **⚠️ judgment-needed, שונה מ-A2:** אם/כשרו"ח יאשר `yearly`, יש להוסיף כלל/ברירת-מחדל ש-`number_prefix` ישולב עם השנה אוטומטית (או ש-`display_number` יכלול שנה), אחרת יש סיכון תפעולי-ביקורתי חדש שלא תועד עד כה.

### Rule 2: חישוב מע"מ — עיגול ושיוך שיעור לפי תאריך
**Status:** ✅
**Evidence:** `0008_issue_function.sql:159-168` (שליפת `vat_rates` לפי `valid_from <= v_issue_date and (valid_to is null or valid_to >= v_issue_date) order by valid_from desc limit 1` — לפי **תאריך המסמך**, לא תאריך יצירה/היום), `:174-196` (עיגול פר-שורה: `round(qty*unit_price,2)`, ואז `round(round(...)*discount%/100,2)`, ואז עיגול המע"מ פר-שורה, וסיכום הערכים המעוגלים — **round-then-sum**, לא round-the-final-sum).
**Citation:** עיקרון "round-then-sum ברמת שורה" הוא פרקטיקה מקובלת בתוכנות חיוב כדי שהמסמך המודפס "יתאזן" (סכום השורות = הסה"כ בדיוק) — **⚠️ unverified**: אין לי ציטוט ספר-לימוד ספציפי (Magal & Word / APICS) לעיקרון הזה, זו הערכה מבוססת-פרקטיקה ולא עובדה מאושרת במקור כתוב. מבחינת רשות המסים: מצאתי מקור משני (Google snippet, לא מאומת מול נוסח מלא) שקובע "כל סכום הנקוב **בדוח** לפי החוק יעוגל לשקל החדש הקרוב" — **זה חל על דיווחי תקופה (למשל דו"ח מע"מ תקופתי), לא על שורת חשבונית בודדת.** רמת החשבונית (`numeric(14,2)`, עיגול לאגורה) היא רמת הדיוק הרגילה והתקינה למסמך מכר בודד; אין לבלבל בין השניים. ה-vault כבר מתעד שהמקורות הרשמיים (gov.il/nevo) חסומים ב-proxy.
**Notes:** האלגוריתם עצמו נכון. **אך ראה Rule 3/Issue 🔴 #1 — התוצאה של החישוב הזה לא נכתבת בחזרה ל-`document_lines`, כך שהעיגול הנכון קיים רק ברמת המסמך ולא בהכרח ברמת השורה המוצגת.**

### Rule 3: זיכויים — credit_note, credited_amount, זיכוי חלקי, פטור
**Status:** ⚠️ (ברובו ✅, פער אחד חדש שלא זוהה קודם)
**Evidence:**
- קישור לאב + סיבה: `credit_needs_parent` (`0003b:98-99`), נבדק שוב ב-`0008:132-136`.
- מניעת שרשור: `0008:147-150` (`v_parent.type = 'credit_note'` נדחה) — תואם D6 "אין שרשור" ✅.
- זיכוי חלקי: `0008:201-205` (`v_parent.credited_amount + v_total > v_parent.total_amount` נדחה) עם `for update` על האב (שורה 138) — מונע race בין שני זיכויים מקבילים ✅.
- זיכוי על קבלה: `0008:216-223` דורש `sum(payments) = -payable` — תואם D6 ✅.
- **פער חדש: אין הגבלה על סוג מסמך האב שמותר לזכות.** `issue_document()` בודק רק ש-`v_parent.status = 'issued'` (`0008:143-146`) ו-ש`v_parent.type <> 'credit_note'` (`0008:147-150`) — אין שום בדיקה ש-`v_parent.type` הוא מסמך "אמיתי" (`receipt`/`tax_invoice`/`tax_invoice_receipt`). **המשמעות בפועל: ניתן להפיק `credit_note` כנגד `price_quote` או `proforma_invoice`.** הצעת מחיר וחשבונית עסקה אינן עסקאות שהושלמו — "לזכות" אותן חסר משמעות חשבונאית (אין מה להחזיר, אין כסף שהתקבל). ה-ADR עצמו (§D6) מנסח את `credit_note` כ"מסמך נגדי" למסמך שכבר קיים כעובדה כספית — הצעת מחיר אינה כזו.
**Citation:** לא מצאתי סעיף רגולטורי ספציפי האוסר זאת במפורש (⚠️ unverified ברמת חוק) — הממצא מבוסס על עקביות פנימית מול ADR-INV-002 §D6 ועל פרקטיקת ERP מקובלת (מסמכי זיכוי מונפקים רק כנגד מסמכי הכנסה, לא כנגד מסמכים לא-מחייבים).
**Notes:** ראה Issue 🟡 #1 למטה. לגבי "האם עוסק פטור רשאי להשתמש באותו מנגנון זיכוי לקבלות" — **הקוד מיישם את מה שה-ADR מגדיר** (`credit_note` מותר גם ל-`patur`, ראה מטריצת ההיתרים ADR-INV-001 §D8), אבל זו בדיוק השאלה שכבר מסומנת לרו"ח (A1 ב-`vault/Meeting Notes/invoicing-receipts-system.md` Open Questions) — לא ממצא חדש, רק אישור שהמימוש תואם את מה שממתין לאישור.

### Rule 4: מכונת המצבים — draft→issued סופי, cancelled רק לסירוב הקצאה
**Status:** ✅ (אין תרחיש חדש חסר)
**Evidence:** `documents_immutable_trg` (`0007_immutability.sql:87-90`) חוסם UPDATE/DELETE מלא על מסמך שאינו draft; מעבר סטטוס מוגבל ל-`pending_allocation → issued|cancelled` בלבד (`0007:70-74`); ב-Phase 0/1 אין `pending_allocation` באנום כלל, כך שבפועל שום שינוי סטטוס אינו אפשרי אחרי `issued`.
**Citation:** ADR-INV-002 §D5, Context rule 2 ("מסמך שהופק אינו נערך ואינו נמחק. תיקון = מסמך נגדי מקושר בלבד").
**Notes:** בדקתי במפורש את התרחיש "מסמך הופק בטעות ללקוח הלא נכון" — **זה לא ממצא חדש**: ה-ADR (Reversal Conditions) כבר דן בתרחיש הזה במפורש וקבע שהנוהל הוא זיכוי+הפקה מחדש, ושכל "חלון תיקון" עתידי ידרוש ADR חדש + חוו"ד רו"ח. זו עמדה סבירה ושמרנית (תואמת B2 ב-Open Questions) — לא מצאתי תרחיש עסקי לגיטימי נוסף שהמסגרת הנוכחית לא מכסה.

### Rule 5: Snapshot — שדות קפואים בהפקה
**Status:** ✅
**Evidence:** `customer_snapshot`/`business_snapshot` נבנים מחדש בהפקה (`0008:236-266`), לא בזמן יצירת הטיוטה; `business_entity_type` מתעדכן שוב באותו רגע (`0008:289`, תואם D8 "מסמך נולד משפטית ברגע ההפקה").
**Citation:** ADR-INV-002 §D4 (רשימת שדות מדויקת), ADR-INV-001 §D8.
**Notes:** רשימת השדות (שם/ת.ז./כתובת/עיר/מיקוד/מדינה/אימייל/טלפון ללקוח; שם משפטי/סוג ישות/ח.פ/כתובת/טלפון/אימייל/לוגו/הערת שוליים לעסק) מכסה את מה שנדרש להצגה על מסמך מס סטנדרטי (זהות מפיק+נמען, כתובות, ח.פ/ע.מ). **הערה לא-חוסמת:** ת.ז/ח.פ הלקוח (`customer_snapshot.tax_id`) אינו חובה ב-DB (`customers.tax_id` nullable) — זה תקין ל-Phase 0/1 (מסמך רגיל לא דורש ח.פ לקוח), אבל ייעשה קריטי ב-Phase 2 (מספר הקצאה דורש ח.פ לקוח) — כבר מתועד כידוע ב-vault, לא ממצא חדש.

### Rule 6: עמודות Phase 2 (ניכוי במקור, הקצאה) — לא חוסמות עתיד
**Status:** ✅
**Evidence:** `withholding_rate`/`withholding_amount` על `documents` ו-`withholding_tax_rate` על `customers` קיימות ולא בשימוש (`v_payable := v_total` עם הערה מפורשת "Phase 1: no withholding-as-payment-component yet", `0008:199`); `allocation_number`/`allocation_request_id`/`status` ברשימת ה-whitelist של ה-immutability trigger (`0007_immutability.sql:22-31`) — ניתנים לעדכון אחרי הפקה כנדרש ל-Phase 2; `payment_method` מתועד כמיועד לקבל `'withholding'` כערך אדיטיבי.
**Citation:** ADR-INV-001 §Schema, §D3.2 whitelist; ADR-INV-002 §D5.
**Notes:** אין ממצא חוסם. שדות ה-withholding אינם ב-whitelist של immutability (לא ניתנים לשינוי אחרי הפקה) — זה **נכון**: כמו `vat_amount`, ניכוי במקור הוא עובדה משפטית שנקבעת ברגע ההפקה ולא אמורה להשתנות אח"כ.

## Issues

### 🔴 Regulatory / document-integrity (count: 1)

1. **`app.issue_document()` מחשב מחדש את סכומי המסמך (הכותרת) מ-`document_lines`, אך אינו כותב את התוצאה חזרה לשורות עצמן — `document_lines.line_net`/`line_vat`/`line_total`/`discount_amount` נשארים בערך שנכתב בזמן עריכת הטיוטה ואינם מאומתים/מתוקנים בהפקה.**
   — `invoicing-receipts/supabase/migrations/0008_issue_function.sql:153-199` (בלוק ההערה קובע במפורש: *"Never trust whatever the client stored on the draft (line_net/line_vat/line_total, or the document's own subtotal/vat/total columns) — recompute purely from quantity, unit_price, discount_percent, vat_treatment"*), אך בפועל שלב 6 (`0008:159-233`) מחשב רק אגרגטים לרמת מסמך (`v_subtotal`, `v_discount`, `v_net`, `v_vat`, `v_total`) ומעדכן רק את `documents` (`0008:288-308`). **אין אף statement `UPDATE document_lines`** בכל הפונקציה (וידאתי בסריקה מלאה של הקובץ).

   **למה זה בעיה עסקית-רגולטורית, לא רק חוסר-עקביות טכני:**
   - `document_lines` נכתבת בזמן עריכת הטיוטה על ידי לקוח (עתידי: F3/F4, טרם נבנה) תחת policy כתיבה גנרית ל-`editor`/`owner` (spec-review item #9, `0005_rls_policies.sql`) — **אין CHECK constraint שמוודא ש-`line_net = round(quantity*unit_price,2) - discount_amount` וכו'.** כלומר `document_lines.line_net`/`line_vat`/`line_total` הם בדיוק אותו סוג קלט "לא מהימן מלקוח" שה-ADR ו-ה-migration עצמם קובעים שאסור לסמוך עליו ברמת המסמך — אבל בניגוד לרמת המסמך, ברמת השורה שום דבר לא דורס אותם בהפקה.
   - **תוצאה אפשרית בפועל:** מסמך שהופק כדין עם `documents.total_amount` נכון (מחושב מחדש, אמין), אך `document_lines` (שהם, לפי ADR-INV-002 §D4, אחד ממקורות הקריאה **הבלעדיים** של תבנית ה-PDF — "התבנית קוראת אך ורק מ-documents+document_lines+payments+snapshots") מציגות פירוט שורות שאינו מסתכם לסכום המסמך. זו בדיוק התקלה שה-ADR מנסה למנוע ("מסמך שגוי שהופק הוא אירוע מס"), והיא בדיוק ההפך מהמטרה המוצהרת של עיצוב העיגול ("...so the printed document always foots exactly", `0008:158`) — המטרה מוצהרת אך לא ממומשת במלואה.
   - זהו גם וקטור שיבוש בפועל: כל `owner`/`editor` (או באג עתידי בפרונטאנד) יכול לכתוב ישירות ל-`document_lines` (via RLS write policy, אין ולידציה ב-DB) ערכים שרירותיים ל-`line_net`/`line_vat`/`line_total`/`discount_amount` לפני קריאה ל-`issue_document()` — הפונקציה תפיק מסמך עם כותרת נכונה אך שורות מזויפות/שגויות, ואין שום מנגנון (trigger, CHECK, או קוד בפונקציית ההפקה) שתופס את זה.

   **תיקון נדרש:** בתוך שלב 6/7 של `app.issue_document()` (לפני מעבר הסטטוס בשלב 9 — הסטטוס עדיין `draft` באותו רגע, כך ש-`app.child_rows_locked()` לא חוסם), להוסיף `UPDATE document_lines SET line_net = ..., line_vat = ..., line_total = ..., discount_amount = ... WHERE document_id = v_doc.id` עם אותה נוסחת עיגול-פר-שורה שכבר קיימת בקוד (רק לכתוב אותה בחזרה, לא רק לצבור אותה ל-`v_*`). זה גם סוגר את וקטור השיבוש (כי מרגע ההפקה השורות נעולות ע"י `app.child_rows_locked()`/`documents_immutable_trg`).

### 🟡 Business-logic (count: 1)

1. **אין ולידציה שסוג מסמך האב ל-`credit_note` הוא מסמך "אמיתי" (עסקה שהושלמה).**
   — `invoicing-receipts/supabase/migrations/0008_issue_function.sql:132-151`. הבדיקות הקיימות מוודאות ש-`parent_document_id`+`credit_reason` קיימים, שהאב `issued`, שהוא באותו עסק, ושאינו בעצמו `credit_note` — אך לא בודקות ש-`v_parent.type in ('receipt','tax_invoice','tax_invoice_receipt')`. כפועל יוצא ניתן להפיק `credit_note` כנגד `price_quote` או `proforma_invoice` (מסמכים לא-מחייבים, ללא תנועת כסף) — פעולה חסרת משמעות חשבונאית, עלולה לבלבל לקוח/מבקר, ואינה תואמת את הניסוח של ADR-INV-002 §D6 ("מסמך נגדי" למסמך כספי קיים).
   **תיקון נדרש:** להוסיף בדיקה מפורשת `if v_doc.type = 'credit_note' and v_parent.type not in ('receipt','tax_invoice','tax_invoice_receipt') then raise exception 'INV_CREDIT_PARENT_TYPE_NOT_ALLOWED' ...` (או להרחיב אם יוחלט אחרת ע"י רו"ח/architect — ⚠️ זו קביעה עסקית שדורשת אישור, לא רק תיקון קוד).

### 🟢 Convention (count: 1)

1. **מדיניות `numbering_reset_policy='yearly'` לא נתמכת מבחינת תצוגה** (`display_number` אינו כולל שנה, `app.seed_for()` בשנה שנייה+ מבוסס על פרשנות-שיפוט מתועדת עצמאית ע"י ה-builder ולא נבדקה). לא חוסם — `continuous` הוא ברירת המחדל היחידה שנבדקה ותופעל בפרודקשן כרגע — אבל יש לטפל בכך יחד עם החלטת הרו"ח (A2) לפני שמישהו יפעיל `yearly` בפועל.
   — `invoicing-receipts/supabase/migrations/0008_issue_function.sql:26-32,283`.
   **המלצה:** כשה-A2 ייסגר, אם התשובה תהיה `yearly`, לתקן את `display_number` לכלול שנה (או לאכוף `number_prefix` הכולל שנה) לפני production.

## Overall Assessment

המנגנון המרכזי — הקצאת מספור אטומית ללא חורים, אי-שינוי בכל השדות שאינם ברשימה מפורשת, snapshot מלא של עסק/לקוח בהפקה, אימות מחדש של סכומי המסמך מהמקור, ותמיכה בזיכוי חלקי עם נעילת האב — כולם בנויים נכון ובקפידה, ומדגימים הבנה עמוקה של למה כל כלל קיים (לא רק העתקה עיוורת של ה-ADR). זה הבסיס לכך שרואה חשבון **היה** חותם על העיצוב הכללי.

אבל נמצא פער אמיתי אחד ברמת 🔴: העיקרון המוצהר במפורש בקוד עצמו — "אף פעם אל תסמוך על מה שהלקוח כתב בטיוטה, חשב מחדש" — **מיושם רק ברמת כותרת המסמך, לא ברמת השורה**. זה בדיוק הפער שמפריד בין "המסמך נכון" ל"המסמך *מציג* נכון" — ומסמך מס שהשורות שלו לא מסתכמות לסכום שלו הוא מסמך פגום בעיני מבקר, גם אם הכותרת עצמה חושבה נכון. בנוסף, נמצא פער 🟡 קטן יותר (זיכוי כנגד מסמכים לא-כספיים) שכדאי לסגור באותו סבב תיקון. שני הממצאים ניתנים לתיקון בתוך `app.issue_document()` עצמה, בלי צורך בשינוי סכימה או ADR — לא נדרשת אסקלציה לארכיטקט, רק חזרה ל-backend-builder.

---
