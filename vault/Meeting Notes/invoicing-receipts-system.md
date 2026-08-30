# Invoicing & Receipts System

## Overview

פרויקט חדש שהמייסד ביקש לפתוח: מערכת חשבוניות וקבלות **רב-עסקית** למייסד ולחבריו — מספר עסקים נפרדים (עוסק פטור + עוסק מורשה לפחות) במערכת אחת, חינמית לתפעול. ליבה: קבלות לעוסק פטור, חשבונית מס / מס-קבלה / זיכוי לעוסק מורשה, קטלוג פריטי עבודה עם סכום פתוח עד הפקה, מצב טיוטה→הפקה עם נעילה ומספור רציף, ייצוא לרו"ח. נפח צפוי זעום (~2 מסמכים/חודש לעסק). הפרויקט יושב ב-`invoicing-receipts/` בשורש הריפו (מחוץ ל-pnpm workspace). תוכנית פיתוח מלאה ב-`docs/plan.md`; **הארכיטקטורה נקבעה ב-3 ADRs ב-`invoicing-receipts/docs/adr/`** (ADR-INV-001/002/003), כולם **Accepted** (2026-08-30, CEO, ע"פ מנדט המייסד ל-Phase 0 build; 17 פריטים A/B/C דורשים חוו"ד רו"ח/מייסד לפני production אך אינם חוסמים בנייה). **Engineering plan ל-Phase 0 נכתב** ע"י engineering-manager: `vault/Engineering/invoicing-phase-0-plan.md` — 13 subtasks ל-backend-builder (scaffold, schema מלא, RLS, audit, immutability, `issue_document()`, יצירת מפתח חתימה, buckets, גיבוי חוץ) + 4 subtasks ל-frontend-builder (שלד app מינימלי, auth, יצירת עסק, business switcher — עורך המסמכים/דשבורד/PDF נשארים Phase 1). עדיין אין קוד — הפיתוח בפועל טרם החל.

## Open Questions

