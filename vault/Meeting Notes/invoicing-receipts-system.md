# Invoicing & Receipts System

## Overview

פרויקט חדש שהמייסד ביקש לפתוח: מערכת חשבוניות וקבלות **רב-עסקית** למייסד ולחבריו — מספר עסקים נפרדים (עוסק פטור + עוסק מורשה לפחות) במערכת אחת, חינמית לתפעול. ליבה: קבלות לעוסק פטור, חשבונית מס / מס-קבלה / זיכוי לעוסק מורשה, קטלוג פריטי עבודה עם סכום פתוח עד הפקה, מצב טיוטה→הפקה עם נעילה ומספור רציף, ייצוא לרו"ח. נפח צפוי זעום (~2 מסמכים/חודש לעסק). הפרויקט יושב ב-`invoicing-receipts/` בשורש הריפו (מחוץ ל-pnpm workspace). תוכנית פיתוח מלאה ב-`docs/plan.md`; **הארכיטקטורה נקבעה ב-3 ADRs ב-`invoicing-receipts/docs/adr/`** — כל שלושת ה-ADRs (INV-001/002/003) הם **Accepted** לבניית Phase 0 (ADR-INV-001 גם **Amended**). Phase 0 בביצוע לפי `vault/Engineering/invoicing-phase-0-plan.md` (18 subtasks, כיום ב-Revision 3): **B1-B4 בוצעו ואומתו** (scaffold + migrations בפועל בדיסק: `0001_extensions.sql`, `0002_enums.sql`, `0003a_core_tables.sql`, `0003b_document_tables.sql` — 15 טבלאות, 9 enums; **הערה:** דווח פעם אחת בטעות כ-`0003_core_tables.sql`/`0004_document_tables.sql`, תוקן ע"י אימות ישיר מול הדיסק). **F1-F2 בוצעו ואומתו** (frontend-builder — app shell + auth flow, ראו session log). B5-B14 (RLS ואילך) ו-F3-F4 (frontend, תלויים ב-B9) טרם בוצעו.

## Open Questions

