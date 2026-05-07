# Departments — Index

מבנה ארגוני של SUPER-MESHINE. ה-CEO (Claude הראשי) מתאם בין 4 מחלקות; כל מחלקה עם מנהל ו-(אופציונלית) workers.

ראה גם: `CLAUDE.md` סקציית "Org Structure", ו-`.claude/skills/manager-delegation-pattern/SKILL.md` לפרוטוקול המלא.

## Departments

| Department | Manager | Workers | PRD | Status |
|---|---|---|---|---|
| Architecture | architect | (player-manager) | [[architecture]] | Active |
| Research | vertical-researcher | (player-manager) | [[research]] | Active |
| Engineering | engineering-manager | backend-builder, frontend-builder | [[engineering]] | Active (no product code yet) |
| QA & Compliance | qa-manager | spec-reviewer, code-quality-reviewer, erp-domain-expert | [[qa-and-compliance]] | Active (review chain idle) |

## How to read these PRDs

לכל מחלקה — Mission, Manager+Workers, Scope (in/out), Inputs, Outputs, Decision Authority, Workflow, KPIs, Dependencies, Current Status. כל PRD מתעדכן כשהמחלקה מתפתחת — workers נוספים, scope משתנה, החלטות חדשות מתקבלות.

## Cross-department coordination

- **Architecture → Engineering:** ADRs מנותבים ל-engineering-manager לפני יישום.
- **Engineering → QA:** כל DONE עובר אוטומטית לשרשרת qa-manager.
- **QA → Architecture:** ⚠️ findings שמסתעפים מ-ADR פגום מסולמים חזרה ל-architect.
- **Research → Architecture:** vertical/regulation context מעדכן ADRs רגולטוריים.

## Future departments (Phase 2+)

| Department (Future) | Reason | When |
|---|---|---|
| Product (Process Agents) | סוכני מוצר ש"חיים" אצל הלקוח (Procurement, Production Planner, AR, וכו') — נבנים בידי Engineering אבל מנוהלים בנפרד | אחרי MVP — חודש 4+ |
| DevOps | אם setup-deployment skill לא מספיק (ראה Reversal Conditions) | TBD |
| Customer Success / Support | אחרי 5+ לקוחות | Phase 2 |