- **⚠️ פער ב-ADR-INV-001 שחוסם 2 מתוך 17 subtasks של Phase 0 (זוהה ע"י engineering-manager, 2026-08-30):** אין RLS policy מוגדרת לטבלת `businesses` עצמה; סתירה בבדיקת ה-CI של D7 (`businesses` חסרת `business_id` ולא ברשימה הסגורה); ובעיית ביצה-ותרנגולת ב-`bm_manage` policy — אין מנגנון bootstrap ל-owner ראשון ב-`business_members` בעת יצירת עסק חדש. דורש תשובת ארכיטקט לפני שמתחילים את subtask "יצירת עסק + מפתח חתימה" (B9/F3 בתוכנית ה-Phase 0). פירוט מלא ב-[[invoicing-phase-0-plan]] §Escalation.
- **אישור 17 ההחלטות המסומנות ב-ADRs** (A1-A6, B1-B4, C1-C7) — מתוכן 6 דורשות **חוות דעת רו"ח** לפני production: זיכוי יחיד גם לקבלות (A1), מספור continuous בין שנות מס (A2), שריפת מספר בסירוב הקצאה (B1), איסור גורף על תיקון מסמך שהופק (B2), זיכוי חלקי/שרשור (B3), מסמך issued ללא PDF (B4), ותעודה self-issued שמוצגת כ-Validity Unknown (C1). לא חוסם את בניית Phase 0.
- **החלטה כספית פתוחה (C3):** Supabase Free משעה פרויקט אחרי 7 ימי חוסר-פעילות ואינו שומר גיבויים כלל — לא תואם ארכיון מס של 7 שנים. ההמלצה: להתחיל ב-₪0 עם עותק חוץ מוצפן ל-R2/B2 + keepalive, ולעבור ל-Pro ($25/חודש) כשיהיו 3+ עסקים אמיתיים. engineering-manager בחר R2 (על פני B2) כברירת מחדל למימוש — שקול לוודא מול המייסד אם יש כבר חשבון קיים באחת מהן.
- **סוגיה משפטית חדשה (A5):** אחסון PII של לקוחות של עסקים שאינם של המייסד — חובות מנהל מאגר תחת חוק הגנת הפרטיות תיקון 13 (בתוקף מ-2025). מחוץ לסמכות הארכיטקט.
- חתימה אלקטרונית — נפתר עקרונית (מאובטחת מספיקה, מפתח self-generated פר-עסק, ₪0). שיורי לפני production: אימות נוסח ההוראות מול gov.il/nevo (המקורות הרשמיים חסומים ב-proxy) + חוו"ד רו"ח על "שליטה בלעדית" במפתח בשרת.
- לוח ספי מספר ההקצאה (10,000 ₪ מ-1.1.2026, 5,000 ₪ מ-1.6.2026) אומת ממקורות משניים בלבד — לאמת מול gov.il לפני Phase 2; תהליך ההרשמה ל-API רשות המסים טרם נחקר.
- מיצוב ארוך-טווח: כלי פרטי לחבורה או גרעין מודול Billing של SUPER-MESHINE? (לא חוסם MVP. אם כן — יידרש יישור מול ADR-002 שאין בו many-to-many של user↔tenant, ומול ADR-006 בגלל ה-audit ב-triggers בלבד.)
- **היקף ה-frontend ב-Phase 0:** engineering-manager הכריע לכלול שלד app מינימלי + auth + יצירת עסק + business switcher (לא רק CI assertions) כדי לספק את ה-DoD המקורי של `plan.md` ("משתמש נרשם, יוצר עסק, מחליף בין עסקים"). נקודת יידוע ל-CEO/מייסד לפני dispatch, לא חסימה.
- קודי הצבע המדויקים של Morning לא אומתו (אתר חסום ב-proxy) — לא חוסם.

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
- **What was done:** ה-architect כתב שלושה ADRs ב-`invoicing-receipts/docs/adr/` (סטטוס Proposed בכולם):
  - **ADR-INV-001** `001-data-model-and-rls.md` — schema מלא (13 טבלאות + 9 enums), RLS על `business_id` דרך `business_members`, מודל 4 roles, ורשימה סגורה של שלושה נתיבי `service_role`.
  - **ADR-INV-002** `002-immutability-and-numbering.md` — הקצאת מספר מטבלת מונים ב-`UPDATE...RETURNING`, `app.issue_document()` כנתיב הפקה יחיד, trigger immutability עם whitelist בגישת default-deny, snapshots, ומכונת מצבים סגורה.
  - **ADR-INV-003** `003-pdf-signing-storage.md` — Chromium serverless לרינדור, pyHanko ל-PAdES-B-T, envelope encryption למפתחות, אחסון + עותק חוץ, ועמוד צפייה ציבורי.
- **Decisions (מרכזיות):**
  - **RLS משותף** (לא schema-per-business) — תואם ADR-002 של הבית; אבל היחס user↔business הוא **many-to-many** דרך `business_members`, בשונה מ-`users.tenant_id` היחיד של ה-ERP.
  - **אכיפת "אילו מסמכים מותרים לפי סוג ישות" ב-CHECK constraint על עמודת snapshot** `business_entity_type` בשורת המסמך — ולא trigger, לא composite FK ולא app-layer. הנימוק: snapshot הופך את ההיסטוריה למתארת את עצמה, כך שעסק שעובר פטור→מורשה לא מחליק אחורה על מסמכים ישנים.
  - **טבלת מונים ולא `SEQUENCE`** — רצפים ב-Postgres הם non-transactional ומייצרים חורים במספור ב-rollback. הפרה חוקית ישירה.
  - **immutability בגישת default-deny:** ה-trigger משווה את כל השורה פחות whitelist — עמודה חדשה עתידית תהיה immutable אוטומטית.
  - **`issued` הוא מצב סופי.** "מבוטל" הוא תכונה נגזרת (`credited_amount = total_amount`), לא סטטוס. `cancelled` שמור אך ורק לסירוב מספר הקצאה.
  - **הפקת PDF מחוץ ל-transaction** — כשל Chromium לא מגלגל אחורה הפקה (זה היה מייצר חור במספור מסיבה טכנית). הצינור אידמפוטנטי כי ה-snapshot קפוא.
  - **PAdES-B-T ולא B-LT** — תעודה self-issued חסרת OCSP/CRL, אין מידע ביטול להטמיע; הצהרה על B-LT הייתה שקר טכני.
  - **KEK ב-env של Vercel מול ciphertext ב-Supabase** (ולא Supabase Vault) — פיצול בין שתי מערכות; ובנוסף pgsodium במחזור deprecation.
  - **מקור והעתק כשני קבצים חתומים נפרדים** — אי אפשר לסמן "העתק" על קובץ חתום בדיעבד.
  - **סטייה מודעת מ-ADR-006:** audit ב-DB triggers בלבד, ללא app middleware (אין סוכני AI, ולקוח Supabase עוקף כל ORM middleware).
- **Notes / Caveats:**
  - **17 החלטות סומנו כדורשות אישור** (A1-A6 / B1-B4 / C1-C7), מהן 6 דורשות חוות דעת רו"ח.
  - **ממצא חדש:** Supabase Free משעה פרויקט אחרי 7 ימי חוסר-פעילות, 0 ימי גיבוי, ומוחק פרויקטים מושעים לאורך זמן → **עותק חוץ מוצפן + keepalive הוגדרו כחלק מ-Phase 0**, לא כשיפור עתידי.
  - Vercel Hobby: 250MB לפונקציית Node (ההרחבה ל-5GB היא Fluid Compute בלבד), 60ש׳ תקרה, ו-500MB לפונקציות Python — לכן `@sparticuz/chromium-min` ו-pyHanko בשני runtimes באותו פרויקט.
  - ה-ADRs נכתבו בתיקיית הפרויקט ולא ב-`vault/Architecture Decisions/` לפי הנחיה מפורשת — הפרויקט עצמאי. אם ימוזג ל-ERP, יידרש מיזוג גם של ה-ADRs.
- **Related:** [[002-multi-tenancy-strategy]], [[006-audit-log-and-agent-action-gating]], [[2026-08-30-digital-signature-computerized-documents]], [[2026-08-30-invoicing-services-feature-benchmark]]

### 2026-08-30 — Engineering Phase 0 plan: 17 subtasks + RLS gap escalation [planned]
- **What was done:** engineering-manager קרא את שלושת ה-ADRs (עכשיו Accepted), את `plan.md`, ואת מצב הקוד (עדיין ריק — רק docs). כתב work plan מלא ל-Phase 0 ב-`vault/Engineering/invoicing-phase-0-plan.md`: 13 subtasks ל-backend-builder (scaffold pnpm+Next.js+Supabase CLI ללא Drizzle; migrations 0001-0008 ל-extensions/enums/טבלאות/RLS helpers/RLS policies/audit+immutability triggers/`issue_document()`; `api/keygen.py`+`POST /api/businesses`; isolation test 12 assertions; numbering race test 20 concurrent; CI pipeline עם 4 בדיקות מטא + down/up roundtrip; ops jobs keepalive+backup+restore-test) ו-4 subtasks ל-frontend-builder (app shell+RTL, auth, יצירת עסק, business switcher).
- **Decisions:**
  - **הכרעת גבול Phase 0/1 ל-frontend:** נכלל שלד app מינימלי (auth+יצירת עסק+switcher) ב-Phase 0, לא רק ב-Phase 1, כדי לספק את ה-DoD המקורי של `plan.md` ("משתמש נרשם, יוצר עסק, מחליף בין עסקים") עם משתמש אנושי אמיתי — לא רק CI assertions סינתטיים. עורך המסמכים/קטלוג/דשבורד/PDF rendering נשארים Phase 1 במלואם.
  - **Stack ל-migrations:** SQL גולמי + Supabase CLI migrations (`supabase/migrations/*.sql`), **לא** Drizzle — לפי מה שה-ADRs כותבים במפורש (raw `create table`/`create function` עם `SECURITY DEFINER`). שונה מה-ERP הראשי.
  - **R2 נבחר על פני B2** לעותק הגיבוי החוץ (שתיהן שקולות ב-ADR) — החלטת builder-level.
  - **פישוט בדיקת race:** מזריקים שורת `business_signing_keys` דמה ישירות ל-DB (לא דרך keygen.py אמיתי) כדי לפרק את תלות בדיקת המספור המקבילה מ-subtask יצירת המפתח.
- **Notes / Caveats:**
  - **⚠️ Escalation לארכיטקט (חוסם 2 מ-17 subtasks בלבד, לא את השאר):** אין RLS ל-`businesses` עצמה; סתירה בבדיקת ה-CI של D7 (`businesses` לא ברשימה הסגורה ואין לה `business_id`); ואין מנגנון bootstrap ל-owner ראשון ב-`business_members` (chicken-and-egg מול `bm_manage` policy שדורשת owner קיים). ככל הנראה נדרש RPC `app.create_business()` בדפוס `SECURITY DEFINER` כמו `issue_document()`. subtasks B1-B8 ו-F1-F2 יכולים להתקדם מיד ללא תלות בתשובה.
  - `api/keygen.py` הוא Python — חריג יחיד בפרויקט TypeScript-first, מסומן כסיכון תזמון (לא חסימה).
  - CI צריך `auth.uid()`/`auth.users` אמיתיים (Supabase-specific) — backend-builder צריך להחליט בין `supabase start` (Docker, איטי) ל-stub ידני (מהיר, סיכון drift) בזמן ביצוע.
- **Related:** [[invoicing-phase-0-plan]], [[001-data-model-and-rls]], [[002-immutability-and-numbering]], [[003-pdf-signing-storage]], [[2026-05-07-1700-bootstrap-dev-env-7a-plan]]
