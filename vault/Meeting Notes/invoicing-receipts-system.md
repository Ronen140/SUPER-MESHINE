# Invoicing & Receipts System

## Overview

פרויקט חדש שהמייסד ביקש לפתוח: מערכת חשבוניות וקבלות **רב-עסקית** למייסד ולחבריו — מספר עסקים נפרדים (עוסק פטור + עוסק מורשה לפחות) במערכת אחת, חינמית לתפעול. ליבה: קבלות לעוסק פטור, חשבונית מס / מס-קבלה / זיכוי לעוסק מורשה, קטלוג פריטי עבודה עם סכום פתוח עד הפקה, מצב טיוטה→הפקה עם נעילה ומספור רציף, ייצוא לרו"ח. נפח צפוי זעום (~2 מסמכים/חודש לעסק). הפרויקט יושב ב-`invoicing-receipts/` בשורש הריפו (מחוץ ל-pnpm workspace). תוכנית פיתוח מלאה ב-`docs/plan.md`; **הארכיטקטורה נקבעה ב-3 ADRs ב-`invoicing-receipts/docs/adr/`** — כל שלושת ה-ADRs (INV-001/002/003) הם **Accepted** לבניית Phase 0 (**ADR-INV-001 Amended ×2: A, B** · **ADR-INV-002 Amended ×1: A**). Phase 0 בביצוע לפי `vault/Engineering/invoicing-phase-0-plan.md` (18 subtasks, Revision 3): **B1-B4 בוצעו ואומתו** (scaffold + migrations `0001_extensions.sql`, `0002_enums.sql`, `0003a_core_tables.sql`, `0003b_document_tables.sql` — 15 טבלאות, 9 enums). **F1-F2 בוצעו ואומתו** (app shell + auth flow). **B5-B8 בוצעו** (`0004_rls_helpers.sql` עד `0008_issue_function.sql`) אך **טרם התקבלו ב-acceptance** — שרשרת ה-QA העלתה פגם 🔴 (השורות אינן מוקפאות בהפקה) שהוכרע ב-ADR-INV-002 Amendment A ודורש עבודת תיקון לפני סגירת Batch 2.

## Open Questions

