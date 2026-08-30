# Invoicing & Receipts System

## Overview

פרויקט חדש שהמייסד ביקש לפתוח: מערכת חשבוניות וקבלות לעסק — הפקת חשבונית מס, קבלה, חשבונית מס-קבלה, חשבונית עסקה וזיכוי, ניהול לקוחות, מע"מ, מספור רציף וייצוא לרו"ח. כרגע קיימת רק תיקיית פרויקט התחלתית `invoicing-receipts/` בשורש הריפו (מחוץ ל-pnpm workspace של ה-ERP) עם README ומסמך דרישות. אין קוד; ה-scope וה-stack ייקבעו באפיון.

## Open Questions

- מיצוב: מוצר עצמאי או מודול Billing עתידי בתוך SUPER-MESHINE ERP? (ההחלטה משפיעה על מיקום בקוד, multi-tenancy ושיתוף packages.)
- האם התיקייה תצורף בהמשך ל-pnpm workspace (`apps/*`) או תישאר פרויקט נפרד?
- רגולציה: מספר הקצאה (חשבוניות ישראל), רישום כתוכנה לניהול ספרים.
- Stack, קהל יעד, סליקה, רב-מטבעיות — מפורט ב-`invoicing-receipts/docs/requirements.md`.

## Session Log

### 2026-08-30 — Open project folder [planned]
- **What was done:** נפתחה תיקיית `invoicing-receipts/` בשורש הריפו עם `README.md` (מטרה + scope טיוטה + מבנה) ו-`docs/requirements.md` (שאלות פתוחות לאפיון + דרישות ליבה ראשוניות). נדחף ל-branch `claude/invoicing-receipts-system-2asysv`.
- **Decisions:** התיקייה הושארה מחוץ ל-pnpm workspace בכוונה — "פרויקט חדש" ולא מודול של ה-ERP, עד שהמייסד יכריע על המיצוב. לא נכתב קוד — רק scaffolding תיעודי, כי הבקשה הייתה לפתוח תיקייה בלבד.
- **Notes / Caveats:** אם יוחלט שזה מודול ERP, נכון יהיה להעביר ל-`apps/` או `packages/` ולערב את architect (schema, multi-tenancy) לפני כתיבת קוד.
- **Related:** [[bootstrap]], [[founding-decisions]]
