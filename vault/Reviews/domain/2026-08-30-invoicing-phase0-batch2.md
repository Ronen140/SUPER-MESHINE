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

## Result (Round 1)

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
**Notes:** האלגוריתם עצמו נכון. **אך ראה Rule 3/Issue 🔴 #1 — התוצאה של החישוב הזה לא נכתבת בחזרה ל-`document_lines`, כך שהעיגול הנכון קיים רק ברמת המסמך ולא בהכרח ברמת השורה המוצגת.** *(נסגר ב-Round 2, ראה למטה.)*

### Rule 3: זיכויים — credit_note, credited_amount, זיכוי חלקי, פטור
**Status:** ⚠️ (ברובו ✅, פער אחד חדש שלא זוהה קודם)
**Evidence:**
- קישור לאב + סיבה: `credit_needs_parent` (`0003b:98-99`), נבדק שוב ב-`0008:132-136`.
- מניעת שרשור: `0008:147-150` (`v_parent.type = 'credit_note'` נדחה) — תואם D6 "אין שרשור" ✅.
- זיכוי חלקי: `0008:201-205` (`v_parent.credited_amount + v_total > v_parent.total_amount` נדחה) עם `for update` על האב (שורה 138) — מונע race בין שני זיכויים מקבילים ✅.
- זיכוי על קבלה: `0008:216-223` דורש `sum(payments) = -payable` — תואם D6 ✅.
- **פער חדש: אין הגבלה על סוג מסמך האב שמותר לזכות.** `issue_document()` בודק רק ש-`v_parent.status = 'issued'` (`0008:143-146`) ו-ש`v_parent.type <> 'credit_note'` (`0008:147-150`) — אין שום בדיקה ש-`v_parent.type` הוא מסמך "אמיתי" (`receipt`/`tax_invoice`/`tax_invoice_receipt`). **המשמעות בפועל: ניתן להפיק `credit_note` כנגד `price_quote` או `proforma_invoice`.** הצעת מחיר וחשבונית עסקה אינן עסקאות שהושלמו — "לזכות" אותן חסר משמעות חשבונאית (אין מה להחזיר, אין כסף שהתקבל). ה-ADR עצמו (§D6) מנסח את `credit_note` כ"מסמך נגדי" למסמך שכבר קיים כעובדה כספית — הצעת מחיר אינה כזו. *(נסגר ב-Round 2, ראה למטה.)*
**Citation:** לא מצאתי סעיף רגולטורי ספציפי האוסר זאת במפורש (⚠️ unverified ברמת חוק) — הממצא מבוסס על עקביות פנימית מול ADR-INV-002 §D6 ועל פרקטיקת ERP מקובלת (מסמכי זיכוי מונפקים רק כנגד מסמכי הכנסה, לא כנגד מסמכים לא-מחייבים).
**Notes:** לגבי "האם עוסק פטור רשאי להשתמש באותו מנגנון זיכוי לקבלות" — **הקוד מיישם את מה שה-ADR מגדיר** (`credit_note` מותר גם ל-`patur`, ראה מטריצת ההיתרים ADR-INV-001 §D8), אבל זו בדיוק השאלה שכבר מסומנת לרו"ח (A1 ב-`vault/Meeting Notes/invoicing-receipts-system.md` Open Questions) — לא ממצא חדש, רק אישור שהמימוש תואם את מה שממתין לאישור.

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

## Issues (Round 1)

### 🔴 Regulatory / document-integrity (count: 1) — **CLOSED ב-Round 2**

1. **`app.issue_document()` מחשב מחדש את סכומי המסמך (הכותרת) מ-`document_lines`, אך אינו כותב את התוצאה חזרה לשורות עצמן — `document_lines.line_net`/`line_vat`/`line_total`/`discount_amount` נשארים בערך שנכתב בזמן עריכת הטיוטה ואינם מאומתים/מתוקנים בהפקה.**
   — `invoicing-receipts/supabase/migrations/0008_issue_function.sql:153-199`. ראה ניתוח מלא + תיקון נדרש בגרסה הקודמת של הדוח; **התיקון בפועל מתועד ב-Round 2 למטה.**

