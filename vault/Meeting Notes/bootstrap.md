# Project Bootstrap

## Overview

הקמת תשתית הפיתוח של SUPER-MESHINE — ERP דור חדש מבוסס AI. הוקם git repo, הועתקו skills מ-`the-five-aegents`, ונבנה vault התחלתי. עוד אין קוד מוצר; הצעד הבא הוא כתיבת CLAUDE.md ויצירת סוכן ראשון (architect). הוורטיקל עדיין פתוח — תלוי ב-8 שיחות גילוי שטרם בוצעו.

## Open Questions

- בחירת וורטיקל סופית (ההמלצה: contract manufacturing במזון/קוסמטיקה — תלוי במחקר vertical-researcher + שיחות גילוי).
- TS או Python בבקאנד?
- Cloud-only ב-MVP או on-prem option מההתחלה?

## Session Log

### 2026-05-07 — Initial bootstrap [active]
- **What was done:**
  - Init של git repo, חיבור ל-`https://github.com/Ronen140/SUPER-MESHINE`.
  - יצירת `.gitignore`, `README.md`.
  - העתקת 18 skills מ-`the-five-aegents/.claude/skills/` (subagent-driven-development, dispatching-parallel-agents, skill-creator, writing-skills, verification-before-completion, test-driven-development, systematic-debugging, using-git-worktrees, writing-plans, executing-plans, finishing-a-development-branch, obsidian-vault-workflow, obsidian-markdown, obsidian-bases, using-superpowers, brainstorming, requesting-code-review, receiving-code-review).
  - בניית `vault/` עם תיקיות Meeting Notes, Architecture Decisions, Domain Knowledge, Discovery + `_index.md`.
- **Decisions:**
  - Skills שלא הועתקו: `gpt-image-gen` (לא רלוונטי ל-ERP).
  - `.claude/` ו-`vault/` נשמרים ב-git בכוונה — חלק מה-IP של הפרויקט. רק `settings.local.json` ו-`worktrees/` ב-gitignore.
  - מבנה ה-CEO + flat sub-agents (כמו ב-the-five-aegents) הוא הדפוס המנחה — בגלל האילוץ שסאב-אייג'נטים לא מפעילים סאב-אייג'נטים.
- **Notes / Caveats:**
  - תוכנית מלאה ב-`C:\Users\ronen\.claude\plans\lively-juggling-starlight.md`.
  - הצעדים הבאים: CLAUDE.md → architect agent → discovery interviews במקביל.
- **Related:** [[architect-agent]] (יווצר בקרוב)

### 2026-05-07 — Add vertical-researcher agent [active]
- **What was done:**
  - יצירת `.claude/agents/vertical-researcher.md` — סוכן מחקר וורטיקלים בדפוס chen מ-the-five-aegents.
  - Tools: Read/Write/Glob/Grep/WebSearch/WebFetch. Model: sonnet.
  - 7 שלבי workflow, פלט ל-`vault/Discovery/<YYYY-MM-DD>-<slug>.md` בתבנית קבועה.
- **Decisions:**
  - הסוכן לא מחליף שיחות גילוי — הוא מצמצם אותן ומעמיק אותן. כל דוח חייב להסתיים ב≥15 חברות לפנייה (חוק ברזל #1).
  - Hard rule מפורש: הסוכן לא בוחר וורטיקל ולא כותב המלצה אסטרטגית. רק עובדות + טבלה מאוזנת. ההחלטה ב-CEO.
  - Anti-pattern מתועד: רשימה גנרית מ-b144 = רעש; 15 חברות מסוננות לפי קריטריון = ערך.
- **Notes / Caveats:**
  - הצעד הבא: להפעיל את הסוכן עם brief ראשון — מיפוי 3-5 וורטיקלים מועמדים בישראל (מזון, קוסמטיקה, אלקטרוניקה, מתכת, contract manufacturing כללי).
- **Related:** [[vertical-researcher]]