- **אישור המייסד על ה-plan** (`invoicing-receipts/docs/plan.md`): stack, חלוקת פאזות.
- **אישור ההחלטות המסומנות ב-ADRs** (A1-A6, B1-B4, C1-C7) — מתוכן 6 דורשות **חוות דעת רו"ח** לפני production: זיכוי יחיד גם לקבלות (A1), מספור continuous בין שנות מס (A2), שריפת מספר בסירוב הקצאה (B1), איסור גורף על תיקון מסמך שהופק (B2), זיכוי חלקי/שרשור (B3), מסמך issued ללא PDF (B4), ותעודה self-issued שמוצגת כ-Validity Unknown (C1).
- **החלטה כספית פתוחה (C3):** Supabase Free משעה פרויקט אחרי 7 ימי חוסר-פעילות ואינו שומר גיבויים כלל — לא תואם ארכיון מס של 7 שנים. ההמלצה: להתחיל ב-₪0 עם עותק חוץ מוצפן ל-R2/B2 + keepalive, ולעבור ל-Pro ($25/חודש) כשיהיו 3+ עסקים אמיתיים. engineering-manager בחר R2 על פני B2 כברירת ביצוע.
- **סוגיה משפטית (A5):** אחסון PII של לקוחות של עסקים שאינם של המייסד — חובות מנהל מאגר תחת חוק הגנת הפרטיות תיקון 13 (בתוקף מ-2025). מחוץ לסמכות הארכיטקט.
- **שאלה תפעולית שנפתחה ב-Amendment A:** האם ל-role `postgres` ב-Supabase יש `BYPASSRLS` כחוזה מתועד? כרגע התכנון **לא מסתמך על זה** (FORCE הוסר מכל הטבלאות פרט ל-`business_signing_keys`). אם יאומת רשמית — אפשר להחזיר FORCE גורף ולהדק.
- חתימה אלקטרונית — נפתר עקרונית (מאובטחת מספיקה, מפתח self-generated פר-עסק, ₪0). שיורי לפני production: אימות נוסח ההוראות מול gov.il/nevo (המקורות הרשמיים חסומים ב-proxy) + חוו"ד רו"ח על "שליטה בלעדית" במפתח בשרת.
- לוח ספי מספר ההקצאה (10,000 ₪ מ-1.1.2026, 5,000 ₪ מ-1.6.2026) אומת ממקורות משניים בלבד — לאמת מול gov.il לפני Phase 2; תהליך ההרשמה ל-API רשות המסים טרם נחקר.
- מיצוב ארוך-טווח: כלי פרטי לחבורה או גרעין מודול Billing של SUPER-MESHINE? (לא חוסם MVP. אם כן — יידרש יישור מול ADR-002 שאין בו many-to-many של user↔tenant, ומול ADR-006 בגלל ה-audit ב-triggers בלבד.)
- קודי הצבע המדויקים של Morning לא אומתו (אתר חסום ב-proxy) — לא חוסם.
- **⚠️ אין Docker בסביבת הפיתוח בפועל (לא רק שאלת-CI, אושר תוך ביצוע B1-B4):** `dockerd` לא עולה (הרשאות `ulimit`); `supabase start` לא רץ. migrations `0001`-`0003b` אומתו מול Postgres 16 מקומי + stub ידני זמני ל-`auth.users`/`auth.uid()` (לא ל-commit). **B5 (הבא בתור, migration `0004_rls_helpers`) תלויה ב-`auth.uid()` נכון per-session, לא רק בקיום טבלה** — stub הטבלה שהספיק ל-B1-B4 כנראה לא יספיק. אותה שאלה חוזרת ב-CI runner (B13). מתועד בפירוט ב-`vault/Engineering/invoicing-phase-0-plan.md` §Open Questions #3.
- **אין פרויקט Supabase חי (F1-F2):** signup/login/logout מול שרת אמיתי, יצירת `public.users` דרך ה-trigger, וריענון session ב-middleware — כל אלה נבנו נכון לפי ה-API אך לא נבדקו קצה-לקצה; F1-F2 אומתו מול `.env.local` עם ערכי placeholder (URL/anon key מזויפים). ייבדק ב-verification הכולל של סוף Phase 0 כשיחובר פרויקט Supabase אמיתי.
- ~~אין דפדפן headless בסביבה~~ — **נפתר.** Chromium מותקן מראש ב-`/opt/pw-browsers/chromium` (env `PLAYWRIGHT_BROWSERS_PATH`); `playwright` נוסף כ-devDependency (בלי `playwright install` — הבינארי כבר קיים) ו-F1-F2 אומתו בפועל ב-Chromium headless. ראו session log.
- **shadcn/ui CLI חסום ברשת (`ui.shadcn.com` מוחזר 403 ע"י ה-proxy) —** primitives ב-`src/components/ui/` (button/input/label/card) נכתבו ידנית לפי מוסכמות "New York style" הרגילות של shadcn (`components.json` מתעד את התצורה כדי ש-`shadcn add` יעבוד בעתיד כשיהיה נגיש).
- **היקף i18n (F1-F2):** יושם עברית בלבד (`dir="rtl" lang="he"` גלובלי, ללא ניתוב locale) — לא next-intl/routing דו-לשוני. החלטה מכוונת: זהו כלי פנימי למייסד ולחבריו, לא מוצר עם קהל אנגלי; אם זה משתנה, נדרש routing מלא לפני שיתווספו עוד מסכים.

## Session Log

### 2026-08-30 — Open project folder [planned]
- **What was done:** נפתחה תיקיית `invoicing-receipts/` בשורש הריפו עם `README.md` (מטרה + scope טיוטה + מבנה) ו-`docs/requirements.md` (שאלות פתוחות לאפיון + דרישות ליבה ראשוניות). נדחף ל-branch `claude/invoicing-receipts-system-2asysv`.
- **Decisions:** התיקייה הושארה מחוץ ל-pnpm workspace בכוונה — "פרויקט חדש" ולא מודול של ה-ERP, עד שהמייסד יכריע על המיצוב. לא נכתב קוד — רק scaffolding תיעודי, כי הבקשה הייתה לפתוח תיקייה בלבד.
- **Notes / Caveats:** אם יוחלט שזה מודול ERP, נכון יהיה להעביר ל-`apps/` או `packages/` ולערב את architect (schema, multi-tenancy) לפני כתיבת קוד.
- **Related:** [[bootstrap]], [[founding-decisions]]

### 2026-08-30 — Founder context: prior services & motivation [active]
- **What was done:** המייסד שיתף שהשתמש ב-Xterm, Morning (חשבונית ירוקה לשעבר) ו-Ypay ולא היה מרוצה מאף אחד — הכאב המרכזי הוא התשלום החודשי. הרקע תועד ב-`invoicing-receipts/docs/requirements.md` (סעיף "רקע") והשאלות הפתוחות עודכנו.
- **Decisions:** אין החלטה פורמלית עדיין, אבל המוטיבציה מטה את המיצוב לכלי פנימי חינמי לעסק של המייסד כשלב ראשון (משתמש ראשון = המייסד).
- **Notes / Caveats:** "חינם" נכון לתפעול עצמי, אבל יש עלויות תשתית שוליות (hosting/DB) ואחריות רגולטורית שעוברת אלינו — בעיקר תאימות להוראות ניהול ספרים ומספר הקצאה מעל התקרה. צריך לברר סוג ישות ונפח מסמכים לפני עיצוב.
- **Related:** [[invoicing-receipts-system]] (self), [[bootstrap]]

### 2026-08-30 — Founder answers: multi-business scope + item-catalog pain [active]
- **What was done:** המייסד ענה על שלוש שאלות האפיון. עודכן `invoicing-receipts/docs/requirements.md` עם סעיף תשובות + דרישות נגזרות.
- **Decisions (נגזרות מהתשובות):**
  - המערכת רב-עסקית: מייסד (עוסק פטור) + חברים (לפחות עוסק מורשה אחד) — כל עסק עם מספור, לקוחות והרשאות נפרדים (RLS).
  - סוגי מסמכים לפי סוג ישות: פטור → קבלות בלבד; מורשה → חשבונית מס/מס-קבלה/זיכוי עם מע"מ.
  - פיצ'ר הליבה שנבע מהכאב: קטלוג פריטי עבודה עם תיאור מפורט וסכום פתוח לעריכה עד הפקה; מצב טיוטה→הפקה עם נעילה.
  - נפח: ~2 מסמכים/חודש לעסק; סכומים ₪1k–₪10k+.
- **Notes / Caveats:** מספר הקצאה גבולי ב-₪10k+ (הסף יורד משנה לשנה) — לתכנן schema שמאפשר הוספת אינטגרציית רשות המסים בלי שינוי מבני, לא לממש ב-MVP. סליקה ומט"ח מחוץ ל-MVP כהנחת עבודה.
- **Related:** [[bootstrap]], [[founding-decisions]]

### 2026-08-30 — Market research + full development plan [planned]
- **What was done:** שני סוכני מחקר במקביל: (1) בנצ'מרק פונקציות מלא של 6 שירותים ישראליים → [[2026-08-30-invoicing-services-feature-benchmark]]; (2) תחקיר נראות ועיצוב → [[2026-08-30-invoicing-ui-design-research]]. על בסיסם נכתבה תוכנית פיתוח מלאה: `invoicing-receipts/docs/plan.md` — 4 פאזות + מודל נתונים ראשוני + שפת עיצוב.
- **Decisions:**
  - סדר פאזות לפי משתמשים: Phase 1 = עוסק פטור (המייסד, קבלות — בלי תלות ברשות המסים); Phase 2 = עוסק מורשה + מספר הקצאה; Phase 3 = דוחות ומבנה אחיד; Phase 4 = נוחות.
  - סליקה במודע מחוץ ל-scope — זה מודל הרווח וה-lock-in של כל השוק; אצלנו רישום תקבולים בלבד.
  - שפת עיצוב: "השקט של Stripe, החום של Morning" — stone + emerald, פונט Assistant, עורך split-view עם live preview.
- **Notes / Caveats:** ממצא קריטי: ספי מספר ההקצאה הואצו — 10,000 ₪ מ-1.1.2026 ו-5,000 ₪ מ-1.6.2026 (לפני מע"מ) ⇒ אינטגרציית רשות המסים היא Phase 2 מוקדם, לא nice-to-have. סיכון מרכזי: חתימה אלקטרונית מאובטחת עשויה לדרוש תעודה בתשלום. Ypay חינמית לגמרי (מודל עמלות סליקה) — כדאי שהמייסד יידע. אתרי הספקים חסומים ב-proxy — המחקר ממקורות משניים, מסומן היכן שלא אומת.
- **Related:** [[2026-08-30-invoicing-services-feature-benchmark]], [[2026-08-30-invoicing-ui-design-research]], [[founding-decisions]]

### 2026-08-30 — Digital signature research: secure signature suffices [done]
- **What was done:** המייסד שאל איך עושים את החתימה הדיגיטלית. סוכן מחקר בדק את חוק חתימה אלקטרונית + הוראות ניהול ספרים + חוזר מ"ה 24/2004 → [[2026-08-30-digital-signature-computerized-documents]]. ה-plan (סעיף סיכונים) וה-Open Questions עודכנו.
- **Decisions:** מסלול ברירת המחדל: חתימה **מאובטחת** ב-₪0 — זוג מפתחות self-generated **פר-עסק** (החתימה חייבת להיות של עורך התיעוד, לא של המערכת), אחסון מוצפן (KMS/Vault, sign-only), חתימת PAdES על ה-PDF (pyHanko / @signpdf) + חותמת זמן. לא רוכשים תעודת Comsign/PersonalID (300 ₪/שנתיים עד 1,000 ₪/שנה) אלא אם רו"ח יידרוש.
- **Notes / Caveats:** כך עובדים גם Morning/iCount/EZcount (חתימה מאובטחת אוטומטית, בלי כרטיס חכם למשתמש). פרשנות "שליטה בלעדית" למפתח בשרת — פרקטיקה מקובלת אך ללא אישור רשמי כתוב; המקורות הרשמיים (gov.il/nevo) חסומים ב-proxy — אומת ממקורות משניים מוצלבים בלבד. Fallback תמידי: הדפסה ותיוק נייר (מסמך ממוחשב = רשות). אותם כללים חלים גם על קבלות של עוסק פטור.
- **Related:** [[2026-08-30-digital-signature-computerized-documents]], [[2026-08-30-invoicing-services-feature-benchmark]]

### 2026-08-30 — Architecture: 3 ADRs for the invoicing project [planned]
- **What was done:** ה-architect כתב שלושה ADRs ב-`invoicing-receipts/docs/adr/`:
  - **ADR-INV-001** `001-data-model-and-rls.md` — schema מלא (13 טבלאות + 9 enums), RLS על `business_id` דרך `business_members`, מודל 4 roles, ורשימה סגורה של שלושה נתיבי `service_role`.
  - **ADR-INV-002** `002-immutability-and-numbering.md` — הקצאת מספר מטבלת מונים ב-`UPDATE...RETURNING`, `app.issue_document()` כנתיב הפקה יחיד, trigger immutability עם whitelist בגישת default-deny, snapshots, ומכונת מצבים סגורה.
  - **ADR-INV-003** `003-pdf-signing-storage.md` — Chromium serverless לרינדור, pyHanko ל-PAdES-B-T, envelope encryption למפתחות, אחסון + עותק חוץ, ועמוד צפייה ציבורי.
- **Decisions (מרכזיות):**
  - **RLS משותף** (לא schema-per-business) — תואם ADR-002 של הבית; אבל היחס user↔business הוא **many-to-many** דרך `business_members`, בשונה מ-`users.tenant_id` היחיד של ה-ERP.
  - **אכיפת "אילו מסמכים מותרים לפי סוג ישות" ב-CHECK constraint על עמודת snapshot** `business_entity_type` בשורת המסמך — ולא trigger, לא composite FK ולא app-layer.
  - **טבלת מונים ולא `SEQUENCE`** — רצפים ב-Postgres הם non-transactional ומייצרים חורים במספור ב-rollback. הפרה חוקית ישירה.
  - **immutability בגישת default-deny:** ה-trigger משווה את כל השורה פחות whitelist — עמודה חדשה עתידית תהיה immutable אוטומטית.
  - **`issued` הוא מצב סופי.** "מבוטל" הוא תכונה נגזרת (`credited_amount = total_amount`), לא סטטוס.
  - **הפקת PDF מחוץ ל-transaction** — כשל Chromium לא מגלגל אחורה הפקה. הצינור אידמפוטנטי כי ה-snapshot קפוא.
  - **PAdES-B-T ולא B-LT** — תעודה self-issued חסרת OCSP/CRL, אין מידע ביטול להטמיע.
  - **KEK ב-env של Vercel מול ciphertext ב-Supabase** (ולא Supabase Vault) — פיצול בין שתי מערכות; pgsodium במחזור deprecation.
  - **מקור והעתק כשני קבצים חתומים נפרדים** — אי אפשר לסמן "העתק" על קובץ חתום בדיעבד.
  - **סטייה מודעת מ-ADR-006:** audit ב-DB triggers בלבד, ללא app middleware.
- **Notes / Caveats:** 17 החלטות סומנו כדורשות אישור, מהן 6 דורשות חוות דעת רו"ח. ממצא חדש: Supabase Free משעה פרויקט אחרי 7 ימי חוסר-פעילות, 0 ימי גיבוי → עותק חוץ מוצפן + keepalive הוגדרו כחלק מ-Phase 0.
- **Related:** [[002-multi-tenancy-strategy]], [[006-audit-log-and-agent-action-gating]], [[2026-08-30-digital-signature-computerized-documents]]

### 2026-08-30 — ADR-INV-001 Amendment A: RLS gaps + a broken foundational assumption [done]
- **What was done:** escalation מה-engineering-manager על שלושה פערי RLS שחסמו את משימות B9/F3 ב-`vault/Engineering/invoicing-phase-0-plan.md`. בבדיקתם התגלה **פער רביעי, חמור יותר**, באותו סעיף. ADR-INV-001 עודכן במקום (Status: Accepted, Amended 2026-08-30) עם סעיף Amendment Log, סעיפים חדשים D3.1, D3.2, D10, ו-D7 שנכתב מחדש.
- **Decisions:**
  - **A-1 — policies ל-`businesses`:** SELECT לחברים (על `id`, לא `business_id`), UPDATE ל-`owner`, **ללא INSERT ו-DELETE policies כלל**. בנוסף trigger שחוסם שינוי ב-`created_by`/`tax_id`/`entity_type`.
  - **A-2 — D7 נכתב מחדש כ"מפת scoping" של 4 קטגוריות** במקום רשימת חריגים שטוחה. `businesses` היא scope-root (scoping על `id`), לא חריג גלובלי. שאילתת ה-CI תוקנה בהתאם.
  - **A-3 — bootstrap:** הצעת ה-EM אושרה — `app.create_business()` ב-`SECURITY DEFINER`, אטומית (עסק + שורת owner ב-transaction אחד), עם מגבלת 10 עסקים למשתמש כבלם abuse. **השיקול המכריע נגד policy-based bootstrap:** שתי קריאות REST נפרדות ללא transaction, וכשל בשנייה משאיר עסק יתום ללא חברים ש**שורף את ה-`tax_id` לצמיתות** דרך `unique(tax_id)`. לא נוסף נתיב service_role רביעי.
  - **A-4 — הפער שלא דווח, והחשוב מבין הארבעה:** `FORCE ROW LEVEL SECURITY` הגורף ששובץ ב-D3 **שובר את כל דפוס ה-SECURITY DEFINER של ה-ADR**. תחת FORCE גם בעלת הטבלה כפופה ל-policies, ופונקציית definer רצה בזהות `postgres` שאינו חבר ב-`authenticated` — כלומר דחייה, לא בייפאס. שלוש תוצאות שהיו מתגלות רק ב-runtime: `app.current_business_ids()` מחזירה 0 שורות (**נעילה מוחלטת של המערכת**), `issue_document()` לא יכולה לכתוב ל-`document_counters` (אין לה policy כתיבה במכוון), וה-audit trigger לא יכול לכתוב ל-`audit_log`. **התיקון:** FORCE יורד מכל הטבלאות פרט ל-`business_signing_keys` — הטבלה היחידה שאף definer לא נוגע בה, ושהקורא הלגיטימי היחיד שלה (`service_role`) מדלג מתוקף `BYPASSRLS` שגובר על FORCE.
  - **פיצוי על אובדן ה-FORCE:** בדיקת CI חדשה (ה) שמשווה את רשימת ה-`SECURITY DEFINER` functions ב-DB מול whitelist סגור של 7 פונקציות. זה ה-control האמיתי, כי דילוג-בעלים הוא בדיוק מה שהפונקציות האלה עושות.
  - **A-5 (קוסמטי):** `_migrations` הוסרה — Supabase CLI כותב ל-`supabase_migrations.schema_migrations`, מחוץ ל-`public`, וסינון ה-`nspname` מוציא אותו ממילא.
- **Notes / Caveats:**
  - אומת מול תיעוד Postgres: "a security definer function only skips RLS when its owner can — a function owned by a role without bypassrls, or reading a table set to force row level security, evaluates the membership policy again". הסתמכות על `BYPASSRLS` של `postgres` ב-Supabase נדחתה כהנחת פלטפורמה שאינה חוזה מתועד.
  - Amendment A לא הוסיף החלטות הטעונות אישור — כל הארבעה תיקוני נכונות בסמכות הארכיטקט. A1-A6 לא הושפעו.
  - ADR-INV-002 ו-003 לא הצריכו שינוי (FORCE הוזכר רק ב-001), אבל **ADR-INV-002 היה נשבר בפועל בלי A-4**.
  - חוב שנוצר: כל פונקציית definer עתידית מדלגת על RLS. בדיקת CI (ה) היא חובה, לא nice-to-have.
- **Related:** [[002-multi-tenancy-strategy]], `vault/Engineering/invoicing-phase-0-plan.md`

### 2026-08-30 — Phase 0 Batch 1 (B1-B4): scaffold + schema migrations [done]
- **What was done:** backend-builder ביצע B1-B4 מ-`vault/Engineering/invoicing-phase-0-plan.md`.
  - **B1:** scaffold pnpm עצמאי ב-`invoicing-receipts/` — Next.js 15.5.24 (App Router, TS strict), Tailwind v4 (`@tailwindcss/postcss`), Biome 2.5.11, Vitest 4, `supabase` CLI כ-devDependency (npm-wrapped binary, לא global install). נוסף `pnpm-workspace.yaml` מקומי — **בלעדיו `pnpm install` בתוך `invoicing-receipts/` "טיפס" ל-workspace של השורש והתקין את כל 8 חבילות ה-ERP ל-root `node_modules`** (side-effect לא מכוון, לא נגע ב-`pnpm-lock.yaml`/`package.json` של השורש, אך שווה לדעת — כל תיקיית פרויקט "עצמאית" עתידית מתחת לשורש חייבת את אותו קובץ). `biome.json` עם `noRestrictedImports` (pattern `**/service-role/**`) אוכף את ADR-INV-001 §D5 — נבדק ידנית (import מבחוץ נכשל, import יחסי מבפנים עובר) ותועד ב-PR. נכתב `src/server/service-role/client.ts` (TDD: RED→GREEN) כ-proof-of-concept ראשון למודול המוגן.
  - **B2:** `0001_extensions.sql` (`pgcrypto`, `citext`), `0002_enums.sql` (9 enums) + down מקבילים.
  - **B3:** `0003_core_tables.sql` — 8 טבלאות (`users`+auth-sync trigger, `vat_rates`+seed, `businesses`, `business_members`+owner-guard trigger, `business_signing_keys`, `customers`, `items`, `customer_document_consents`) + `set_updated_at()` על businesses/customers/items. **כולל גם `businesses_protect_identity_trg`** (חוסם שינוי `created_by`/`tax_id`/`entity_type`) — נדרש ע"י Amendment A §D3.1 שהתפרסם *תוך כדי* עבודת ה-batch הזה; RLS/create_business() עצמם (שאר Amendment A) נשארו מחוץ ל-scope.
  - **B4:** `0004_document_tables.sql` — 7 טבלאות (`documents` עם `signed_total` generated column, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `audit_log`). **ללא שום RLS statement**, כולל עבור `business_signing_keys`/`document_counters`/`audit_log` שה-ADR מציג את ה-RLS שלהן inline בסקשן ה-Schema — הוחלט להעביר את כל ה-RLS (enable/force/policies) ל-migration אטומית אחת מאוחרת יותר, כי `counters_read` היה תלוי בפונקציית `app.current_business_ids()` שטרם קיימת.
  - **⚠️ תיקון מאוחר (ראה session הבא):** שמות הקבצים בפועל, כפי שאומתו ישירות מול הדיסק ע"י ה-CEO, הם **`0003a_core_tables.sql`** ו-**`0003b_document_tables.sql`** — לא `0003_core_tables.sql`/`0004_document_tables.sql` כפי שדווח כאן. ייתכן שדווח מצב-ביניים לפני ששמות הקבצים סוכמו סופית. משאיר את הרשומה המקורית כפי שנכתבה (ללא שכתוב) לפי פרוטוקול ה-vault — התיקון העובדתי מתועד ברשומה הבאה.
- **Decisions:**
  - מספור המיגרציות (`0001`-`0004`) עוקב אחרי חלוקת המשימות של ה-EM (שפיצל את "0003_core_tables" ל-B3+B4 בתור **שני קבצים רציפים**), **לא** אחרי המספור המקורי ב-ADR-INV-001 §Implementation Notes (שם 0003 מכיל את כל הטבלאות ו-0004 הוא RLS helpers). אין סתירה מהותית — רק היסט מספרי; מתועד בראש כל קובץ מיגרציה **ותוקן בהמשך ב-plan file** (ראה session הבא).
  - `updated_at` על `businesses`/`customers`/`items`: נבחר trigger plpgsql פשוט (`public.set_updated_at()`) במקום extension `moddatetime` שה-ADR מזכיר ב-Implementation Note #4 — נמנע תלות ב-extension נוספת לעמודה אחת לטבלה; אותה תוצאה פונקציונלית.
  - אין Docker daemon בסביבת ה-sandbox (`dockerd` נכשל על `ulimit`/הרשאות) → `supabase start` לא עלה בפועל. אימות המיגרציות נעשה ישירות מול Postgres 16 מותקן מקומית (חבילת apt), עם schema `auth` + טבלת `auth.users` + `auth.uid()` **stub זמני שלי בלבד** (לא ל-commit, לא חלק מה-migrations) — נחוץ כי `public.users` ב-B3 מפנה FK ל-`auth.users` וה-trigger `on_auth_user_created` יורה על insert אליה.
- **Verified (בפועל, לא רק "נראה תקין"):**
  - `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm check`, `pnpm format`, `pnpm test` (3/3, TDD על `createServiceRoleClient`) — כולם exit 0.
  - `pnpm dev` מרים על `localhost:3000` (נבדק עם curl, 200).
  - `noRestrictedImports`: import חיצוני מ-`src/app/page.tsx` ל-`@/server/service-role/client` הפיל את `pnpm lint` עם ההודעה הצפויה; import יחסי פנימי (`./internal-helper`) לא הפיל.
  - מיגרציות 0001→0004 עולות נקי על Postgres מקומי; 15 טבלאות, 9 enums, 2 שורות seed ב-`vat_rates`; כל 13 ה-CHECK constraints + 15 האינדקסים מה-ADR קיימים (נבדק מול `pg_constraint`/`pg_indexes`).
  - `signed_total`: שורה רגילה total=118 → signed_total=118; `credit_note` total=100 → signed_total=-100.
  - `doc_type_allowed_for_entity`/`patur_has_no_vat`: INSERT פטור+`tax_invoice` ופטור+`vat_amount>0` נכשלים כצפוי; INSERT מורשה+`tax_invoice`+מע"מ מצליח.
  - `business_members` owner-guard: UPDATE ל-`editor` ו-DELETE של ה-owner היחיד נכשלים עם `INV_NO_OWNER`; הוספת owner שני לפני ההורדה מצליחה.
  - `businesses_protect_identity_trg`: שינוי `created_by`/`tax_id`/`entity_type` נכשל (3/3); שינוי `legal_name` מצליח (control חיובי).
  - `on_auth_user_created`: insert ל-`auth.users` עם/בלי `full_name` ב-metadata יוצר שורת `public.users` תואמת (כולל fallback ל-local-part של האימייל).
  - **Down/up roundtrip מלא:** 0004→0003→0002→0001 יורדים ל-0 טבלאות/enums/extensions, ואז עולים חזרה ל-15/9/2 — פעמיים (unit-level לכל migration + roundtrip מלא בסוף).
- **Notes / Caveats:**
  - נתגלה ותועד side-effect: `pnpm install` בתוך תיקיית פרויקט "עצמאית" תחת שורש שיש בו `pnpm-workspace.yaml` **חייב** קובץ `pnpm-workspace.yaml` מקומי משלו, אחרת pnpm מתייחס לתיקיית השורש כ-scope ומתקין את כל שאר הפרויקטים.
  - יש **commit `wip(...)` אוטומטי** בהיסטוריה (`416c9bc`) שנוצר ע"י מנגנון checkpoint של הסביבה, לא ע"י backend-builder במכוון (backend-builder לא מריץ `git commit`/`git push` לפי ההנחיה) — ה-CEO/orchestrator צריך להיות מודע לכך לפני commit/push סופי של ה-batch.
  - B5-B13 ו-F1-F4 לא בוצעו (מחוץ ל-scope של הבאץ' הזה).
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]]

### 2026-08-30 — Engineering plan synced twice: Amendment A + actual migration numbering [wip]
- **What was done:** עדכנתי את `vault/Engineering/invoicing-phase-0-plan.md` בשני revisions רצופים.
  - **Revision 1 (Amendment A):** שחררתי B9 (יצירת עסק+keygen) ו-F3 (טופס יצירת עסק) מ-BLOCKED וכתבתי אותן במלואן לפי `app.create_business()` (§D10); עדכנתי RLS policies (FORCE-רק-על-business_signing_keys, policies ל-`businesses`); עדכנתי audit trigger שיחול גם על `businesses`; עדכנתי בדיקת בידוד מ-12 ל-17 assertions; עדכנתי CI מ-4 ל-5 בדיקות מטא (כולל whitelist סגור של 7 `SECURITY DEFINER` functions). **זיהיתי פער חמישי משלי:** subtask ל-storage buckets+policies היה חסר לגמרי מה-plan המקורי למרות שהיה ב-"must-have" — נוסף כ-B10 חדש.
  - **Revision 2 (מיד אח"כ, לפני שהספקתי לדווח):** בקריאת ה-session log גיליתי ש-backend-builder **כבר סיים** B1-B4 בפועל עם מספור migrations שונה ממה שכתבתי ב-Revision 1 (`0003_core_tables.sql`+`0004_document_tables.sql` רציפים, לא "0003a"/"0003b" כפי שתכננתי). תיקנתי: סימנתי B1-B4 כ-DONE עם שמות הקבצים בפועל, והזזתי את כל מספרי ה-migrations מ-B5 ואילך ב-+1 (0005 rls_helpers עד 0011 storage_buckets) כדי לא להתנגש עם `0004_document_tables.sql` שכבר קיים.
- **Decisions:** אין החלטות ארכיטקטוניות חדשות משלי — כל התוכן המהותי (RLS policies, create_business, whitelist) מגיע ישירות מ-Amendment A של הארכיטקט; ההחלטות שלי כאן הן ארגוניות/מספור בלבד (הוספת B10, תיקון מספור).
- **Notes / Caveats:**
  - **לקח לתהליך, מתועד גם בתוך ה-plan file עצמו:** זו הפעם השנייה בסבב הזה שגיליתי drift בין מה שהתוכנית מניחה למה שקרה בפועל (הראשונה: subtask חסר; השנייה: מספור migrations). לפני עדכון plan, לבדוק תמיד session log עדכני / `git log` בפועל ולא רק להסתמך על ה-brief האחרון.
  - **⚠️ הועלה סיכון חדש, לא architect-level:** B5 (הבא בתור) היא הראשונה שתלויה ב-`auth.uid()` נכון per-session, לא רק בקיום שורה ב-`auth.users` — ה-stub הפשוט שהספיק ל-B1-B4 עלול לא להספיק. אין Docker בסביבה (גם לא ב-CI כנראה) — backend-builder חייב לפתור זאת (למשל `set_config('request.jwt.claims',...)`+`auth.uid()` תואם) ולתעד לפני שממשיך.
  - commit `wip` אוטומטי (`416c9bc`) מ-checkpoint mechanism — עדיין דורש תשומת לב CEO לפני push סופי.
  - אין escalation פתוח נוסף לארכיטקט. אין escalation חוסם ל-CEO/מייסד.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]]

