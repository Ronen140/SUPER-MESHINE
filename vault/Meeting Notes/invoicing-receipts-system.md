# Invoicing & Receipts System

## Overview

פרויקט חדש שהמייסד ביקש לפתוח: מערכת חשבוניות וקבלות לעסק — הפקת חשבונית מס, קבלה, חשבונית מס-קבלה, חשבונית עסקה וזיכוי, ניהול לקוחות, מע"מ, מספור רציף וייצוא לרו"ח. כרגע קיימת רק תיקיית פרויקט התחלתית `invoicing-receipts/` בשורש הריפו (מחוץ ל-pnpm workspace של ה-ERP) עם README ומסמך דרישות. אין קוד; ה-scope וה-stack ייקבעו באפיון.

## Open Questions

- מיצוב: כלי פנימי לעסק של המייסד, מוצר עצמאי, או מודול Billing של SUPER-MESHINE? (הרקע מטה לכלי פנימי תחילה.)
- האם התיקייה תצורף בהמשך ל-pnpm workspace (`apps/*`) או תישאר פרויקט נפרד?
- רגולציה: מספר הקצאה (חשבוניות ישראל) — תלוי בסכומי החשבוניות של העסק; תאימות להוראות ניהול ספרים.
- מה הכאבים הקונקרטיים ב-Xterm/Morning/Ypay מעבר למחיר (UX? דוחות? אוטומציה?) — לתעד לפני עיצוב.
- סוג הישות (עוסק מורשה / חברה) ונפח מסמכים חודשי.
- Stack, סליקה, רב-מטבעיות — מפורט ב-`invoicing-receipts/docs/requirements.md`.

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
