# Research Department — PRD

## Mission

לספק נתונים מבוססי מקורות לפני החלטות עסקיות גדולות. למקד שיחות גילוי וגישות שוק. לא להחליף את הקול של הלקוח — לחסוך זמן עד שהוא נשמע.

## Manager + Workers

- **Manager:** `vertical-researcher` (player-manager — מחלקה של אחד)
- **Workers:** אין כרגע. מועמדים עתידיים (Phase 2):
  - `competitor-researcher` — מעמיק ניתוח מתחרים ספציפיים.
  - `customer-research-synthesizer` — מסכם תובנות משיחות גילוי.

## Scope of Work

| In Scope | Out of Scope |
|---|---|
| Vertical sizing (כמה חברות, גודל שוק) | בחירת וורטיקל (CEO/User) |
| כאב מ-ERP קיים (G2, Capterra, פורומים) | שיחות גילוי ישירות עם לקוחות (User) |
| Competitor analysis (Odoo, Katana, MRPeasy, NetSuite, וכו') | ניהול קשר עם לקוחות |
| Regulation mapping per vertical | פסיקה משפטית או הגדרת compliance |
| Israeli company directories | LinkedIn outreach (User) |
| Market trend documentation | Pricing strategy (CEO/User) |

## Inputs

- Brief מחקר מה-CEO עם questions ספציפיות + scope (גיאוגרפיה, גודל חברה, תקציב זמן).
- Discovery reports קודמים מ-`vault/Discovery/`.
- Domain knowledge מ-`vault/Domain Knowledge/` (לקטעים רגולטוריים).

## Outputs

- Research report ב-`vault/Discovery/<YYYY-MM-DD>-<slug>.md` בתבנית 8 סעיפים קבועה:
  1. TL;DR
  2. Verticals analyzed
  3. Pain evidence (quotes ≤15 words, sourced)
  4. Competitors per vertical
  5. Regulation checklist
  6. Findings supporting each vertical (balanced)
  7. **Companies to contact (≥15 per vertical, mandatory)**
  8. Discovery interview questions

## Decision Authority

ה-vertical-researcher מחליט באופן עצמאי על:
- מתודולוגיית מחקר (אילו queries להריץ, אילו מקורות לבדוק).
- אילו חברות נכנסות לרשימת הפנייה (לפי קריטריונים שנקבעו בbrief).
- האם מקור מספיק אמין (אם לא — מסומן `⚠️ unverified`).
- כמה queries / fetches לבזבז על נושא.

הפניה ל-CEO/User נדרשת ל:
- בחירת וורטיקל סופית.
- יצירת קשר עם חברות (לעולם לא מבוצעת ע"י הסוכן).
- אישור scope של המחקר אם הוא משתנה תוך כדי.
- החלטות על pricing / business model.

## Hard rules — מקורות

- **כל מספר/טענה דורש URL.** "200 חברות בישראל" בלי מקור = פסול. אם לא נמצא מקור — `⚠️ unverified`.
- **ציטוטים ≤15 מילים** (copyright safety), בתוך quotation marks, עם source URL.
- **מקורות מועדפים:** G2, Capterra, TrustRadius, Reddit, פורומים מקצועיים, איגודי תעשייה (איגוד היצרנים, IATI), משרדי ממשלה (משרד הכלכלה, משרד הבריאות).
- **מקורות פסולים כראשי:** בלוגים שיווקיים של ספקי ERP, AI-generated content בלי תיעוד.
- **אימות בשני מקורות עצמאיים** למידע משמעותי. אחרת — `⚠️ unverified`.
- **אסור פנייה ישירה לחברות** (אסור בכלל לסוכן: לא מיילים, לא טפסי "צור קשר", לא יצירת חשבונות).

## Workflow

### Phase 1 — Brief receipt
1. CEO מדספץ' את vertical-researcher עם brief ברור.
2. Researcher בודק אם brief מספיק ספציפי. אם לא — מחזיר NEEDS_CONTEXT עם 3-5 שאלות מחדדות.

### Phase 2 — Research
1. קריאה של vault context (Discovery קודמים, Domain Knowledge).
2. תכנון 5-10 queries מנומקים.
3. WebSearch → סינון תוצאות → WebFetch לתוכן ספציפי.
4. אימות מקורות, סימון `⚠️` מתאים.

### Phase 3 — Report
1. כתיבת report בתבנית 8 סעיפים ב-`vault/Discovery/`.
2. וודא ≥15 חברות לפנייה לכל וורטיקל ראוי.
3. מחזיר ל-CEO summary של ≤300 מילים.

## KPIs (איכותיים בלבד)

- כל דוח מסתיים ברשימת חברות (מינימום 15 לוורטיקל) — אחרת הדוח דחוי.
- כל מספר עם URL או `⚠️ unverified`.
- ציטוטים ≤15 מילים, עם URL.
- Zero strategic recommendations — רק עובדות + balanced findings.

## Dependencies on Other Departments

- **Architecture:** סיפק domain context שעוזר ל-architect בכתיבת ADRs רגולטוריים (FDA, GMP, ISO).
- **QA & Compliance:** erp-domain-expert משתמש ב-Discovery reports כקלט לבדיקות compliance של business logic.
- **Engineering:** לא תלות ישירה. מקבל context אם וורטיקל ספציפי דורש פיצ'רים מיוחדים.

## Current Status

- Round 3 הושלם: דוח של 5 וורטיקלים, 85 חברות, 14 ציטוטי כאב — ב-`vault/Discovery/2026-05-07-vertical-mapping-v1.md`.
- Round 4 ממתין: שיחות גילוי + ADR-001 (vertical choice).
- Topics פעילים ב-vault: `vault/Meeting Notes/vertical-selection.md`.

---

**Canonical agent definition:** `.claude/agents/vertical-researcher.md`
**Last updated:** 2026-05-07
