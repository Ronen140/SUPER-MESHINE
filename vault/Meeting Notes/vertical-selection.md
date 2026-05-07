# Vertical Selection

## Overview

תהליך בחירת הוורטיקל הראשון של SUPER-MESHINE. הצעד הראשון — מחקר 5 וורטיקלים מועמדים — בוצע. הצעד הבא: שיחות גילוי מצומצמות (3-5) עם 1-2 וורטיקלים מובילים, ואז ADR-001 שמתעד את ההחלטה הסופית.

**הוורטיקלים שנבחנו:** קוסמטיקה, מזון מעובד / private label, מתכת/מכניקה, אלקטרוניקה/הרכבה, contract manufacturing כללי.

## Open Questions

- איזה 1-2 וורטיקלים מתוך החמישה מצדיקים שיחות גילוי? (להחליט אחרי קריאת הדוח המלא).
- כמה שיחות גילוי לכל וורטיקל? (ההמלצה הראשונית: 3-5 שיחות לכל וורטיקל מוביל).
- מי הציטוטי כאב הכי אמיתיים — צריך אימות נוסף ב-LinkedIn / שיחה ישירה.
- Headcount של חברות ספציפיות לא פומבי לרוב — דורש pre-call check ב-LinkedIn / Dun & Bradstreet.

## Session Log

### 2026-05-07 — Vertical research v1 [done]

- **What was done:**
  - הופעל סוכן vertical research דרך general-purpose subagent (כי הסוכן הקנוני נטען רק ב-session הבא).
  - 43 קריאות tool, ~120K tokens, 7 דקות עבודה.
  - דוח נכתב ל-`vault/Discovery/2026-05-07-vertical-mapping-v1.md` (349 שורות).
- **Key findings:**
  - **85 חברות ישראליות** רשומות לפנייה (יעד: 75) — 17 לכל וורטיקל.
  - **14 ציטוטי כאב מתועדים** מ-G2/Capterra/SoftwareAdvice (יעד: 5) — Priority complexity/API instability, SAP B1 TCO, Odoo accounting gaps, Katana pricing tier creep, NetSuite cost.
  - **רגולציה לכל וורטיקל ממופה** עם URLs רשמיים (MoH Cosmetics 2023, ISO 22716, ISO 22000/HACCP, AS9100, ISO 13485, RoHS/REACH, FDA 21 CFR).
  - **TAM נתונים:** קוסמטיקה ~USD 830M (Mordor); D&B מציג 1,062 מפעלי מזון + 538 metalworking + 67 contract-mfg + 100 electronics + 89 PCB.
- **Strongest signal per vertical:**
  - **קוסמטיקה:** רגולציית 2023 חדשה של משרד הבריאות + ISO 22716 GMP יוצרות חובת batch-recordkeeping דיגיטלי + "Responsible Person" — עומס על SMB עם 41-44 יצרנים.
  - **מזון מעובד:** Kosher/HACCP/ISO 22000 = lot/batch traceability לא ניתן למשא ומתן. SMB tail רחב.
  - **מתכת:** AS9100/ISO 13485 traceability ל-aerospace/defense/medical = feature-map נקי. Katana/MRPeasy חלשים ב-job-shop.
  - **אלקטרוניקה:** RoHS/REACH BoM-substance obligations + clusters בפ"ת/יקנעם/מגדל העמק.
  - **Contract manufacturing:** Multi-customer/multi-tenant inventory & IP separation = פער ידוע ב-Odoo/MRPeasy default tenancy.
- **Decisions:**
  - אין החלטה אסטרטגית בשלב הזה — הדוח עובדות בלבד, ללא בחירת וורטיקל. ההחלטה תתקבל אחרי שיחות גילוי.
- **Notes / Caveats:**
  - **headcount של חברות ספציפיות מסומן ⚠️ unverified** ברוב המקרים. דרושה pre-call verification ב-LinkedIn / Dun & Bradstreet לפני יצירת קשר.
  - **לא הושגו ציטוטים מ-Reddit / פורומים בעברית** — חיפוש בעברית הניב פחות תוצאות. נסומן כ-Open Question למחקר נוסף.
  - שתי קריאות WebFetch (ensun, Dun's 100) החזירו 403/429 — הסוכן עבר ל-WebSearch summaries כ-fallback.
  - לא נתקלה הזרקת prompt בתוכן.
- **Related:** [[bootstrap]], [[founding-decisions]], `vault/Discovery/2026-05-07-vertical-mapping-v1.md`