### 🟡 Business-logic (count: 1) — **CLOSED ב-Round 2**

1. **אין ולידציה שסוג מסמך האב ל-`credit_note` הוא מסמך "אמיתי" (עסקה שהושלמה).**
   — `invoicing-receipts/supabase/migrations/0008_issue_function.sql:132-151`. **התיקון בפועל מתועד ב-Round 2 למטה.**

### 🟢 Convention (count: 1) — עדיין פתוח, לא חוסם

1. **מדיניות `numbering_reset_policy='yearly'` לא נתמכת מבחינת תצוגה** (`display_number` אינו כולל שנה). לא נגעו בזה ב-Round 2 (לא היה בסקופ התיקון). לא חוסם — `continuous` הוא ברירת המחדל היחידה שנבדקה. יטופל יחד עם החלטת הרו"ח (A2).

---

## Round 2 — ביקורת התיקון (commit `7f50e53`, `0009_amendments.sql`)

**תאריך:** 2026-08-30 (המשך אותו יום)
**קבצים נוספים שנקראו:** `invoicing-receipts/supabase/migrations/0009_amendments.sql`, `invoicing-receipts/src/lib/errors.ts`, `invoicing-receipts/docs/adr/002-immutability-and-numbering.md` (Amendment A, כפי שעודכן), `git show 7f50e53 --stat`.
**שיטת בדיקה:** קריאת קוד מלאה + mental walkthrough (אין לי גישה להריץ Postgres בסביבה הזו כדי לשחזר את ריצות הבדיקה של ה-builder באופן עצמאי; ה-commit מדווח "40/40 tests green" + תרחישי roundtrip/foots/rate-change — לא הרצתי מחדש, אך ההיגיון בקוד נבדק שורה-שורה מול הטענה).

### תיקון 🔴 #1 — line-value freezing

**מה מומש (שלוש שכבות, ADR-INV-002 Amendment A §D8):**
1. **Layer 1 (draft-time):** `app.compute_line()` — פונקציה יחידה, טהורה (`immutable`, `language sql`), שהיא **מקור האמת היחיד** לחישוב `discount_amount`/`line_net`/`line_vat`/`line_total` מתוך `quantity`/`unit_price`/`discount_percent`/`vat_treatment`/`vat_rate`. `app.document_lines_compute()` (trigger `before insert or update on document_lines`) קורא לה ו**דורס** את ארבעת השדות בכל כתיבה — ללא תלות במה שהלקוח שלח בפועל לאותם שדות (`0009_amendments.sql:87-132,141-144`).
2. **Layer 2 (issue-time, ADR Amendment A-1):** שלב 6א חדש ב-`public.issue_document()` (`0009:328-339`, דרך `app.recompute_draft_lines()`) מפעיל מחדש את **אותו** trigger על כל שורות המסמך, הפעם עם GUC טרנזקציוני (`app.issuing_as_of`, `is_local=true`) שמכריח שימוש בשיעור המע"מ **של תאריך ההפקה** (`v_issue_date`) ולא בשיעור של "היום" — סוגר בדיוק את התרחיש "טיוטה נפתחה לפני שינוי שיעור מע"מ, הופקה אחריו".
3. **Layer 3 (invariant, backstop):** `constraint line_total_consistent check (line_total = line_net + line_vat)` (`0009:152-153`) — לא תלוי בטבלה אחרת ולא בפונקציית עיגול, רק זהות אריתמטית.
4. **שינוי מבני חשוב:** כותרת המסמך (`v_subtotal`/`v_discount`/`v_net`/`v_vat`/`v_total`, שלב 7, `0009:346-354`) **כבר לא מחושבת בנוסחה נפרדת** מ-`quantity`/`unit_price`/`discount_percent` (כפי שהיה ב-0008) — היא עכשיו `sum()` ישיר של `document_lines` **אחרי** שלב 6א רענן אותן. זאת אומרת: הכותרת = סכימה של השורות, מאותו מקור חישוב יחיד. זו לא רק "גם לתקן את השורות" (התיקון שהצעתי ב-Round 1) — זו ביטול כפילות המימוש לגמרי, מה שסוגר את הפער בצורה חזקה יותר ממה שביקשתי (אין יותר שני מקומות שיכולים להתפצל).

