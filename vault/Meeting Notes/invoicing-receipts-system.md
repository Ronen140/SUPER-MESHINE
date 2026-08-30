# Invoicing & Receipts System

## Overview

פרויקט חדש שהמייסד ביקש לפתוח: מערכת חשבוניות וקבלות **רב-עסקית** למייסד ולחבריו — מספר עסקים נפרדים (עוסק פטור + עוסק מורשה לפחות) במערכת אחת, חינמית לתפעול. ליבה: קבלות לעוסק פטור, חשבונית מס / מס-קבלה / זיכוי לעוסק מורשה, קטלוג פריטי עבודה עם סכום פתוח עד הפקה, מצב טיוטה→הפקה עם נעילה ומספור רציף, ייצוא לרו"ח. נפח צפוי זעום (~2 מסמכים/חודש לעסק). הפרויקט יושב ב-`invoicing-receipts/` בשורש הריפו (מחוץ ל-pnpm workspace). תוכנית פיתוח מלאה ב-`docs/plan.md`; **הארכיטקטורה נקבעה ב-3 ADRs ב-`invoicing-receipts/docs/adr/`** (ADR-INV-001/002/003, כולם Proposed). אין קוד עדיין — Phase 0 ממתין לאישור המייסד.

## Open Questions

- **אישור המייסד על ה-plan** (`invoicing-receipts/docs/plan.md`): stack, חלוקת פאזות.
- **אישור 17 ההחלטות המסומנות ב-ADRs** (A1-A6, B1-B4, C1-C7) — מתוכן 6 דורשות **חוות דעת רו"ח** לפני production: זיכוי יחיד גם לקבלות (A1), מספור continuous בין שנות מס (A2), שריפת מספר בסירוב הקצאה (B1), איסור גורף על תיקון מסמך שהופק (B2), זיכוי חלקי/שרשור (B3), מסמך issued ללא PDF (B4), ותעודה self-issued שמוצגת כ-Validity Unknown (C1).
- **החלטה כספית פתוחה (C3):** Supabase Free משעה פרויקט אחרי 7 ימי חוסר-פעילות ואינו שומר גיבויים כלל — לא תואם ארכיון מס של 7 שנים. ההמלצה: להתחיל ב-₪0 עם עותק חוץ מוצפן ל-R2/B2 + keepalive, ולעבור ל-Pro ($25/חודש) כשיהיו 3+ עסקים אמיתיים.
- **סוגיה משפטית חדשה (A5):** אחסון PII של לקוחות של עסקים שאינם של המייסד — חובות מנהל מאגר תחת חוק הגנת הפרטיות תיקון 13 (בתוקף מ-2025). מחוץ לסמכות הארכיטקט.
- חתימה אלקטרונית — נפתר עקרונית (מאובטחת מספיקה, מפתח self-generated פר-עסק, ₪0). שיורי לפני production: אימות נוסח ההוראות מול gov.il/nevo (המקורות הרשמיים חסומים ב-proxy) + חוו"ד רו"ח על "שליטה בלעדית" במפתח בשרת.
- לוח ספי מספר ההקצאה (10,000 ₪ מ-1.1.2026, 5,000 ₪ מ-1.6.2026) אומת ממקורות משניים בלבד — לאמת מול gov.il לפני Phase 2; תהליך ההרשמה ל-API רשות המסים טרם נחקר.
- מיצוב ארוך-טווח: כלי פרטי לחבורה או גרעין מודול Billing של SUPER-MESHINE? (לא חוסם MVP. אם כן — יידרש יישור מול ADR-002 שאין בו many-to-many של user↔tenant, ומול ADR-006 בגלל ה-audit ב-triggers בלבד.)
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
