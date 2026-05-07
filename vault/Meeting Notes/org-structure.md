# Org Structure

## Overview

מבנה ארגוני היררכי לסוכני SUPER-MESHINE: CEO (Main Claude session) + 4 מנהלי מחלקות + 5 workers. נבנה ב-Round 6.5 בעקבות בקשה מהמייסד שלכל צוות עובדים יהיה מנהל, ולמנהלי מחלקות יהיה מנכ"ל. ה-CEO הוא ה-session הראשי בגלל אילוץ Claude Code שסאב-אייג'נטים לא מפעילים סאב-אייג'נטים.

## Open Questions

- **תפקוד באמת:** האם המבנה היררכי יעבוד בפועל עם האילוץ של dispatch דרך CEO? יבחן בסבב הראשון של פיתוח אמיתי (Round 7).
- **התחזוקה:** האם 9 הגדרות סוכן + 2 skills + 4 PRDs לא יוצרים drift? יקבע אחרי 5 פיצ'רים.
- **DevOps department:** הוחלט להישאר עם setup-deployment skill בלבד. סף לפיצול ל-department: 3+ כאבי deployment בחודש.

## Session Log

### 2026-05-07 — Round 6.5: Add management layer [done]

- **What was done:**
  - יצירת 2 סוכני מנהל חדשים: `engineering-manager.md`, `qa-manager.md`. שניהם planner+reviewer+adjudicator (לא dispatcher) — ה-CEO הוא ה-dispatcher בפועל.
  - יצירת 2 skills חדשים: `manager-delegation-pattern` (פרוטוקול 5 שלבים שה-CEO משתמש בו), `setup-deployment` (8 sections — Vercel, Supabase, Sentry, PostHog, Axiom, GitHub Actions, cost monitoring, troubleshooting — מחליף את devops-engineer agent).
  - עדכון `CLAUDE.md` עם סקציית "Org Structure" — diagram, decision authority table, escalation table, 5-phase workflow.
  - יצירת 4 PRDs מחלקתיים ב-`vault/Departments/`: architecture, research, engineering, qa-and-compliance + `_index.md`.

- **Decisions:**
  - **CEO = Main Claude session** (לא סוכן נפרד). אילוץ ארכיטקטוני של Claude Code: סאב-אייג'נטים לא מדספצ'ים אחרים. המייסד מדבר עם CEO; CEO מדספץ' מנהלים; מנהלים מתכננים; CEO מדספץ' workers לפי תוכנית מנהל; workers חוזרים ל-CEO; CEO מעביר ל-מנהל ל-acceptance.
  - **player-manager pattern** למחלקות של אחד: architect ו-vertical-researcher הם שניהם המנהל וה-worker.
  - **Decision authority** מוגדרת מפורש לכל מנהל (מה מותר להחליט עצמאית, מתי לסלם).
  - **מבנה לא עתידי-מוכן ל-Claude Agent SDK:** אם בעתיד נחליט לבנות orchestration אמיתי מחוץ ל-Claude Code, המבנה הנוכחי יעבור 1:1 לשם.

- **Notes / Caveats:**
  - **המבנה לא נבחן בפועל.** ה-Engineering ו-QA departments לא הריצו עוד פיצ'ר אמיתי. Round 7 יהיה ה-test הראשון של הפרוטוקול.
  - **drift risk:** 9 קבצי הגדרת סוכן + 2 skills + 4 PRDs. אם בסבב 7 מתגלה שמשהו לא ברור — נעדכן ולא נבנה workarounds.
  - **CLAUDE.md הוא single source of truth** למבנה הארגוני. PRDs הם הרחבות, לא מחליפים.

- **Related:** [[bootstrap]], [[founding-decisions]], [[dev-agents-team]], [[vertical-selection]], `vault/Departments/_index.md`.
