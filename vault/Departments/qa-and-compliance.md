# QA & Compliance Department — PRD

## Mission

לוודא שכל קוד שמתחבר ל-`main` עומד ב-3 רמות תקינות: (1) ספיק קומפליאנס, (2) איכות קוד + security, (3) (סלקטיבית) נכונות לוגיקה עסקית/רגולציה. שרשרת הביקורת רצה בעקביות ובסדר נכון. אין shortcut, אין "small change skip review".

## Manager + Workers

- **Manager:** `qa-manager`
- **Workers:**
  - `spec-reviewer` — שלב 1, **תמיד**. בודק שהקוד עונה ל-spec/ADR/task brief. read-only.
  - `code-quality-reviewer` — שלב 2, **תמיד אחרי שlb 1 ✅**. איכות + perf + **security checklist חובה** כשנגעו ב-auth/multi-tenant/agent-action/secrets/RBAC.
  - `erp-domain-expert` — שלב 3, **סלקטיבי**. רץ רק כשהשינוי נוגע ב-business logic (חשבונאות, FIFO/FEFO, MRP, BOM, period close, regulatory reporting). גם משמש כ-reference encyclopedia בנפרד מסבב QA.

## Scope of Work

| In Scope | Out of Scope |
|---|---|
| Spec compliance verification | Implementation (engineering) |
| Code quality (readability, types, errors, perf) | Architectural decisions (architect) |
| Security checklist (mandatory on sensitive code) | Vertical research (vertical-researcher) |
| Business-logic correctness (selective) | Pricing / business decisions |
| Regulatory check per vertical (selective) | Sales / customer support |
| Test quality (do tests verify behavior?) | Hiring |

## Inputs

- "Review needed" trigger מ-CEO (אחרי implementer marks DONE).
- git diff / commits מה-implementer.
- Spec / ADR / task brief המקורי.
- Implementer's self-review report.

## Outputs

- **qa-manager:** chain plan ב-`vault/QA/<YYYY-MM-DD-HHMM>-<slug>-chain.md` + adjudication report ב-`vault/QA/<YYYY-MM-DD-HHMM>-<slug>-adjudication.md`.
- **spec-reviewer:** report ב-`vault/Reviews/spec/<YYYY-MM-DD-HHMM>-<slug>.md`.
- **code-quality-reviewer:** report ב-`vault/Reviews/quality/<YYYY-MM-DD-HHMM>-<slug>.md`.
- **erp-domain-expert (QA mode):** report ב-`vault/Reviews/business-logic/<YYYY-MM-DD-HHMM>-<slug>.md`.

## Decision Authority

ה-qa-manager מחליט באופן עצמאי על:
- אילו reviewers בשרשרת (always spec + code-quality, selectively domain).
- האם 🟡 issue חוסם בסבב הזה (default: כן; אם לא — נדרש נימוק כתוב).
- האם conflict בין reviewers דורש שלב נוסף או escalation.
- אם reviewer החזיר ⚠️ — האם זה דורש fix או רק תיעוד.
- סדר ה-reviewers בשרשרת (default: spec → quality → domain).

הפניה ל-architect נדרשת ל:
- ⚠️ שמסתעף מ-ADR פגום או חסר.
- Conflict בין reviewers שמראה ש-ADR צריך עדכון.

הפניה ל-CEO/User נדרשת ל:
- Finding שמראה שה-spec עצמו פגום.
- קונפליקט שדורש החלטה עסקית.

## Hard rules — Severity classification

| ציון | משמעות | התנהגות ברירת מחדל |
|---|---|---|
| 🔴 Critical | חוסם merge. בעיית security, multi-tenant safety, regulatory violation, או correctness. | תמיד חוסם. |
| 🟡 Important | should fix. בעיית איכות משמעותית, missing tests, dead code. | חוסם אלא אם qa-manager מנמק אחרת בכתב. |
| 🟢 Nit | optional. preference, minor convention, naming. | לא חוסם. מתועד. |

## Workflow

### Phase 1 — Chain Planning (qa-manager)
1. CEO מדספץ' qa-manager עם git diff + spec + ADR refs.
2. Manager בודק את ה-diff: מה השתנה, איזה תחומים נוגעים בו.
3. Manager בוחר אילו reviewers ירוצו:
   - `spec-reviewer` — תמיד.
   - `code-quality-reviewer` — תמיד.
   - `erp-domain-expert` — רק אם נגענו ב: accounting, inventory math, MRP, BOM, period close, audit reports, regulatory reporting, או vertical-specific compliance code.
4. כותב chain plan ב-vault, מחזיר summary ל-CEO.

### Phase 2 — Chain Execution (CEO dispatches reviewers)
1. CEO מדספץ' spec-reviewer ראשון.
2. אם ✅ — מדספץ' code-quality-reviewer.
3. אם ✅ ו-erp-domain-expert בשרשרת — מדספץ' אותו.
4. אם reviewer ❌ — CEO מחזיר ל-implementer עם הערות. אחרי תיקון, חוזר לשלב הרלוונטי.
5. אם reviewer ⚠️ — CEO מעביר ל-qa-manager לפענוח (Phase 2 mid-chain decision).

### Phase 3 — Adjudication (qa-manager)
1. CEO מעביר ל-qa-manager את כל דוחות ה-reviewers.
2. Manager מאחד findings, מזהה קונפליקטים, מכריע.
3. Manager כותב adjudication report ב-vault.
4. מחזיר verdict ל-CEO: ✅ DONE | ❌ FIXES_NEEDED | ⚠️ Escalate.

## KPIs (איכותיים בלבד)

- 100% מ-PRs עוברים spec-reviewer + code-quality-reviewer.
- erp-domain-expert רץ על כל שינוי business-logic (לא מתפספס).
- Security checklist רץ אוטומטית על כל auth/multi-tenant/agent-action diff.
- אין 🔴 ב-merged code.
- 🟡 ב-merged code רק עם נימוק כתוב מ-qa-manager.

## Dependencies on Other Departments

- **Engineering:** מקבל את התוצרים שלהם לביקורת. לא מתחיל לפני ש-implementer marks DONE.
- **Architecture:** מסליו ל-architect כש-ADR פגום או חסר. סומך על ADRs כ-spec של ביקורת.
- **Research:** למחקר רגולטורי שמשפיע על business-logic check (compliance per vertical).

## Current Status

- 3 reviewers + 1 manager: כולם נוצרו ב-Round 6 + 6.5.
- אין עדיין קוד מוצר לביקורת. שרשרת ה-review תופעל בפעם הראשונה ב-Round 7 (bootstrap dev environment) או 8 (פיצ'ר ראשון).

---

**Canonical agent definitions:**
- `.claude/agents/qa-manager.md`
- `.claude/agents/spec-reviewer.md`
- `.claude/agents/code-quality-reviewer.md`
- `.claude/agents/erp-domain-expert.md`

**Last updated:** 2026-05-07
