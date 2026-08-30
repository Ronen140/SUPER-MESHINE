# מערכת חשבוניות וקבלות לעסק

פרויקט חדש: מערכת להפקה וניהול של מסמכים חשבונאיים לעסק — חשבוניות מס, קבלות, חשבוניות מס-קבלה וחשבוניות עסקה.

> **סטטוס:** Phase 0 בבנייה. ה-scope וה-stack נקבעו (`docs/plan.md` + `docs/adr/`). scaffold + migrations 0001, 0002, 0003a, 0003b (extensions, enums, טבלאות ליבה, טבלאות מסמכים) קיימים. RLS, triggers, `issue_document()`, יצירת עסק, ו-UI עדיין לא — ראו `vault/Engineering/invoicing-phase-0-plan.md`.

## מטרה

לאפשר לעסק (עוסק מורשה / חברה) להפיק מסמכים חשבונאיים תקינים לפי הוראות ניהול ספרים בישראל, לנהל לקוחות ותשלומים, ולייצא נתונים לרואה החשבון.

## Scope מתוכנן (טיוטה)

- **מסמכים:** חשבונית מס, קבלה, חשבונית מס-קבלה, חשבונית עסקה, חשבונית זיכוי.
- **לקוחות:** כרטיס לקוח, פרטי ח.פ / ע.מ, תנאי תשלום.
- **מיסוי:** מע"מ (כולל שיעור 0 ופטור), ניכוי מס במקור.
- **מספור:** מספור רציף לפי סוג מסמך, ללא מחיקות (סטורנו בלבד).
- **דוחות וייצוא:** דוח הכנסות תקופתי, ייצוא לרו"ח (מבנה אחיד / קובץ במבנה שיסוכם).
- **הפצה:** PDF + שליחה במייל ללקוח.

## מבנה התיקייה

```
invoicing-receipts/                 ← פרויקט pnpm עצמאי, מחוץ ל-workspace של ה-ERP
├── README.md                       ← המסמך הזה
├── pnpm-workspace.yaml             ← מבודד את הפרויקט הזה מה-workspace של השורש (חובה!)
├── docs/
│   ├── requirements.md
│   ├── plan.md
│   └── adr/                        ← ADR-INV-001/002/003 (Accepted ל-Phase 0)
├── src/
│   ├── app/                        ← Next.js App Router
│   ├── lib/supabase/               ← Supabase client factories (F1, טרם קיים)
│   └── server/service-role/        ← service_role בלבד. אסור import מבחוץ (biome.json אוכף)
├── supabase/
│   ├── config.toml                 ← `supabase init`
│   ├── migrations/                 ← up migrations, `NNNN_slug.sql`
│   └── migrations_down/            ← down migration מקביל לכל up (חוק בית — כל migration הפיכה)
├── api/                            ← Python functions עתידיות (keygen, Phase 0; sign, Phase 1)
├── tests/                          ← Vitest integration tests (isolation, numbering race)
└── scripts/                        ← CI helper scripts
```

## איך מריצים

```bash
cd invoicing-receipts
pnpm install
cp .env.example .env.local        # למלא ערכי Supabase אמיתיים כשיהיה פרויקט

pnpm dev                          # http://localhost:3000
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm check:write                  # biome check --write (lint + format)
```

### מסד נתונים מקומי

**נתיב מועדף (סביבה עם Docker):**
```bash
pnpm db:start     # supabase start — מרים Postgres+Auth+Storage מקומי
pnpm db:reset      # מריץ את כל ה-migrations מאפס
pnpm db:migrate     # supabase migration up
```

**נתיב חלופי (אין Docker זמין):** הרם קלאסטר Postgres מקומי (`postgresql-16` +
`postgresql-client-16` על Ubuntu) והחל את קבצי `supabase/migrations/*.sql` בסדר ידנית עם
`psql`. שים לב: `auth.users`/`auth.uid()` הם ספציפיים ל-Supabase (לא קיימים ב-Postgres גולמי)
— לבדיקה מקומית בלבד יש להקים "stub" מינימלי (`schema auth`, טבלת `auth.users`, פונקציית
`auth.uid()`) *לפני* הרצת המיגרציות; זה **אינו** חלק מה-migrations המחויבות ל-commit. ראה את
ה-session log ב-`vault/Meeting Notes/invoicing-receipts-system.md` לפרטי הבחירה הזו וההשלכות
על CI (B12 עדיין צריך להחליט בין `supabase start` אמיתי ל-stub דומה ב-pipeline).

## איפה עומדים

- אפיון ותחקיר שוק הושלמו — בנצ'מרק פונקציות + תחקיר עיצוב ב-`vault/Discovery/` (2026-08-30).
- ADR-INV-001/002/003 — Accepted ל-Phase 0 build (`docs/adr/`).
- Engineering plan ל-Phase 0 — 13 subtasks ל-backend-builder + 4 ל-frontend-builder
  (`vault/Engineering/invoicing-phase-0-plan.md`).
- **B1-B4 בוצעו:** scaffold (Next.js 15 + Tailwind v4 + Biome + Vitest + Supabase CLI config),
  migrations 0001, 0002, 0003a, 0003b (extensions, enums, טבלאות ליבה כולל `users`+auth-sync trigger ו-
  business_members owner-guard trigger, טבלאות מסמכים כולל `signed_total`). **עדיין אין RLS
  policies, triggers של audit/immutability, `issue_document()`, יצירת עסק, ו-UI** — אלו B5-B13 +
  F1-F4, חלקם חסומים ב-escalation פתוח לארכיטקט (RLS ל-`businesses` + bootstrap ל-owner ראשון).
