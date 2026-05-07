# Engineering Department — PRD

## Mission

לבנות את ה-features של SUPER-MESHINE — server + UI — בקצב גבוה ובעקיבה ל-ADRs, multi-tenancy, ו-architecture invariants. לכל פיצ'ר יש לפחות builder אחד שהוא הבעלים, ולכל builder יש מנהל שמתאם.

## Manager + Workers

- **Manager:** `engineering-manager`
- **Workers:**
  - `backend-builder` — Drizzle schemas + migrations, tRPC routers, packages/core domain logic, MCP endpoints, Vitest tests.
  - `frontend-builder` — Next.js App Router pages, shadcn/ui components, react-hook-form + zod forms, TanStack Table grids, Vercel AI SDK Copilot UI, browser-verified.

## Scope of Work

| In Scope | Out of Scope |
|---|---|
| Server-side code (Drizzle, tRPC, packages/core, MCP) | Architectural decisions (architect) |
| UI code (Next.js, shadcn, forms, tables, Copilot UI) | Code review (qa-manager) |
| Tests (Vitest unit, Playwright e2e, browser verification) | Business-logic correctness check (erp-domain-expert) |
| Migrations (up + down obligatorio) | Vertical research (vertical-researcher) |
| MCP servers integration (`mcp/`) | Pricing / business decisions |
| Performance tuning at the implementation level | Domain-knowledge questions (escalate to erp-domain-expert) |

## Inputs

- Feature brief מה-CEO (במקור מהמייסד או מ-vertical decision).
- ADRs רלוונטיים (manager קורא ומקצה לעובדים).
- Spec / acceptance criteria — או מה-CEO או manager מנסח.

## Outputs

- **Manager:** work plans ב-`vault/Engineering/<YYYY-MM-DD-HHMM>-<slug>-plan.md` + acceptance reports ב-`vault/Engineering/<YYYY-MM-DD-HHMM>-<slug>-acceptance.md`.
- **Workers:** קוד ב-`apps/web/`, `packages/{db,api,ui,agents,core,config}`, `mcp/server/` + tests + commits.

## Decision Authority

ה-engineering-manager מחליט באופן עצמאי על:
- חלוקת עבודה בין backend-builder ל-frontend-builder.
- מבנה תיקיות בתוך ה-monorepo (תוך ADR-004).
- Inline scope adjustments (פיצול subtask לשניים, מיזוג דומים).
- Order of work (sequential vs parallel between workers).
- האם 🟢 nit מ-code-quality-reviewer חוסם acceptance (default: לא חוסם).
- בחירת test patterns (unit vs integration vs e2e).

הפניה ל-architect נדרשת ל:
- Schema changes שחוצים מודולים (חוץ מ-backend-builder לבד).
- Dependency חדש (לא רק patch update).
- Auth/RBAC change.
- Multi-tenancy strategy modifications.
- Security model adjustments.

הפניה ל-CEO/User נדרשת ל:
- Scope change של הפיצ'ר.
- Business decision שלא הוגדר בספק.
- Contradiction בין ADRs.
- פיצ'ר חדש שלא תוכנן.

## Workflow

### Phase 1 — Planning (engineering-manager)
1. CEO מדספץ' את engineering-manager עם feature brief + ADR refs.
2. Manager קורא ADRs + ה-codebase, מחפש patterns קיימים לשימוש חוזר.
3. Manager מפרק לתתי-משימות: לכל אחת — assignee (backend/frontend), spec של 1-3 משפטים, files predicted, acceptance criteria, dependencies.
4. כותב work plan ב-vault, מחזיר ל-CEO summary.

### Phase 2 — Execution (CEO dispatches workers)
1. CEO מדספץ' workers לפי התוכנית.
2. Worker עובד לפי TDD: failing test → implement → refactor → self-review.
3. Worker מחזיר DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED.
4. אם NEEDS_CONTEXT — CEO מעביר את השאלה ל-engineering-manager שעונה.

### Phase 3 — Review (qa-manager owns)
1. CEO מדספץ' qa-manager שמתכנן שרשרת ביקורת.
2. CEO מריץ: spec-reviewer → code-quality-reviewer → optionally erp-domain-expert.
3. אם review ❌ — CEO מחזיר ל-builder עם הערות.
4. לולאה עד ✅.

### Phase 4 — Acceptance (engineering-manager)
1. CEO מעביר ל-engineering-manager את כל התוצרים + adjudication מ-qa-manager.
2. Manager בודק: האם הפיצ'ר שלם? האם הקטעים מתחברים? Integration test.
3. Manager מאשר ✅ DONE או ❌ Send back או ⚠️ Need CEO decision.

## KPIs (איכותיים בלבד)

- כל פיצ'ר עובר את שרשרת spec → quality → (optionally) domain לפני acceptance.
- Multi-tenancy + audit-log invariants שמורים בכל mutation (קוד + DB triggers).
- Browser verification מבוצע לפני DONE על כל UI feature.
- Migrations forward+back נבדקות לפני acceptance.

## Dependencies on Other Departments

- **Architecture:** מקבל ADRs לפני יישום. לא יוזם החלטות חוצות-מודולים.
- **QA & Compliance:** כל פיצ'ר עובר את שרשרת ה-review של qa-manager.
- **Research:** מקבל domain context (וורטיקל-spec) לפני יישום compliance features.

## Current Status

- 2 builders + 1 manager: כולם נוצרו ב-Round 6 + 6.5.
- אין עדיין קוד מוצר. Round 7 (bootstrap dev environment) הוא הסבב הראשון שיריץ את הצוות הזה בעבודה אמיתית.

---

**Canonical agent definitions:**
- `.claude/agents/engineering-manager.md`
- `.claude/agents/backend-builder.md`
- `.claude/agents/frontend-builder.md`

**Last updated:** 2026-05-07