- **אישור המייסד על ה-plan** (`invoicing-receipts/docs/plan.md`): stack, חלוקת פאזות.
- **אישור ההחלטות המסומנות ב-ADRs** (A1-A6, B1-B5, C1-C7) — מתוכן **7** דורשות **חוות דעת רו"ח** לפני production: זיכוי יחיד גם לקבלות (A1), מספור continuous בין שנות מס (A2), שריפת מספר בסירוב הקצאה (B1), איסור גורף על תיקון מסמך שהופק (B2), זיכוי חלקי/שרשור (B3), מסמך issued ללא PDF (B4), **זיכוי מותר רק מול קבלה/חשבונית מס/מס-קבלה — לא מול חשבונית עסקה (B5, חדש)**, ותעודה self-issued שמוצגת כ-Validity Unknown (C1).
- **החלטה כספית פתוחה (C3):** Supabase Free משעה פרויקט אחרי 7 ימי חוסר-פעילות ואינו שומר גיבויים כלל — לא תואם ארכיון מס של 7 שנים. ההמלצה: להתחיל ב-₪0 עם עותק חוץ מוצפן ל-R2/B2 + keepalive, ולעבור ל-Pro ($25/חודש) כשיהיו 3+ עסקים אמיתיים. engineering-manager בחר R2 על פני B2 כברירת ביצוע.
- **סוגיה משפטית (A5):** אחסון PII של לקוחות של עסקים שאינם של המייסד — חובות מנהל מאגר תחת חוק הגנת הפרטיות תיקון 13 (בתוקף מ-2025). מחוץ לסמכות הארכיטקט.
- **שאלה תפעולית שנפתחה ב-Amendment A:** האם ל-role `postgres` ב-Supabase יש `BYPASSRLS` כחוזה מתועד? כרגע התכנון **לא מסתמך על זה** (FORCE הוסר מכל הטבלאות פרט ל-`business_signing_keys`). אם יאומת רשמית — אפשר להחזיר FORCE גורף ולהדק.
- חתימה אלקטרונית — נפתר עקרונית (מאובטחת מספיקה, מפתח self-generated פר-עסק, ₪0). שיורי לפני production: אימות נוסח ההוראות מול gov.il/nevo (המקורות הרשמיים חסומים ב-proxy) + חוו"ד רו"ח על "שליטה בלעדית" במפתח בשרת.
- לוח ספי מספר ההקצאה (10,000 ₪ מ-1.1.2026, 5,000 ₪ מ-1.6.2026) אומת ממקורות משניים בלבד — לאמת מול gov.il לפני Phase 2; תהליך ההרשמה ל-API רשות המסים טרם נחקר.
- מיצוב ארוך-טווח: כלי פרטי לחבורה או גרעין מודול Billing של SUPER-MESHINE? (לא חוסם MVP. אם כן — יידרש יישור מול ADR-002 שאין בו many-to-many של user↔tenant, ומול ADR-006 בגלל ה-audit ב-triggers בלבד.)
- קודי הצבע המדויקים של Morning לא אומתו (אתר חסום ב-proxy) — לא חוסם.
- **⚠️ אין Docker בסביבת הפיתוח בפועל (לא רק שאלת-CI, אושר תוך ביצוע B1-B4):** `dockerd` לא עולה (הרשאות `ulimit`); `supabase start` לא רץ. migrations אומתו מול Postgres 16 מקומי + stub ידני ל-`auth.users`/`auth.uid()` (לא ל-commit) — **stub v2 של B5-B8 (קורא `request.jwt.claim.sub`/`request.jwt.claims`, עם roles `anon`/`authenticated`/`service_role`) הוכיח את עצמו ומספיק גם ל-B9 ואילך.** אותה שאלה חוזרת ב-CI runner (B13). מתועד ב-`vault/Engineering/invoicing-phase-0-plan.md` §Open Questions #3.
- **אין פרויקט Supabase חי (F1-F2):** signup/login/logout מול שרת אמיתי, יצירת `public.users` דרך ה-trigger, וריענון session ב-middleware — נבנו נכון לפי ה-API אך לא נבדקו קצה-לקצה (`.env.local` עם placeholder). ייבדק ב-verification הכולל של סוף Phase 0. **נוסף ב-Amendment B:** גם `supabase.rpc()` מול PostgREST אמיתי לא נבדק — וזו בדיוק הנקודה שהפילה את הנחת ה-schema `app` (ראה B-2).
- ~~אין דפדפן headless בסביבה~~ — **נפתר.** Chromium מותקן מראש ב-`/opt/pw-browsers/chromium` (env `PLAYWRIGHT_BROWSERS_PATH`); `playwright` נוסף כ-devDependency ו-F1-F2 אומתו בפועל ב-Chromium headless.
- **shadcn/ui CLI חסום ברשת (`ui.shadcn.com` מוחזר 403 ע"י ה-proxy) —** primitives ב-`src/components/ui/` (button/input/label/card) נכתבו ידנית לפי מוסכמות "New York style" (`components.json` מתעד את התצורה כדי ש-`shadcn add` יעבוד בעתיד).
- **היקף i18n (F1-F2):** יושם עברית בלבד (`dir="rtl" lang="he"` גלובלי, ללא ניתוב locale) — לא next-intl/routing דו-לשוני. החלטה מכוונת: כלי פנימי למייסד ולחבריו; אם זה משתנה, נדרש routing מלא לפני שיתווספו עוד מסכים.
- ~~**פער: `public.handle_new_auth_user()` אינו ב-whitelist של Amendment A**~~ — **נפתר ב-Amendment B (B-1).** נוסף ל-whitelist, שגדל מ-7 ל-9 פונקציות; נשאר ב-`public` מסיבה טכנית מנומקת (§D3.3).
- ~~**פער: פונקציות ב-schema `app` בלתי-קריאות דרך `supabase.rpc()`**~~ — **נפתר ב-Amendment B (B-2).** חוזה ה-RPC עובר ל-`public`; `app` נשאר internals ולא ייחשף ל-PostgREST לעולם.
- ~~**🔴 פגם: `issue_document()` לא מקפיאה את ערכי השורות**~~ — **נפתר ב-ADR-INV-002 Amendment A (A-1).** שלוש שכבות: trigger מחשב על `document_lines`, חישוב חוזר בהפקה, CHECK של עקביות פנימית. דורש **עבודת תיקון בפועל** לפני acceptance של Batch 2.
- **⚠️ נגזרות פתוחות ל-EM (משני ה-Amendments):**
  1. המיגרציות `0004`-`0008` מגדירות את `issue_document`/`set_start_number` ב-`app`. נדרש **migration מתקן חדש** (`ALTER FUNCTION ... SET SCHEMA public` + grants), לא עריכה של קובץ שכבר בוצע.
  2. לוודא ש-`app.documents_set_entity_type()`, `app.allocation_requests_locked()`, `app.child_rows_locked()`, `app.documents_immutable()`, `app.audit_log_immutable()` ו-`app.seed_for()` הן **`SECURITY INVOKER`**, אחרת בדיקת CI (ה) תיפול עליהן ב-B13.
  3. **חדש:** `app.compute_line()` + trigger `app.document_lines_compute()` + `check (line_total = line_net + line_vat)` + שלב 6א ב-`issue_document()` + trigger `set_updated_at` על `documents` — כולם migration מתקן חדש, לא עריכה של `0007`/`0008`.
  4. **חדש, ל-frontend:** העורך **אינו מחשב סכומים**. כל חישוב כספי ב-JS הוא באג — שולחים קלט גולמי וקוראים בחזרה מחושב. משפיע על F4 ועל עורך המסמכים ב-Phase 1.

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
  - **ADR-INV-002** `002-immutability-and-numbering.md` — הקצאת מספר מטבלת מונים ב-`UPDATE...RETURNING`, `issue_document()` כנתיב הפקה יחיד, trigger immutability עם whitelist בגישת default-deny, snapshots, ומכונת מצבים סגורה.
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
  - **A-3 — bootstrap:** הצעת ה-EM אושרה — `create_business()` ב-`SECURITY DEFINER`, אטומית (עסק + שורת owner ב-transaction אחד), עם מגבלת 10 עסקים למשתמש כבלם abuse. **השיקול המכריע נגד policy-based bootstrap:** שתי קריאות REST נפרדות ללא transaction, וכשל בשנייה משאיר עסק יתום ללא חברים ש**שורף את ה-`tax_id` לצמיתות** דרך `unique(tax_id)`. לא נוסף נתיב service_role רביעי.
  - **A-4 — הפער שלא דווח, והחשוב מבין הארבעה:** `FORCE ROW LEVEL SECURITY` הגורף ששובץ ב-D3 **שובר את כל דפוס ה-SECURITY DEFINER של ה-ADR**. תחת FORCE גם בעלת הטבלה כפופה ל-policies, ופונקציית definer רצה בזהות `postgres` שאינו חבר ב-`authenticated` — כלומר דחייה, לא בייפאס. שלוש תוצאות שהיו מתגלות רק ב-runtime: `app.current_business_ids()` מחזירה 0 שורות (**נעילה מוחלטת של המערכת**), `issue_document()` לא יכולה לכתוב ל-`document_counters`, וה-audit trigger לא יכול לכתוב ל-`audit_log`. **התיקון:** FORCE יורד מכל הטבלאות פרט ל-`business_signing_keys`.
  - **פיצוי על אובדן ה-FORCE:** בדיקת CI חדשה (ה) שמשווה את רשימת ה-`SECURITY DEFINER` functions ב-DB מול whitelist סגור. זה ה-control האמיתי, כי דילוג-בעלים הוא בדיוק מה שהפונקציות האלה עושות.
  - **A-5 (קוסמטי):** `_migrations` הוסרה — Supabase CLI כותב ל-`supabase_migrations.schema_migrations`, מחוץ ל-`public`.
- **Notes / Caveats:**
  - אומת מול תיעוד Postgres: "a security definer function only skips RLS when its owner can — a function owned by a role without bypassrls, or reading a table set to force row level security, evaluates the membership policy again". הסתמכות על `BYPASSRLS` של `postgres` ב-Supabase נדחתה כהנחת פלטפורמה שאינה חוזה מתועד.
  - Amendment A לא הוסיף החלטות הטעונות אישור. A1-A6 לא הושפעו.
  - ADR-INV-002 ו-003 לא הצריכו שינוי, אבל **ADR-INV-002 היה נשבר בפועל בלי A-4**.
  - חוב שנוצר: כל פונקציית definer עתידית מדלגת על RLS. בדיקת CI (ה) היא חובה, לא nice-to-have.
- **Related:** [[002-multi-tenancy-strategy]], `vault/Engineering/invoicing-phase-0-plan.md`

### 2026-08-30 — Phase 0 Batch 1 (B1-B4): scaffold + schema migrations [done]
- **What was done:** backend-builder ביצע B1-B4 מ-`vault/Engineering/invoicing-phase-0-plan.md`.
  - **B1:** scaffold pnpm עצמאי ב-`invoicing-receipts/` — Next.js 15.5.24 (App Router, TS strict), Tailwind v4 (`@tailwindcss/postcss`), Biome 2.5.11, Vitest 4, `supabase` CLI כ-devDependency (npm-wrapped binary, לא global install). נוסף `pnpm-workspace.yaml` מקומי — **בלעדיו `pnpm install` בתוך `invoicing-receipts/` "טיפס" ל-workspace של השורש והתקין את כל 8 חבילות ה-ERP ל-root `node_modules`** (side-effect לא מכוון, לא נגע ב-`pnpm-lock.yaml`/`package.json` של השורש, אך שווה לדעת — כל תיקיית פרויקט "עצמאית" עתידית מתחת לשורש חייבת את אותו קובץ). `biome.json` עם `noRestrictedImports` (pattern `**/service-role/**`) אוכף את ADR-INV-001 §D5 — נבדק ידנית ותועד ב-PR. נכתב `src/server/service-role/client.ts` (TDD: RED→GREEN) כ-proof-of-concept ראשון למודול המוגן.
  - **B2:** `0001_extensions.sql` (`pgcrypto`, `citext`), `0002_enums.sql` (9 enums) + down מקבילים.
  - **B3:** `0003_core_tables.sql` — 8 טבלאות (`users`+auth-sync trigger, `vat_rates`+seed, `businesses`, `business_members`+owner-guard trigger, `business_signing_keys`, `customers`, `items`, `customer_document_consents`) + `set_updated_at()` על businesses/customers/items. **כולל גם `businesses_protect_identity_trg`** — נדרש ע"י Amendment A §D3.1 שהתפרסם *תוך כדי* עבודת ה-batch הזה; RLS/create_business() עצמם נשארו מחוץ ל-scope.
  - **B4:** `0004_document_tables.sql` — 7 טבלאות (`documents` עם `signed_total` generated column, `document_lines`, `payments`, `document_counters`, `allocation_requests`, `document_public_links`, `audit_log`). **ללא שום RLS statement** — הוחלט להעביר את כל ה-RLS ל-migration אטומית מאוחרת יותר, כי `counters_read` תלוי ב-`app.current_business_ids()` שטרם קיימת.
  - **⚠️ תיקון מאוחר (ראה session הבא):** שמות הקבצים בפועל הם **`0003a_core_tables.sql`** ו-**`0003b_document_tables.sql`**. משאיר את הרשומה המקורית כפי שנכתבה (ללא שכתוב) לפי פרוטוקול ה-vault.
- **Decisions:**
  - מספור המיגרציות עוקב אחרי חלוקת המשימות של ה-EM, **לא** אחרי המספור המקורי ב-ADR-INV-001 §Implementation Notes. אין סתירה מהותית — רק היסט מספרי; מתועד בראש כל קובץ מיגרציה **ותוקן בהמשך ב-plan file**.
  - `updated_at` על `businesses`/`customers`/`items`: נבחר trigger plpgsql פשוט (`public.set_updated_at()`) במקום extension `moddatetime` — נמנע תלות ב-extension נוספת; אותה תוצאה פונקציונלית.
  - אין Docker daemon בסביבת ה-sandbox → `supabase start` לא עלה. אימות המיגרציות נעשה ישירות מול Postgres 16 מקומי, עם schema `auth` + `auth.users` + `auth.uid()` **stub זמני** (לא ל-commit).
- **Verified (בפועל, לא רק "נראה תקין"):**
  - `pnpm install`, `build`, `typecheck`, `lint`, `check`, `format`, `test` (3/3) — כולם exit 0. `pnpm dev` מרים על `localhost:3000` (curl 200).
  - `noRestrictedImports`: import חיצוני הפיל את `pnpm lint`; import יחסי פנימי לא הפיל.
  - מיגרציות 0001→0004 עולות נקי; 15 טבלאות, 9 enums, 2 שורות seed; כל 13 ה-CHECK constraints + 15 האינדקסים קיימים.
  - `signed_total`: total=118 → 118; `credit_note` total=100 → -100.
  - `doc_type_allowed_for_entity`/`patur_has_no_vat`: פטור+`tax_invoice` ופטור+`vat_amount>0` נכשלים; מורשה+`tax_invoice`+מע"מ מצליח.
  - `business_members` owner-guard: הורדת/מחיקת ה-owner היחיד נכשלות עם `INV_NO_OWNER`.
  - `businesses_protect_identity_trg`: 3/3 נכשלים; שינוי `legal_name` מצליח (control חיובי).
  - `on_auth_user_created`: insert ל-`auth.users` עם/בלי `full_name` יוצר שורת `public.users` תואמת.
  - **Down/up roundtrip מלא** פעמיים.
- **Notes / Caveats:**
  - side-effect מתועד: `pnpm install` בתיקיית פרויקט "עצמאית" תחת שורש עם `pnpm-workspace.yaml` **חייב** קובץ workspace מקומי משלו.
  - יש **commit `wip(...)` אוטומטי** (`416c9bc`) ממנגנון checkpoint של הסביבה — ה-CEO צריך להיות מודע לפני push סופי.
  - B5-B13 ו-F1-F4 לא בוצעו.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]]

