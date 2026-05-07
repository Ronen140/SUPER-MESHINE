# Founding Decisions

## Overview

שלוש החלטות יסוד שנפלו בתחילת Phase 1 (pre-product) ומשפיעות על כל ה-ADRs הבאים. ההחלטות התקבלו ע"י ה-CEO לפני כתיבת קוד מוצר, אחרי שהוצגו trade-offs מפורטים לכל אחת. הן ה-input ל-ADRs 002-006 ש-architect יכתוב ב-Round 5.

## Open Questions

- בחירת וורטיקל (טרם נסגר — ממתין לדוח `vertical-researcher` ולשיחות גילוי).
- האם נדרש ADR נפרד לכל אחת מההחלטות האלה או שהן נכללות ב-ADRs הקיימים? (ההחלטה: כן — כל אחת מקבלת ADR נפרד, כי כולן חוצות-מודולים.)

## Session Log

### 2026-05-07 — Three founding decisions made [done]

- **What was done:**
  - הוצגה מטריצת trade-offs לשלוש החלטות פתוחות, וההחלטות התקבלו דרך AskUserQuestion.

- **Decisions:**

  **D1 — Stack: TypeScript + tRPC + Drizzle.**
  *Why:* סולו/2 = שפה אחת לכל ה-stack = מהירות פיתוח קריטית. type-safety end-to-end (tRPC) חוסך זמן רב על API contracts. Anthropic SDK + Vercel AI SDK + MCP — כולם מובהקים ב-JS. ההפסד הפוטנציאלי בעולם decimal/ETL פתיר עם ספריות (decimal.js, BullMQ).
  *Reversal conditions:* אם נמצא שצוואר בקבוק חישובי דורש Python — אפשר להוציא service נפרד, לא לעשות rewrite.

  **D2 — Hosting: Cloud-only ב-MVP. on-prem רק כשלקוח אנטרפרייז משלם 250K+ ש"ח/שנה.**
  *Why:* תקציב מינימלי בתחילת הפיתוח. Vercel + Supabase free tier = 0 ש"ח/חודש עד שיש לקוחות. on-prem דורש פי 3-5 זמן פיתוח + שובר את ה-AI native (Process Agents/Customization Agent דורשים Anthropic API).
  *Reversal conditions:* לקוח אנטרפרייז ראשון משלם מחיר שמכסה את החוב הטכני של on-prem. גם אז: BYOC > on-prem טהור.

  **D3 — schema-architect: ממוזג ב-architect כרגע.**
  *Why:* MVP לא דורש עומק SQL מיוחד. architect כבר מכסה Data modeling ב-scope שלו. ה-skill `skill-creator` יוצר סוכן חדש בעוד שנה במקסימום 30 דקות.
  *Reversal conditions:* כש-(א) חשבונאות period-close עם currencies מרובים, (ב) BOM rev עם substitutions, או (ג) time-series ייצור עם ביצועי שאילתות קריטיים — מפצלים אז.

- **Notes / Caveats:**
  - שלוש ההחלטות יקבלו ADRs רשמיים ב-Round 5 (ADR-002 multi-tenancy תלוי ב-D2; ADR-003 stack מתעד את D1; הרשאות סוכנים מתעדות את D3).
  - העדכון ב-CLAUDE.md תחת "Stack" כבר מתאים ל-D1 (TS+tRPC+Drizzle) — אין צורך בעריכה.
- **Related:** [[bootstrap]], [[vertical-selection]] (ייווצר), ADRs ייווצרו ב-`vault/Architecture Decisions/`.