**האם המימוש באמת סוגר את הממצא — בדיקת "האם באמת אין דרך שערכי שורות לא-עקביים ישרדו הפקה":**
- כל כתיבה (INSERT/UPDATE) ל-`document_lines` — בין אם מהלקוח בזמן עריכת טיוטה, ובין אם מ-`recompute_draft_lines()` בזמן הפקה — עוברת דרך אותו trigger `before`, שמתעלם לחלוטין מכל ערך שנשלח ל-`discount_amount`/`line_net`/`line_vat`/`line_total` ומחשב אותם מחדש מ-`quantity`/`unit_price`/`discount_percent`/`vat_treatment`. **אין נתיב DML שעוקף את ה-trigger** (אין `disable trigger`, אין `service_role` write path ל-`document_lines`). ✅ סגור.
- ה-CHECK (`line_total_consistent`) הוא defense-in-depth נוסף למקרה עתידי שמישהו ישבית את ה-trigger בטעות — לא בודק את הנוסחה המלאה (`net = qty×price − discount`), אבל זה תקין: השורה הראשונה (ה-trigger) היא ה-control האמיתי; ה-CHECK הוא רק גיבוי לזהות פנימית.
- **בדקתי במפורש תרחיש שינוי `entity_type` בין יצירת הטיוטה להפקה** (שהיה עלול לגרום ל-mismatch בין השיעור שמשמש את הכותרת לזה שמשמש את השורות, כי `document_lines_compute()` קורא ל-`documents.business_entity_type` השמור בשורה, לא ל-`businesses.entity_type` הטרי) — **לא רלוונטי בפועל:** `businesses_protect_identity_trg` (מ-0003a, כבר מאומת ב-batch 1) חוסם שינוי `entity_type` על `businesses` לצמיתות, כך ש-`documents.business_entity_type` (שנקבע מ-`businesses` ב-draft-creation) לעולם לא יכול לסטות מ-`v_business.entity_type` הטרי שנטען ב-`issue_document()`. אין דרך אמיתית ל-race הזה.
- **הערה שיורית (🟢, לא חוסמת):** קיים חלון תיאורטי צר: אם עורך אחר (session מקביל) כותב ל-`document_lines` **בין** שלב 6א לשלב 7 (שני statements נפרדים, אין row-lock מפורש על `document_lines` עצמן — רק על `documents` ב-`for update`), השורה החדשה תיכנס לסכימה של שלב 7 אך תחושב לפי "שיעור היום" ולא `v_issue_date` (כי לא עברה דרך ה-GUC). זה דורש שינוי מקביל בו-זמנית לאותה טיוטה בדיוק בזמן ההפקה שלה, בנפח של ~2 מסמכים/חודש לעסק — סיכון זניח מעשית, לא נבדק/סוגר בפועל. לא חוסם round 2.

**מסקנה לתיקון 🔴 #1: סגור. המימוש לא רק עונה על הממצא — הוא מבטל את מקור הכפילות שיצר אותו.**

### תיקון 🟡 #2 — INV_CREDIT_PARENT_TYPE