### 2026-08-30 — Engineering plan synced twice: Amendment A + actual migration numbering [wip]
- **What was done:** עדכון `vault/Engineering/invoicing-phase-0-plan.md` בשני revisions רצופים.
  - **Revision 1 (Amendment A):** שחרור B9 ו-F3 מ-BLOCKED וכתיבתן במלואן לפי `create_business()`; עדכון RLS policies; audit trigger גם על `businesses`; בדיקת בידוד 12→17 assertions; CI 4→5 בדיקות מטא. **פער חמישי שזוהה עצמאית:** subtask ל-storage buckets+policies היה חסר לגמרי — נוסף כ-B10.
  - **Revision 2:** תיקון מספור migrations לפי מה שנראה כמצב בפועל.
- **Decisions:** אין החלטות ארכיטקטוניות חדשות — כל התוכן המהותי מגיע מ-Amendment A; ההחלטות כאן ארגוניות/מספור בלבד.
- **Notes / Caveats:**
  - **לקח לתהליך:** זו הפעם השנייה בסבב שהתגלה drift בין התוכנית למציאות. לפני עדכון plan — לבדוק session log עדכני / `git log` בפועל.
  - **סיכון שהועלה:** B5 היא הראשונה שתלויה ב-`auth.uid()` נכון per-session; ה-stub הפשוט של B1-B4 עלול לא להספיק.
  - commit `wip` אוטומטי (`416c9bc`) — דורש תשומת לב CEO לפני push.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]]

