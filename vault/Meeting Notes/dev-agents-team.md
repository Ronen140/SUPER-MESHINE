# Dev Agents Team Composition

## Overview

ניתוח שעמד מאחורי בחירת 7 סוכני הפיתוח (במקום 10 שעלו לדיון). השיקול: לסולו/2 פאונדרים, כל סוכן הוא חוב תחזוקתי — צריך הצדקה ברורה לכל אחד. הניתוח השווה כל סוכן מועמד מול חלופות זולות יותר (skill, מיזוג בסוכן קיים, embedded checklist) לפני שהומלץ ליצור אותו.

הצוות הסופי: `architect`, `vertical-researcher` (קיימים) + `spec-reviewer`, `code-quality-reviewer`, `backend-builder`, `frontend-builder`, `erp-domain-expert` (Round 6) + skill `setup-deployment` (Round 6).

## Open Questions

- `security-auditor` כסוכן נפרד אם review של auth הופך ל-bottleneck (סף לפיצול: 3+ פעמים שcode-quality-reviewer מחזיר ממצאי security בסבב אחד).
- `erp-qa` כסוכן נפרד אם business logic מצריכה התמחות נפרדת (סף לפיצול: erp-domain-expert מתחיל להחזיר checklists ארוכים מ-2 עמודים).
- `devops-engineer` כסוכן אם deployment חוזר ל-CEO/backend-builder יותר מ-3 פעמים בחודש.

## Session Log

### 2026-05-07 — Agent team trimmed from 10 to 7 [done]

- **What was done:**
  - 7 קריטריונים נבחנו לכל סוכן מועמד: תדירות שימוש, סיכון בהיעדר, חלופה זולה (skill/embedded), שלב הפרויקט, עלות יצירה+תחזוקה, השפעה על מהירות פיתוח, יכולת פיצול עתידי.
  - 3 סוכנים שתוכננו במקור הוסרו / מוזגו, 1 הוחלף ב-skill.

- **Decisions:**

  **קוצצו / מוזגו:**

  | סוכן | פעולה | הסיבה הקצרה | מתי לחזור |
  |---|---|---|---|
  | `schema-architect` | מוזג ב-`architect` (D3) | architect כבר מכסה Data modeling; MVP לא דורש עומק SQL | schemas מורכבים (multi-currency close, BOM rev, time-series perf) |
  | `devops-engineer` | הוחלף ב-skill `setup-deployment` | Vercel + Supabase = setup חד-פעמי של 2 שעות; לא מצדיק agent | deployment חוזר ל-CEO 3+ פעמים בחודש |
  | `security-auditor` | מוזג ב-`code-quality-reviewer` (security checklist חובה) | סקירת auth ב-MVP זה ~10% מה-PRs; checklist במקום סוכן | code-quality-reviewer מחזיר ממצאי security 3+ סבבים |
  | `erp-qa` | מוזג ב-`erp-domain-expert` (business logic QA) | overlap עם spec-reviewer + erp-domain-expert | checklist של erp-domain-expert ארוך מ-2 עמודים |

  **נשמרו:**
  - **`architect`** (קיים) — ADRs ו-design decisions. ייחודי בכך שהוא read-mostly ומחזיק במצב decision.
  - **`vertical-researcher`** (קיים) — מחקר חיצוני. ייחודי בגישה ל-WebSearch/WebFetch ובכללי הציטוט.
  - **`spec-reviewer`** — קוד מול spec. ייחודי בגישת רוורס (מסמך לקוד, לא קוד למסמך).
  - **`code-quality-reviewer`** — איכות + security. עומס סקירה מצדיק סוכן ייעודי.
  - **`backend-builder`** — implementer. עומס יישום מצדיק סוכן ייעודי.
  - **`frontend-builder`** — implementer. UI שונה מספיק מ-backend (state, accessibility, design tokens) להצדיק סוכן נפרד.
  - **`erp-domain-expert`** — דומיין + business logic QA. ידע ERP עמוק (חשבונאות double-entry, MRP nettings, FEFO, FDA 21 CFR) שונה מספיק מתפקיד implementer.

  **חיסכון מוערך:** ~90 דקות זמן יצירה + ~40% פחות overhead בהחלטה "איזה reviewer לדיספץ" + תחזוקה של 7 קבצי hard rules במקום 10.

- **Notes / Caveats:**
  - **כל ההחלטות הפיכות תוך 30 דקות** — `skill-creator` יוצר סוכן חדש מהר יותר ממה שלוקח לשנות לוגיקה ארכיטקטונית. עדיף לקצץ ולפצל לפי כאב מאשר ליצור preemptive.
  - בעיות אפשריות לזכור: code-quality-reviewer עלול להיות overloaded (איכות + security + perf) ב-PR מורכב. אם זה קורה — מפצלים את security לסוכן נפרד.
  - לא דנו ב-`technical-writer`/`docs-writer` — בכוונה. בשלב MVP, בילדרים כותבים את הדוקים שלהם. אם זה הופך לכאב, נוסיף.

- **Related:** [[founding-decisions]], `vault/Architecture Decisions/` (ADRs 002-006 written today), `C:\Users\ronen\.claude\plans\super-meshine-next-rounds.md` (Round 6 updated).