### 2026-08-30 — CEO factual correction: actual migration files are 0003a/0003b, not 0003/0004 [done]
- **What was done:** ה-CEO בדק ישירות בדיסק (`ls supabase/migrations/`) ובקומיט ותיקן: הקבצים בפועל הם **`0003a_core_tables.sql`** ו-**`0003b_document_tables.sql`** — בדיוק כפי שתוכנן ב-Revision 1 — ולא `0003_core_tables.sql`/`0004_document_tables.sql` כפי שהבנתי (בטעות) ב-Revision 2 מתוך ניסוח ב-session log הקודם. עדכנתי את `vault/Engineering/invoicing-phase-0-plan.md` ל-**Revision 3**: ביטלתי את כל ההזחה שביצעתי ב-Revision 2 והחזרתי את מספור B5-B10 בדיוק למה שנקבע ב-Revision 1 (`0004_rls_helpers`, `0005_rls_policies`, `0006_audit`, `0007_immutability`, `0008_issue_function`, `0009_create_business`, `0010_storage_buckets`).
- **Decisions:** אין החלטה חדשה מהותית — זהו תיקון עובדתי גרידא לשמות קבצים; ה-scope/AC/dependencies של כל subtask נשארו בדיוק כפי שהיו ב-Revision 1 (Amendment A).
- **Notes / Caveats:**
  - **לקח מצטבר (זו הפעם השלישית שמתגלה drift בסבב הזה):** מקור האמת היחיד למספור/שמות קבצים בפועל הוא הדיסק/git (`ls`, `git show`) — לא תיאור טקסטואלי בתוך vault session log, ולא הנחה מדיספאץ' קודם. Revision 2 שלי נכשלה בדיוק כי הסתמכתי על נוסח לא-חד-משמעי ("קובץ יחיד") בלי לוודא ישירות.
  - הרשומה ההיסטורית של "Phase 0 Batch 1" למעלה **לא נערכה מחדש** לפי פרוטוקול ה-vault (לא לשכתב היסטוריה) — כוללת הערת-אזהרה מוטמעת המפנה לתיקון כאן.
  - אין escalation פתוח לארכיטקט או ל-CEO/מייסד. B5 (`0004_rls_helpers.sql`) מוכנה לדיספאץ' הבא, ללא חסימה.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]]