### 2026-08-30 — CEO factual correction: actual migration files are 0003a/0003b, not 0003/0004 [done]
- **What was done:** ה-CEO בדק ישירות בדיסק ובקומיט ותיקן: הקבצים בפועל הם **`0003a_core_tables.sql`** ו-**`0003b_document_tables.sql`**. ה-plan עודכן ל-**Revision 3**: בוטלה ההזחה של Revision 2 והוחזר מספור B5-B10 למה שנקבע ב-Revision 1 (`0004_rls_helpers` … `0010_storage_buckets`).
- **Decisions:** תיקון עובדתי גרידא; ה-scope/AC/dependencies של כל subtask נשארו כפי שהיו ב-Revision 1.
- **Notes / Caveats:**
  - **לקח מצטבר (פעם שלישית):** מקור האמת היחיד לשמות קבצים הוא הדיסק/git — לא תיאור טקסטואלי ב-session log.
  - הרשומה ההיסטורית של Batch 1 **לא נערכה מחדש** (לא משכתבים היסטוריה) — כוללת הערת-אזהרה מוטמעת.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]]

### 2026-08-30 — Phase 0 F1-F2: app shell + auth flow [done]
- **What was done:** frontend-builder ביצע F1-F2, במקביל לעבודת ה-backend על B5-B7.
  - **F1 (app shell):** `components.json` + primitives ידניים ב-`src/components/ui/` (button, input, label, card) כי ה-CLI של shadcn נחסם (403 על `ui.shadcn.com`). Design tokens לפי דוח העיצוב: stone ניטרלי, emerald-700 primary יחיד, סמנטיים, `tabular-nums`. פונט Assistant דרך `next/font/google` (13 `@font-face` אומתו ב-build). `<html dir="rtl" lang="he">` גלובלי. Sidebar placeholder עם `ms-`/`me-`/`border-e` בלבד. `src/lib/supabase/{browser,server}.ts` — `anon` key בלבד.
  - **F2 (auth flow):** `middleware.ts` + `lib/supabase/middleware.ts` (`@supabase/ssr`, session refresh) + `lib/auth/public-paths.ts`; עמודי `/login`+`/signup` עם react-hook-form + zod, קוראים ישירות ל-Supabase Auth (**לא tRPC** — הפרויקט מוצהר ללא tRPC/Drizzle). `signUp` שולח `options.data.full_name` שה-trigger מ-B3 קורא. שגיאות ממופות לעברית ב-`auth-errors.ts`.
  - **תוספת תלויות:** `@supabase/ssr`, react-hook-form, zod, `@hookform/resolvers`, clsx, tailwind-merge, cva, Radix slot/label, lucide-react; dev: jsdom, RTL, jest-dom, user-event, `@vitejs/plugin-react`. כולן נגזרות מ-stack מאושר.
  - **תיקון תשתית:** `biome.json` + `css.parser.tailwindDirectives: true`; vitest → jsdom + `cleanup()`.
