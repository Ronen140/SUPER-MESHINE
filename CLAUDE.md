# CLAUDE.md

הנחיות ל-Claude Code בעבודה על SUPER-MESHINE.

## Project Overview

**SUPER-MESHINE** היא מערכת ERP דור חדש, AI-native — אלטרנטיבה ל-Priority/SAP/Oracle עם שלוש שכבות AI מובנות:

1. **Process Agents אוטונומיים** — מבצעים תהליכי ליבה (רכש, תכנון ייצור, גבייה).
2. **Customization Agent** — שינוי schema/UI מתיאור בשפה טבעית, במקום implementer ידני.
3. **Copilot מובנה** — בכל מסך, RBAC-aware.

הפיתוח מבוסס על דפוס CEO orchestrator (אתה + Claude הראשי) + צוות סוכני פיתוח מתמחים, שכל אחד מוגדר ב-`.claude/agents/`.

## Vault Workflow — MANDATORY

**בתחילת כל session ובכל משימה חדשה, הפעל את ה-skill `obsidian-vault-workflow` (ב-`.claude/skills/obsidian-vault-workflow/SKILL.md`) לפני שאתה עושה משהו אחר.**

זה לא ניתן למשא ומתן. ה-skill מגדיר את הפרוטוקול לזיכרון ארוך טווח של הפרויקט:

1. **לפני עבודה** — נסח את הנושא במשפט אחד, אתר `vault/Meeting Notes/<topic>.md` (או השתמש ב-`_index.md` למצוא אותו), וקרא את ה-Overview + Open Questions + כל ה-Session Log הקודם. בנוסף סרוק רשומות אחרונות ב-Meeting Notes / Architecture Decisions / Domain Knowledge / Discovery.
2. **אחרי עבודה** — הוסף `### YYYY-MM-DD — <title> [status]` בתחתית ה-Session Log של הנושא, עדכן Open Questions (הוסף חדשים, הסר שנפתרו), ורענן את ה-Overview רק אם scope/status/הבנה השתנו. וודא ע"י קריאה חוזרת של הקובץ.

ה-vault נמצא ב-`vault/`. אינדקס הכניסה הוא `vault/Meeting Notes/_index.md`. קרא את [[obsidian-vault-workflow]] עצמו לפרוטוקול המלא, פורמט הקבצים, status tags, ו-anti-patterns.

**דלג על ה-workflow רק לשאלות read-only טהורות שלא נוגעות בקבצים ולא מייצרות החלטות.** כל דבר אחר — קוד, ארכיטקטורה, design, bugfixes, reviews — עובר Phase 1 → work → Phase 2.

## Project-Specific Claude Configuration

ספריית `.claude/` מרחיבה את Claude Code לפרויקט הזה:

- `.claude/agents/` — הגדרות סוכני פיתוח (markdown, אחד לתפקיד)
- `.claude/skills/` — skills משותפים מ-`the-five-aegents` (subagent-driven-development, dispatching-parallel-agents, skill-creator, ועוד)
- `.claude/commands/` — slash-commands ייעודיים לפרויקט

## Architecture Invariants

ארבעה כללים חוצי-מערכת שאסור להפר. כל סוכן פיתוח יודע אותם, וכל code review בודק אותם:

1. **Multi-tenancy בכל שורה.** כל טבלה ש-belongs-to-tenant חייבת `tenant_id` עם RLS / scoped query. אין שאילתה גלובלית בלי הסבר מפורש למה היא בטוחה.
2. **Audit log על כל mutation.** כל insert/update/delete על אובייקט עסקי כותב רשומה ל-`audit_log` עם actor (user או agent), action, timestamp, ו-diff. לא חורגים מזה גם ב-migrations.
3. **Agent action = transaction עם human-approval gate מעל threshold.** כל פעולה של Process Agent (רכש, שינוי הזמנה, מחיקה) רצה בתוך transaction, וכל פעולה מעל threshold שמוגדר ב-policy עוצרת ל-approval לפני commit.
4. **Schema migrations עם rollback obligatorio.** כל migration חייבת up + down, וכל שינוי schema ש-Customization Agent מבצע נבדק ב-staging לפני production.

## Subagent Dispatch — האילוץ הקריטי

סאב-אייג'נטים ב-Claude Code **לא מפעילים סאב-אייג'נטים אחרים**. כל ה-orchestration עובר דרך ה-CEO (Claude הראשי). תכנן הגדרות סוכנים לפי זה:

- כל סוכן הוא flat — מקבל context, מבצע משימה אחת, מחזיר דוח.
- לולאות review (implementer → spec-reviewer → code-quality-reviewer) מנוהלות ע"י ה-CEO באמצעות `subagent-driven-development`.
- אסור לסוכן לקרוא ל-Task tool מתוך עצמו.

## Definition of Done — סבב עבודה

סבב לא נסגר עד שהוא נדחף ל-remote (`https://github.com/Ronen140/SUPER-MESHINE`). שבעת השלבים:

1. **תכנון** — plan file (אם non-trivial).
2. **ביצוע** — `subagent-driven-development`: implementer → spec-reviewer → code-quality-reviewer.
3. **אימות פונקציונלי** — `verification-before-completion`: מריצים, פותחים בדפדפן, בודקים golden path + edge cases.
4. **בדיקת בריאות** — tests ירוקים, type-check, build.
5. **עדכון vault** — entry ב-Session Log של הנושא הרלוונטי.
6. **Commit מובנה** — conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
7. **Push** — `git push origin <branch>`.

**Hard rule:** אסור push בלי שלבים 3-4 ירוקים. ה-skill `finishing-a-development-branch` מטפל ב-5-7 כיחידה.

## Stack (תכנון; ייקבע סופית עם architect)

- **DB:** Postgres + pgvector. Multi-tenant via RLS.
- **Backend:** TypeScript + tRPC + Drizzle (ברירת מחדל; חלופה: Python + FastAPI).
- **Frontend:** Next.js + shadcn/ui + TanStack Table.
- **AI:** Claude Agent SDK ל-product agents, Anthropic API עם prompt caching, MCP servers פנימיים.
- **Workflows:** Temporal לתהליכים אוטונומיים ארוכים.
- **Infra (MVP):** Vercel + Supabase. Sentry + PostHog מהיום הראשון.

## תוכנית הפרויקט המלאה

`C:\Users\ronen\.claude\plans\lively-juggling-starlight.md` — מתעדכנת עם פרטים נוספים תוך כדי.
