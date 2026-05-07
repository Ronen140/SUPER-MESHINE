# SUPER-MESHINE

ERP דור חדש, AI-native. סוכני AI אוטונומיים, התאמה אישית בשפה טבעית, Copilot מובנה.

## סטטוס

Bootstrap — בונה תשתית פיתוח מבוססת-סוכנים. עוד אין מוצר.

## ארכיטקטורה (high-level)

צוות פיתוח של סוכני Claude (architect, backend-builder, frontend-builder, schema-architect, erp-domain-expert, spec-reviewer, code-quality-reviewer, erp-qa) שמתואמים ע"י CEO (המייסד + Claude הראשי), מבוססים על דפוס מוכח מ-`the-five-aegents`.

המוצר עצמו מכיל שלוש שכבות AI:
1. **Process Agents** — מבצעים תהליכי ליבה (רכש, ייצור, גבייה) אוטונומית.
2. **Customization Agent** — שינוי schema/UI מתיאור בשפה טבעית, במקום implementer ידני.
3. **Copilot** — עוזר בכל מסך, RBAC-aware.

## מבנה ספריות

```
.claude/
  agents/      ← הגדרות סוכני פיתוח
  skills/      ← skills משותפים (subagent-driven-development וכו')
  commands/    ← slash-commands
vault/         ← זיכרון ארוך טווח (Obsidian)
apps/          ← (בעתיד) frontend + backend
packages/      ← (בעתיד) shared libs, db, agents
mcp/           ← (בעתיד) MCP servers פנימיים
```

## תוכנית מלאה

`C:\Users\ronen\.claude\plans\lively-juggling-starlight.md`