- **Decisions:**
  - **TDD אמיתי** ל-`isPublicPath`, `mapAuthError`, `LoginForm`, `SignupForm` (RED מאומת). `LogoutButton`/`Sidebar` נכתבו לפני הטסט (סטייה מודעת) — מכוסים בטסטים משמעותיים בדיעבד.
  - **אין ניתוב i18n (עברית בלבד)** — כלי פנימי, לא קהל אנגלי. מתועד כ-Open Question.
  - **קריאה ישירה ל-Supabase JS מה-UI** — RLS + `SECURITY DEFINER` הם שכבת ה-API בפרויקט הזה.
  - **primitives ידניים** בקונבנציות "New York style" מדויקות כדי ש-diff עתידי מול ה-CLI יהיה מינימלי.
  - **`.env.local` עם placeholder** (gitignored) כדי לאפשר dev/build בלי env אמיתי.
- **Verified (בפועל):** `typecheck`/`lint`/`check`/`test`/`build` — exit 0. Vitest **24/24**. `curl`: `/`→307 `/login?next=%2F`; `/documents`→307; `/login`/`/signup`→200 עם `dir="rtl" lang="he"` בפועל; CSS כולל 13 `@font-face` + שרשרת fallback נכונה.
  - **לא אומת (דורש Supabase חי):** signup/login/logout מול שרת אמיתי, יצירת `public.users` דרך ה-trigger, ריענון session.
- **Notes / Caveats:** לא נגעתי ב-`supabase/migrations/` (backend עבד שם במקביל) ולא ב-vault מלבד הרשומה הזו. לא בוצע commit.
- **Related:** [[invoicing-phase-0-plan]], [[2026-08-30-invoicing-ui-design-research]], [[001-data-model-and-rls]]

### 2026-08-30 — F1-F2 spec-review fixes: client factory tests, real Chromium verification, sidebar scope [done]
- **What was done:** תיקון שלושה ממצאי spec-review (`vault/Reviews/spec/2026-08-30-invoicing-f1-f2.md`).
  1. **בדיקות client factories:** `browser.test.ts`/`server.test.ts` מריצים את `createClient()` האמיתי כולל ה-`throw` על env חסר; ל-`server.ts` מוקם רק `cookies()` (API של Next), ומאומת ש-`getAll` נקרא דרך `auth.getSession()`.
  2. **אימות דפדפן אמיתי:** Chromium ב-`/opt/pw-browsers/chromium`; סקריפט חד-פעמי (scratchpad) פתח `/login`+`/signup`+`/` ב-Chromium headless — `dir`/`lang` בפועל ב-DOM, `font-family` בפועל, רקע stone-50, שגיאות ולידציה בעברית, redirects. 7 screenshots. **ממצא:** אזהרת hydration-mismatch מזויפת (`caret-color`) התגלתה כארטיפקט של `page.fill()`+Chromium Password-Leak-Detection; נעלמה לגמרי אחרי מעבר ל-`pressSequentially()` + `--disable-features`.
  3. **Scope creep ב-sidebar:** `NAV_ITEMS` פוצל ל-`ACTIVE_NAV_ITEMS` (`<Link>`) ו-`UPCOMING_NAV_ITEMS` (`<span aria-disabled>` + badge "בקרוב"); טסט TDD מוודא שאינם `role="link"`.