### 2026-08-30 — Phase 0 F1-F2: app shell + auth flow [done]
- **What was done:** frontend-builder ביצע F1-F2 מ-`vault/Engineering/invoicing-phase-0-plan.md`, במקביל לעבודת ה-backend על B5-B7.
  - **F1 (app shell):** `components.json` + primitives ידניים ב-`src/components/ui/` (button, input, label, card — Radix `Slot`/`Label` + `class-variance-authority`) כי `pnpm dlx shadcn@latest init` נכשל (הפרוקסי חוסם `ui.shadcn.com` ב-403, מאומת מול `/__agentproxy/status`). Design tokens (`src/app/globals.css`, Tailwind v4 `@theme inline`) לפי `vault/Discovery/2026-08-30-invoicing-ui-design-research.md`: stone-50/900 ניטרלי, emerald-700 primary יחיד, סמנטיים (success/warning/destructive), `tabular-nums`. פונט Assistant דרך `next/font/google` (subsets hebrew+latin, fallback Heebo/Noto Sans Hebrew ב-CSS stack) — אומת ש-13 `@font-face` בפועל נטענו ב-build. `<html dir="rtl" lang="he">` גלובלי ב-`src/app/layout.tsx`. Sidebar placeholder (`src/components/layout/sidebar.tsx` + `business-switcher-placeholder.tsx`) בראש route group `(app)`, לוגיקת ניווט עם `ms-`/`me-`/`border-e` בלבד (אין `ml`/`mr`). `src/lib/supabase/{browser,server}.ts` — `anon` key בלבד, קריאת env, זורקים שגיאה ברורה אם env חסר.
  - **F2 (auth flow):** `src/middleware.ts` + `src/lib/supabase/middleware.ts` (`@supabase/ssr`, session refresh בכל בקשה) + `src/lib/auth/public-paths.ts` (פונקציה טהורה, נבדקת) — מגן על כל הנתיבים חוץ מ-`/login`/`/signup`/`/auth/*`; מפנה משתמש לא-מחובר ל-`/login?next=<path>` ומשתמש מחובר החוצה מנתיבי auth. עמודי `/login`+`/signup` (route group `(auth)`) עם `LoginForm`/`SignupForm` — react-hook-form + zod (`login-form.schema.ts`/`signup-form.schema.ts`, סכימות UI-only, adjacent לטופס), קוראים ישירות ל-`supabase.auth.signInWithPassword`/`signUp`/`signOut` (`LogoutButton`) דרך ה-client של הדפדפן — **לא tRPC**, כי הפרויקט הזה מוצהר ללא tRPC/Drizzle (`vault/Engineering/invoicing-phase-0-plan.md` "הבדל stack מהותי מה-ERP"). `signUp` שולח `options.data.full_name` שה-trigger `handle_new_auth_user` (B3) קורא. שגיאות Supabase (תמיד אנגלית) ממופות ל-עברית ב-`src/lib/supabase/auth-errors.ts` (`mapAuthError`, כולל fallback גנרי + הודעת רשת ל-`fetch failed`/`Failed to fetch`).
  - **תוספת תלויות (מוקדם, מתועד):** prod — `@supabase/ssr`, `react-hook-form`, `zod`, `@hookform/resolvers`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`, `@radix-ui/react-label`, `lucide-react`. dev — `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@vitejs/plugin-react`. כולן נגזרות ישירות מ-stack מאושר (shadcn/ui, Supabase Auth, react-hook-form+zod) — לא בחירת טכנולוגיה חדשה.
  - **תיקון תשתית:** `biome.json` לא היה מוגדר ל-Tailwind v4 CSS syntax (`@theme`/`@apply`) — נוסף `css.parser.tailwindDirectives: true`. `vitest.config.ts`/`vitest.setup.ts` עודכנו ל-jsdom + `@testing-library/jest-dom` + RTL `cleanup()` (חסר גרם ל-"multiple elements found" בין טסטים).
- **Decisions:**
  - **TDD אמיתי לכל הלוגיקה העסקית:** `isPublicPath`, `mapAuthError`, `LoginForm`, `SignupForm` — טסט נכשל (RED, מאומת: "Failed to resolve import") לפני implementation. `LogoutButton`/`Sidebar`/`BusinessSwitcherPlaceholder` נכתבו לפני הטסט (סטייה מודעת, scope גדול) — עדיין מכוסים בטסטים משמעותיים בדיעבד, לא רק smoke tests.
  - **אין ניתוב i18n (עברית בלבד):** `dir="rtl" lang="he"` גלובלי קבוע, לא `next-intl`/`/he`/`/en` routing — כי זה כלי פנימי למייסד ולחבריו (לא קהל אנגלי), וה-brief של המשימה לא ביקש routing. סטייה מכוונת מ"i18n מהיום הראשון Hebrew+English" הגנרי של frontend-builder, מתועדת כ-Open Question.
  - **קריאה ישירה ל-Supabase JS client מה-UI (לא tRPC):** תואם את ה-stack המוצהר של הפרויקט הזה (ADR-INV-001, plan file) שאין בו tRPC/Drizzle — RLS+`SECURITY DEFINER` הם שכבת ה-API. זו סטייה מכוונת מ"data fetching = tRPC בלבד" הגנרי, ספציפית לפרויקט הזה.
  - **`shadcn/ui` primitives נכתבו ידנית** (לא דרך ה-CLI) בגלל חסימת רשת ל-`ui.shadcn.com`; נשמרו קונבנציות "New York style" מדויקות (`data-slot`, `cva`, `cn()`) כדי ש-diff עתידי מול ה-CLI (כשתהיה גישה) יהיה מינימלי.
  - **`.env.local` עם placeholder** (gitignored) נוצר כדי לאפשר ל-`pnpm dev`/`build` לרוץ בלי env אמיתי — מדמה "env מוגדר אך לא מגיע ל-Supabase אמיתי", לא "env חסר לגמרי".
- **Verified (בפועל):**
  - `pnpm typecheck`/`lint`/`check`/`test`/`build` — כולם exit 0. Vitest: **24/24** ירוקים (6 קבצי טסט: `public-paths`, `auth-errors`, `logout-button`, `login-form`, `signup-form`, `service-role/client` הקיים).
  - `pnpm dev` + `curl`: `/` (לא מחובר) → `307` ל-`/login?next=%2F`; `/documents` → `307` ל-`/login?next=%2Fdocuments`; `/login`/`/signup` → `200`, `<html dir="rtl" lang="he">` בפועל ב-HTML; `favicon.ico` → `404` (matcher לא מפנה אותו, לא regression); CSS שנטען כולל 13 `@font-face` של Assistant ו-`--font-sans` עם שרשרת ה-fallback הנכונה; לוג ה-dev server נקי (רק אזהרת webpack cache לא-קשורה).
  - **לא אומת (דורש Supabase חי — Open Question חדש):** signup/login/logout מול שרת אמיתי, יצירת `public.users` בפועל דרך ה-trigger, ריענון session אמיתי ב-middleware, ומצב "משתמש מחובר מנותב החוצה מ-/login". גם: אין דפדפן headless בסביבה (לא Playwright) — הבדיקה החזותית/אינטראקטיבית האמיתית הייתה Vitest+Testing-Library (jsdom) ולא דפדפן אמיתי.
- **Notes / Caveats:** לא נגעתי ב-`supabase/migrations/` (backend-builder עבד שם במקביל על B5-B7 — `0004_rls_helpers.sql` עד `0007_immutability.sql` נוספו תוך כדי הסבב הזה) ולא ב-vault מלבד הרשומה הזו. לא בוצע commit (לפי ההנחיה) — ה-CEO/orchestrator אחראי על ה-commit המשולב.
- **Related:** [[invoicing-phase-0-plan]], [[2026-08-30-invoicing-ui-design-research]], [[001-data-model-and-rls]]

### 2026-08-30 — F1-F2 spec-review fixes: client factory tests, real Chromium verification, sidebar scope [done]
- **What was done:** תיקון שלושה ממצאי spec-review (`vault/Reviews/spec/2026-08-30-invoicing-f1-f2.md`, ❌ Spec gaps, round #1).
  1. **בדיקות client factories:** `src/lib/supabase/browser.test.ts` ו-`server.test.ts` חדשים — מריצים את `createClient()` האמיתי (לא mock), כולל ה-`throw` על env חסר (URL/anon key) ומקרה הצלחה. ל-`server.ts` (משתמש ב-`next/headers`) מוקם רק `cookies()` עצמו (API של Next runtime, לא הקוד שלנו) ומאומת ש-`getAll` בפועל נקרא דרך `auth.getSession()` — כך שהמתאם עצמו (לא רק ה-mock) רץ.
  2. **אימות דפדפן אמיתי:** נמצא Chromium מותקן ב-`/opt/pw-browsers/chromium` (`PLAYWRIGHT_BROWSERS_PATH`) — נוסף `playwright` כ-devDependency (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, בלי `playwright install`). נכתב סקריפט חד-פעמי (נשמר ב-scratchpad, לא בפרויקט) שמריץ `pnpm dev` ופותח `/login`+`/signup`+`/` ב-Chromium headless אמיתי: `dir="rtl"`/`lang="he"` בפועל ב-DOM, `font-family` בפועל = `Assistant, "Assistant Fallback", Heebo, ...`, `background-color` = stone-50, שגיאות ולידציה בעברית מוצגות (ריק, מייל לא תקין, אי-התאמת סיסמאות), redirect ל-`/login?next=/` מ-`/` ומ-`/documents`. 7 screenshots נשמרו ב-scratchpad. **ממצא תוך כדי:** ריצה ראשונה עם `page.fill()` הראתה אזהרת hydration-mismatch מזויפת (`style={{caret-color:"transparent"}}`) על **כל** השדות (כולל שדה טקסט רגיל) — אובחן כארטיפקט של Chromium/Playwright (`fill()` מזריק ערך דרך CDP; ההרצה הראשונה גם ניסתה להתחבר ל-`accounts.google.com`/`www.google.com`, שנחסמו ע"י ה-proxy — Chrome Password Leak Detection). לאחר השבתת הפיצ'ר (`--disable-features=PasswordLeakDetection,...`) **וגם** מעבר מ-`fill()` ל-`pressSequentially()` (הקלדה אמיתית, לא הזרקת ערך) — האזהרה נעלמה לגמרי, כולל על שדה הטקסט הרגיל, מה שמאשר שזה לא היה קשור ל-code שלנו כלל אלא לשילוב `fill()`+Chromium.
  3. **Scope creep ב-sidebar:** `NAV_ITEMS` פוצל ל-`ACTIVE_NAV_ITEMS` (רק "בית", `<Link>` אמיתי) ו-`UPCOMING_NAV_ITEMS` ("מסמכים"/"לקוחות" — `<span aria-disabled>` עם badge "בקרוב", בלי `href`). טסט TDD חדש (`sidebar.test.tsx`, RED מאומת) מוודא ששני הפריטים האלה **אינם** `role="link"`.
- **Decisions:**
  - השארתי את `playwright` כ-devDependency (מתועד, לא הותקן `playwright install` בפועל — רק ה-npm package; הבינארי כבר קיים בסביבה) לטובת e2e עתידי, אך את סקריפט האימות החד-פעמי הוצאתי מהפרויקט (רק ב-scratchpad) — הוא כלי אבחון, לא חלק מה-deliverable.
  - לא נגעתי ב-`src/lib/errors.ts`/`errors.test.ts` (קבצי backend-builder, כבר ב-commit `214e0b5`, לא מפורמטים לפי biome) — `pnpm check` (biome format+lint) נכשל בגללם, אך `pnpm lint`/`typecheck`/`test`/`build` — הפקודות שהתבקשו במפורש — כולם ירוקים. לא בסמכותי/scope לתקן פורמט בקבצי backend במקביל.
- **Verified (בפועל):** `pnpm typecheck`/`lint`/`test`/`build` — exit 0. Vitest: **37/37** (10 קבצי טסט, כולל 2 חדשים ל-client factories + 1 ל-sidebar; שאר הגידול מ-24→37 הוא טסטים חדשים של backend-builder שרצו במקביל). Chromium headless אמיתי: 5 תרחישים (login golden path, login empty-submit, login שגויה, signup golden path + empty-submit + password mismatch, redirect מוגן) — כולם עם screenshot; console נקי (אחרי השבתת password-leak-detection ומעבר ל-`pressSequentially`) פרט ל-React DevTools hint (לא-קשור) ו-`favicon.ico` 404 (לא נוצר favicon — gap ידוע, קוסמטי).
- **Notes / Caveats:** favicon.ico חסר עדיין (404 בקונסול) — לא תוקן, לא היה בסקופ ה-review; שווה להוסיף `src/app/icon.tsx`/`favicon.ico` בסבב עתידי. לא נגעתי ב-migrations/vault מלבד רשומה זו. לא בוצע commit.
- **Related:** [[invoicing-phase-0-plan]], [[2026-08-30-invoicing-ui-design-research]], [[001-data-model-and-rls]]