**מה מומש:** `0009_amendments.sql:303-309` — בדיקה מפורשת `if v_parent.type not in ('receipt', 'tax_invoice', 'tax_invoice_receipt') then raise exception 'INV_CREDIT_PARENT_TYPE'`, שמחליפה (ומכילה) את בדיקת `INV_CREDIT_OF_CREDIT` הקודמת (מכיוון ש-`credit_note` עצמו לא ברשימה המותרת). מיפוי עברית קיים ב-`src/lib/errors.ts:54-55` ("ניתן להפיק זיכוי רק כנגד קבלה, חשבונית מס או חשבונית מס-קבלה — לא כנגד הצעת מחיר או חשבונית עסקה"), עם test ייעודי (`errors.test.ts:17-20`). ה-ADR עצמו עודכן (Amendment A-2, §D6) עם רשימת הטיפוסים המותרים והערה מפורשת **"⚠️ טעון אישור רו"ח (B5)"** — טיפול נכון: זו אכן החלטה עסקית חדשה שנוספה כראוי לרשימת הפריטים הממתינים לרו"ח, לא הוחלטה "בשקט".

**מסקנה לתיקון 🟡 #2: סגור.** מדויק, ממופה לעברית, ומתועד כראוי כהחלטה חדשה הדורשת אישור רו"ח (לא סתירה מול הכלל "לא ממציאים לוגיקה עסקית" — כאן זה חסימה שמרנית של מקרה שלא הוגדר, לא הנחה שקטה).

### בדיקת ה-side questions שה-CEO ביקש להעריך

**"לטיוטה מחושב תמיד השיעור בתוקף *היום* (במקום coalesce מה-ADR שהתברר dead-code)":**
המימוש (`app.document_lines_compute()`, `0009:107-120`) משתמש תמיד ב-`coalesce(app.issuing_as_of, current_date)` לשיעור המע"מ בזמן עריכת טיוטה. **דעתי המקצועית: נכון עסקית.** הטיוטה אינה מסמך משפטי — היא תצוגה מקדימה. הצגת "מה יעלה אם אפיק עכשיו" (שיעור היום) היא ההנחה הכי שימושית ופחות מטעה למשתמש, בהינתן שהשיעור האמיתי והמחייב תמיד ייקבע מחדש בהפקה לפי `issue_date` בפועל (Layer 2). הפרשנות המילולית של ה-ADR (`coalesce(parent.vat_rate, today's rate)`) אכן הייתה dead code — `documents.vat_rate` הוא `not null default 0` ומאוכלס אך ורק ב-`issue_document()` עצמה, כך שכל טיוטה הייתה מציגה 0% מע"מ תמיד, בניגוד למטרת ה-preview החי. הבחירה של הimplementer (Postgres SQL truth, לא ה-prose המילולי שהתברר לא-מיושם) היא הפרשנות הנכונה של כוונת ADR-INV-002 §D8 ("preview חי מדויק"), לא סטייה ממנה. **אין כאן ⚠️ — זו לא החלטה עסקית חדשה שדורשת אישור רו"ח, אלא תיקון קריאה שגויה של טקסט ה-ADR עצמו מול המימוש בפועל שלו (`documents.vat_rate` schema).**

**"ההפקה תמיד דורסת בשיעור של issue_date":**
נכון, ומכוסה ב-Layer 2 לעיל. זו בדיוק ההתנהגות הנדרשת (השיעור החוקי נקבע לפי תאריך המסמך המשפטי, לא לפי מתי הטיוטה נערכה) — תואם Rule 2 מ-Round 1 (שכבר אושר ✅ שם).

## Result (Round 2)

**✅ business-logic correct**

שני הממצאים החוסמים מ-Round 1 (🔴 line-value integrity, 🟡 credit-parent-type) נסגרו בקוד בפועל, בצורה שסוגרת גם את וקטור השיבוש (client יכול לכתוב ישירות ל-`document_lines`) ולא רק את מקרה ה-happy-path. הבחירה בין `today's rate` (טיוטה, preview) ל-`issue_date rate` (הפקה, מחייב) נכונה עסקית ומתועדת כראוי. פריט 🟢 אחד (yearly numbering + display_number) נותר פתוח במודע, לא חוסם, וממתין לאותה החלטת רו"ח (A2) שכבר תועדה. אין ממצא רגולטורי/עסקי חדש שנוצר ע"י התיקון עצמו.

---