- **Decisions:** `playwright` נשאר devDependency לטובת e2e עתידי; סקריפט האימות הוצא מהפרויקט (כלי אבחון, לא deliverable). לא נגעתי בקבצי backend-builder שלא מפורמטים לפי biome — מחוץ ל-scope.
- **Verified (בפועל):** `typecheck`/`lint`/`test`/`build` — exit 0. Vitest **37/37**. Chromium headless: 5 תרחישים עם screenshots; console נקי פרט ל-DevTools hint ו-`favicon.ico` 404.
- **Notes / Caveats:** favicon חסר (קוסמטי). לא בוצע commit.
- **Related:** [[invoicing-phase-0-plan]], [[2026-08-30-invoicing-ui-design-research]], [[001-data-model-and-rls]]

### 2026-08-30 — Phase 0 Batch 2 (B5-B8): RLS, audit, immutability, issue_document() [done]
- **What was done:** backend-builder ביצע B5-B8 (ה-"לב הרגולטורי") — `0004_rls_helpers.sql` … `0008_issue_function.sql` + downs, ו-`src/lib/errors.ts` (מילון `INV_*`→עברית, TDD).
  - **B5:** `app.current_business_ids()`/`app.has_role()` (definer, schema `app`).
  - **B6:** RLS על **כל 15** הטבלאות — `ENABLE` בלבד, **`FORCE` רק על `business_signing_keys`** (A-4). policies ל-`businesses` (D3.1), `business_members` (bm_self/bm_peers/bm_manage), 8 טבלאות בתבנית גנרית, `document_counters`/`audit_log` (SELECT בלבד), `users` (self), `vat_rates` (global read).
  - **B7:** `app.audit_trigger()` על 11 טבלאות + `audit_log_immutable_trg`; `app.documents_immutable()`, `app.child_rows_locked()`, `app.allocation_requests_locked()`, `app.documents_set_entity_type()`.
  - **B8:** `app.seed_for()`, `app.issue_document()` (11 השלבים), `app.set_start_number()`.
- **באגים אמיתיים שנמצאו ותוקנו תוך כדי אימות:**
  1. **`'pending_allocation'` אינו קיים ב-enum של Phase 0/1** — השוואה גולמית הייתה נכשלת ב-"invalid input value for enum" בכל UPDATE על מסמך שהופק. תוקן ל-`old.status::text`.
  2. **`text[] - text[]` אינו אופרטור תקף** — קוד ה-ADR ל-whitelist ה-PDF לא היה מתקמפל. נבנה מחדש בתוספת (`||`).
  3. **עמודה `generated stored` (`signed_total`) מוצגת `NULL` ב-`NEW` בתוך `BEFORE UPDATE`** — ההשוואה הייתה מסמנת **כל** עדכון לגיטימי כאסור. תוקן בהחרגה מההשוואה.
  4. **`ON DELETE CASCADE` ממסמך טיוטה נחסם ע"י `child_rows_locked()`** (ההורה כבר לא נראה ב-MVCC באותו statement) — חסם כל מחיקת טיוטה עם שורות. תוקן: `NULL` status בזרימת DELETE ⇒ מותר.
  5. **`select (fn(...)).*` מפעילה את הפונקציה פעם אחת לכל עמודה** — לא באג במיגרציות אלא בשיטת הבדיקה; נתיב הייצור (`supabase.rpc`) קורא כ-function-in-FROM, קריאה יחידה. תועד כדי ש-B11/B12 לא ייפלו לאותה מלכודת.
- **שני ממצאי ארכיטקטורה שלא תוקנו (לא בסמכות ה-builder):** `handle_new_auth_user()` מחוץ ל-whitelist; ופונקציות ה-RPC ב-schema `app` שאינו חשוף ל-PostgREST. שניהם הוכרעו ב-ADR-INV-001 Amendment B.
- **Verified (בפועל, Postgres מקומי + auth stub v2 עם roles `anon`/`authenticated`/`service_role`):** RLS מלא על 4+ טבלאות × SELECT/INSERT/UPDATE; FORCE מדויק (0 שורות חריגות); `bm_peers` 100 שאילתות < 22ms (אין רקורסיה); audit + immutability של `audit_log` גם תחת superuser ו-service_role; immutability מלא של `documents` כולל cascade תקין של טיוטה; `issue_document()` — מספור עוקב, סכומי header נדרסים מהשורות, snapshots, סדרת זיכוי נפרדת, `credited_amount` באב, וכל קודי השגיאה; `set_start_number()` 4 תרחישים; **Down/up roundtrip מלא 0001→0008** פעמיים. `pnpm test`/`typecheck`/`check`/`build` — exit 0 (39/39).
- **Notes / Caveats:** `errors.ts` — implementation נכתב לפני test פעם אחת בטעות; תוקן לפי ה-Iron Law. B9-B14 ו-F3-F4 לא בוצעו.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]], [[002-immutability-and-numbering]]

