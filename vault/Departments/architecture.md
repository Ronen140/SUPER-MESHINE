# Architecture Department — PRD

## Mission

לוודא שכל החלטה חוצת-מודולים תיעדת לפני יישום. למנוע shortcuts ארכיטקטוניים שיעלו ביוקר אחר כך.

## Manager + Workers

- **Manager:** `architect` (player-manager — מחלקה של אחד)
- **Workers:** אין כרגע. מועמד עתידי לפיצול: `schema-architect` כשsh-emas מורכבים מצריכים זאת (ראה `vault/Meeting Notes/founding-decisions.md` — D3 Reversal Conditions).

## Scope of Work

| In Scope | Out of Scope |
|---|---|
| Multi-tenancy strategy | UI/UX design |
| Data modeling, sk-emas, indexes | Code review |
| API contracts, error model | Pricing decisions |
| AI agent integration patterns | Customer onboarding flow |
| Security boundaries (auth, RBAC, audit, secrets) | Vertical selection |
| Workflow engine choices | Marketing positioning |
| Build & deploy architecture | Hiring |

## Inputs

- שאלה ארכיטקטונית מה-CEO (משפט-שניים, עם constraint־ים).
- ADRs קודמים רלוונטיים (architect קורא אוטומטית).
- Domain knowledge מ-`vault/Domain Knowledge/` (התייעצות עם erp-domain-expert לפי הצורך — דרך ה-CEO).

## Outputs

- ADR בקובץ נפרד: `vault/Architecture Decisions/<NNN>-<slug>.md`.
- Status: Proposed / Accepted / Superseded / Deprecated.
- כל ADR כולל: Context, Options, Trade-offs table, Decision, Consequences, Reversal Conditions, Implementation Notes.
- אופציונלי: technical specs מפורטים ב-`vault/Specs/` כש-ADR לא מספיק.

## Decision Authority

ה-architect מחליט באופן עצמאי על:
- בחירת technology בתוך תחומי הפרויקט.
- מבנה schemas וטבלאות.
- API contracts וגבולות בין שירותים.
- security model ו-audit log structure.
- monorepo structure ו-package boundaries.

הפניה ל-CEO/User נדרשת ל:
- אישור ADR מ-Proposed ל-Accepted (תמיד).
- החלטות שמשפיעות על pricing, וורטיקל, או scope עסקי.
- Contradiction בין ADRs קודמים שלא ניתן ליישב.

## Workflow

1. ה-CEO מדספץ' את architect עם שאלה.
2. architect קורא vault, מחקר חיצוני אם נדרש (WebSearch/WebFetch).
3. מנסח 2-3 חלופות עם trade-offs.
4. כותב ADR עם status Proposed.
5. מחזיר ל-CEO summary + ספציפית מה דורש אישור.
6. ה-CEO מציג למייסד; אישור → status Accepted.

## KPIs (איכותיים בלבד)

- כל החלטה חוצת-מודולים מתועדת ב-ADR לפני יישום (לא בדיעבד).
- כל ADR ניתן ליישום ע"י builder בלי לחזור עם שאלות (Implementation Notes ספציפיים מספיק).
- Reversal Conditions מתועדים — לא "החלטה לכל החיים".

## Dependencies on Other Departments

- **QA & Compliance:** code-quality-reviewer בודק שיישום עומד ב-ADR.
- **Engineering:** builders יוצרים ADR refs ב-PRs שלהם.
- **Research:** vertical-researcher מספק domain context לפני ADRs ספציפיים-וורטיקל (FDA/ISO/GMP).

## Current Status

- 5 ADRs יסוד (002-006) ב-status Proposed (002, 004, 005, 006) ו-Accepted (003).
- ADR-001 שמור ל-vertical choice (ייכתב אחרי שיחות גילוי).
- Active topics: ייווצרו ADRs נוספים לפי הצורך כשנתחיל לבנות features.

---

**Canonical agent definition:** `.claude/agents/architect.md`
**Last updated:** 2026-05-07