### 2026-08-30 — ADR-INV-001 Amendment B: schema split for the RPC contract + explicit grants [done]
- **What was done:** שני ממצאי הארכיטקטורה של backend-builder מ-B5-B8 הוכרעו. ADR-INV-001 עודכן במקום (Amended: A, B) — סעיף חדש **§D3.3** (חלוקת schemas), סעיף חדש **§D11** (`log_event`), עדכון §D3 (grants), §D3.2 (whitelist 7→9), §D10, ובדיקות CI 6→7.
- **Decisions:**
  - **B-1 — `public.handle_new_auth_user()` נוסף ל-whitelist** (7→9 יחד עם `log_event`). **נשאר ב-`public`**: (א) `supabase_auth_admin` מריץ את ה-INSERT, והצבה ב-`app` הייתה מוסיפה עוד הימור על התנהגות פלטפורמה — בדיוק מה שנדחה ב-A-4; (ב) הימצאותו ב-`public` **אינה** הופכת אותו ל-endpoint, כי PostgREST לא חושף פונקציות שטיפוס ההחזרה שלהן `trigger`.
  - **B-2 — חוזה ה-RPC עובר ל-`public`; `app` נשאר internals ולא ייחשף ל-PostgREST לעולם.** **שתי סיבות בלתי תלויות לדחיית "לחשוף את `app`":** (1) חשיפת schema היא **default-open** — כל פונקציה עתידית הופכת אוטומטית ל-endpoint, בניגוד לכל עמדה אחרת ב-ADR; (2) `db-schemas` הוא **קונפיג ולא DDL** — לא נוסע עם ה-migrations, לא מכוסה ב-CI, ויכול לסטות בין סביבות. גם חלופת ה-wrappers נדחתה (מכפילה חתימות בתמורה לניקיון שמות).
  - **B-3 — תיקון להנחה שלי; ה-builder צדק.** `USAGE` נבדק ב**רזולוציית שם**, וביטוי RLS policy נשמר **מנותח מראש לפי OID** — ולכן policies רצות גם בלי USAGE. הבעיה האמיתית שונה: `revoke all **on schema**` **אינו** נוגע ב-ACL של הפונקציות, ש-Postgres מעניק ל-`PUBLIC` כברירת מחדל. **התיקון:** `revoke execute on all functions in schema app` גורף + `grant execute` נקודתי לשתי פונקציות ה-policy; `USAGE` נשאר מבוטל כשכבה שנייה. נוספה בדיקת CI (ז).
  - **B-4 (יזום, מונע-סחף) — `public.log_event()`:** פונקציה גנרית אחת לאירועי audit שאינם DML, עם רשימת actions סגורה, `actor_id` נכפה מ-`auth.uid()`, ואימות חברות מפורש — במקום פונקציית definer חדשה לכל פיצ'ר.
- **Notes / Caveats:**
  - **הלקח מ-B-3 שווה יותר מהתיקון:** `revoke ... ON SCHEMA` ו-`revoke ... ON FUNCTIONS` הם שני דברים שונים, ו-`USAGE`/`EXECUTE` נבדקים בשלבים שונים לגמרי. אותה משפחת בלבול היא גם השורש של B-2 (הרשאות Postgres מול חשיפת PostgREST).
  - Amendment B לא הוסיף החלטות הטעונות אישור. שני החוסמים של B9/B13 שוחררו.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]], [[002-immutability-and-numbering]]

### 2026-08-30 — ADR-INV-002 Amendment A: the document didn't foot [done]
- **What was done:** שני reviewers בלתי-תלויים התכנסו לאותו פגם — erp-domain-expert (🔴) ו-code-quality (⚠️): **`issue_document()` מקפיאה את סכומי הכותרת אך לא את ערכי השורות.** ADR-INV-002 עודכן במקום (Status: Accepted, Amended A) — סעיף חדש **§D8**, שלב **6א** ב-§D2, הרחבת §D6, ותיקון ב-Implementation Notes. דוחות: `vault/Reviews/domain/2026-08-30-invoicing-phase0-batch2.md`, `vault/Reviews/quality/2026-08-30-invoicing-phase0-batch2.md`.
- **Decisions:**
  - **A-1 — ערכי השורות מחושבים ב-DB, בשלוש שכבות עם פונקציית חישוב אחת משותפת (`app.compute_line()`):**
    1. **trigger `BEFORE INSERT OR UPDATE ON document_lines`** שדורס את `discount_amount`/`line_net`/`line_vat`/`line_total` מהקלט הגולמי + `vat_rate` של ההורה.
    2. **שלב 6א ב-`issue_document()`** — אותה פונקציה רצה שוב עם השיעור הסמכותי מ-`issue_date`, **לפני** חישוב ה-header. מכסה טיוטה שנפתחה תחת 17% ומופקת תחת 18%.
    3. **`check (line_total = line_net + line_vat)`** — invariant אריתמטי מדויק, ללא עיגול וללא הפניה חוצה-טבלה, ולכן לא יכול להיכשל על קלט לגיטימי.
  - **למה גם trigger וגם חישוב בהפקה, ולא רק אחד:** רק-trigger לא מטפל בשינוי שיעור מע"מ בין הטיוטה להפקה; רק-הפקה שובר את ההבטחה המרכזית של ADR-INV-003 §D1 (**תבנית אחת ל-preview ול-PDF**) — אם ההפקה מתקנת בשקט, המשתמש רואה בתצוגה המקדימה מספרים אחרים מאלה שיודפסו.
  - **למה לא עמודות `generated`** (החלופה המתבקשת): `line_vat` תלוי ב-`vat_rate` של **שורת ההורה**, ועמודה generated אינה יכולה לחצות טבלאות. ובנוסף — באג #3 של B7 כבר הוכיח ש-generated מתנהגת כ-`NULL` ב-`NEW` בתוך `BEFORE UPDATE`; הוספת עוד שלוש כאלה לטבלה המכוסה ב-trigger השוואתי הייתה מזמינה חזרה על אותו באג.
  - **למה לא CHECK מלא שקושר `line_net` ל-`quantity*unit_price`:** היה מפיל כל שמירת טיוטה שבה ה-JS עיגל אחרת מ-Postgres. CHECK שיכול להיכשל על קלט לגיטימי הוא מטרד, לא הגנה.
  - **נגזרת מוצרית:** ה-UI **אינו מחשב סכומים**. שולחים `quantity`/`unit_price`/`discount_percent`/`vat_treatment` וקוראים בחזרה מחושב. כל חישוב כספי ב-JS הוא באג.
  - **A-2 — זיכוי רק מול מסמך הכנסה מוכר:** `parent.type in ('receipt','tax_invoice','tax_invoice_receipt')`, אחרת `INV_CREDIT_PARENT_TYPE`. זיכוי הופך אירוע הכנסה/מע"מ **שכבר הוכר**; הצעת מחיר וחשבונית עסקה אינם מכירים בהכנסה ואינם מדווחים למע"מ — אין בהם מה להפוך. **נוסף כ-B5 לרשימת ההחלטות הטעונות חוות דעת רו"ח.**
  - **A-3 — `documents.updated_at`:** trigger `set_updated_at` ל**כל** UPDATE (לא "רק בטיוטה"). `updated_at` נמצא ב-whitelist של §D3 בדיוק כדי שעדכוני מצב אחרי הפקה ישתקפו. **מתקן את הניסוח ב-ADR-INV-001 §Implementation Notes #4**, ומתקן באג פונקציונלי: `documents_drafts_idx` ממיין לפי `updated_at desc`, וללא ה-trigger רשימת הטיוטות ממוינת שגוי.
  - **A-4 —** שמות הפונקציות עודכנו ל-`public.issue_document`/`public.set_start_number` בכל ה-ADR, לפי ADR-INV-001 Amendment B-2. אין יותר צורך לקרוא את ADR-INV-002 "עם מיפוי".
- **Notes / Caveats:**
  - **זה הפגם החמור ביותר שנמצא בפרויקט עד כה, והוא היה שלי.** ה-ADR קבע נכון ש"החישוב סמכותי ב-DB" ויישם את העיקרון על ה-header בלבד — בעוד שהשורות הן **מה שהלקוח והרו"ח קוראים בפועל**. מסמך כזה עומד בכל ה-constraints, נחתם, נשלח, והוא immutable — כלומר התיקון היחיד הוא זיכוי. היה מתגלה אצל הרו"ח, לא ב-CI. מבנה אחיד (Phase 3, רשומות D110) היה מייצר קובץ ביקורת שאינו מסתכם.
  - **`app.compute_line()` הופכת לנקודת כשל יחידה של כל הכספים במערכת** — נוספה הערת אזהרה בראשה ודרישת review של erp-domain-expert בכל נגיעה, בנוסף לטסטי עיגול ברמת יחידה.
  - **סדר BEFORE triggers על `document_lines`:** Postgres מפעיל לפי סדר אלפביתי — יש לוודא ש-`child_rows_locked` יורה לפני ה-trigger המחשב.
  - נוספו 6 בדיקות DoD חדשות (§Implementation Notes #4), ובראשן בדיקת ה-"foots" הקנונית: `sum(line_total) = documents.total_amount` על כל אחד מששת סוגי המסמכים.
  - **Batch 2 אינו מתקבל ב-acceptance עד שהתיקון מיושם ומאומת.** אין escalation פתוח לארכיטקט.
- **Related:** [[invoicing-phase-0-plan]], [[002-immutability-and-numbering]], [[003-pdf-signing-storage]], [[001-data-model-and-rls]]
