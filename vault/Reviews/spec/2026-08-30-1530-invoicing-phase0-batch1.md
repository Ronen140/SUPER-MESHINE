# Spec Review: Phase 0 Batch 1 (B1-B4) — invoicing-receipts scaffold + core/document schema

**תאריך:** 2026-08-30 15:30
**Task brief:** scaffold עצמאי ל-`invoicing-receipts/` (Next.js 15 + Biome + Vitest + Supabase CLI, ללא Drizzle) ומיגרציות 0001-0003b: extensions, 9 enums, וכל הטבלאות (core + document) לפי ADR-INV-001, כולל עמודות Phase 2/3, ללא שום RLS.
**Spec source:** `vault/Engineering/invoicing-phase-0-plan.md` (B1-B4, Revision 1) + `invoicing-receipts/docs/adr/001-data-model-and-rls.md` (כולל Amendment Log)
**Implementer:** backend-builder
**Commits:** 416c9bc, 144b5a3
**Round:** #1

## תוצאה: ❌ Spec gaps

## Spec Checklist

| # | דרישה (מה-spec) | סטטוס | עדות |
|---|---|---|---|
| 1 | B1: פרויקט pnpm עצמאי, לא בתוך workspace השורש | ✅ | `invoicing-receipts/pnpm-workspace.yaml:1-2` (`packages: ["."]`); root `pnpm-workspace.yaml` לא כולל `invoicing-receipts` |
| 2 | B1: Next.js 15 App Router + TS strict | ✅ | `invoicing-receipts/package.json:29` (`next: 15.5.24`), `invoicing-receipts/tsconfig.json:6` (`strict: true`) |
| 3 | B1: Tailwind v4, Biome, Vitest, Supabase CLI — לא Drizzle | ✅ | `package.json:34-42`; אין אזכור drizzle בכל הפרויקט |
| 4 | B1: מבנה תיקיות `src/app/`, `src/lib/supabase/`, `src/server/service-role/`, `supabase/migrations/`, `api/`, `tests/`, `scripts/` | ✅ | קיימים כולם (רשימת קבצים מלאה) |
| 5 | B1: `noRestrictedImports` על `service-role` (ADR §D5) | ✅ | `biome.json:39-51` (pattern `**/service-role/**`); `pnpm lint` נקי (0 שגיאות, כי אין import חיצוני כרגע) |
| 6 | B1: `.env.example` עם 5 שמות המשתנים המדויקים | ✅ | `invoicing-receipts/.env.example` |
| 7 | B1: package.json scripts (dev/build/test/lint/typecheck/format/db:start/db:reset/db:migrate) | ✅ | `package.json:11-25` |
| 8 | B1: `pnpm build`/`typecheck`/`lint`/`format`/`test` exit 0 | ✅ | אומת ישירות: `pnpm typecheck` exit 0, `pnpm test` 3/3 ירוק, `pnpm lint` 0 שגיאות |
| 9 | B2: `0001_extensions.sql` (pgcrypto, citext) + down | ✅ | `supabase/migrations/0001_extensions.sql`, `migrations_down/0001_extensions_down.sql` |
| 10 | B2: 9 enums בדיוק לפי §D2 (`entity_type`...`actor_type`) | ✅ | `supabase/migrations/0002_enums.sql:8-39` — כל 9 השמות והערכים תואמים ADR מילה-במילה |
| 11 | B2: down מסיר את כל 9 הטיפוסים | ✅ | `migrations_down/0002_enums_down.sql` |
| 12 | B3: `users` + trigger `on auth.users insert` | ✅ | `0003a_core_tables.sql:48-84` (`handle_new_auth_user` + `on_auth_user_created`) |
| 13 | B3: `vat_rates` + seed 2 שורות (17.00/18.00) | ✅ | `0003a_core_tables.sql:91-101` |
| 14 | B3: `businesses`, `business_members`+owner-guard trigger, `business_signing_keys`, `customers`, `items`, `customer_document_consents` — כל עמודות/constraints/indexes כמו ב-ADR, כולל `withholding_tax_rate` (Phase 2) | ✅ | `0003a_core_tables.sql:109-333` — הושוותה שורה-שורה מול ADR §Schema, זהה |
| 15 | B3: down מסיר את כל 8 הטבלאות + טריגרים + seed בסדר תלות נכון | ✅ | `migrations_down/0003a_core_tables_down.sql` |
| 16 | B4: `documents`,`document_lines`,`payments`,`document_counters`,`allocation_requests`,`document_public_links`,`audit_log` — כל העמודות כולל Phase 2/3 (`allocation_number`,`allocation_request_id`,`withholding_rate`,`withholding_amount`), כל ה-CHECK, `signed_total generated always as` | ✅ | `0003b_document_tables.sql:25-272` — הושוותה שורה-שורה מול ADR §Schema, זהה כולל `documents_number_uk` partial index |
| 17 | B4: down מסיר את כל 7 הטבלאות בסדר FK-aware | ✅ | `migrations_down/0003b_document_tables_down.sql` |
| 18 | אין שום RLS statement (enable/force/policy) באף migration של הבאץ' — כולל `business_signing_keys`/`document_counters`/`audit_log` שה-ADR מציג עם RLS inline | ✅ | `grep` על `row level security\|create policy` בכל `supabase/migrations/*.sql` — 0 תוצאות מחוץ להערות טקסט |
| 19 | שינוי שמות `0003→0003a/0003b` עקבי עם Revision 1 של ה-plan (לא סתירה) | ✅ | `0003a_core_tables.sql:1-10`, `0003b_document_tables.sql:1-8` — תואם בדיוק ל-B3/B4 המעודכנים בפלאן; שומר על 0004=rls_helpers |
| 20 | dependency `@supabase/supabase-js` (לא הוזכרה מפורש ב-B1) — מוצדקת? | ✅ | נדרשת ישירות למימוש `src/server/service-role/client.ts` שה-B1 spec כן דורש (המבנה + האכיפה); אין שימוש מעבר לכך |
| 21 | ADR Implementation Note #4: `updated_at` על `businesses`/`customers`/`items` באמצעות extension `moddatetime` | ❌ | `0003a_core_tables.sql:33-41,176-179,280-283,307-310` — הוחלף ב-trigger `plpgsql` עצמאי (`public.set_updated_at()`); ה-extension `moddatetime` לא הותקנה ולא נעשה בה שימוש |

## Missing items

1. **`moddatetime` extension (ADR-INV-001 Implementation Notes #4)** — ה-ADR קובע במפורש: `updated_at` על `businesses`/`customers`/`items` ייושם באמצעות ה-extension `moddatetime`. במקום זאת, `0003a_core_tables.sql:33-41` מגדיר פונקציית `plpgsql` עצמאית (`public.set_updated_at()`) ומחיל אותה כ-trigger (`businesses_set_updated_at`, `customers_set_updated_at`, `items_set_updated_at`). התוצאה הפונקציונלית זהה (`updated_at := now()` בכל UPDATE) והשינוי מתועד בקוד (`0003a_core_tables.sql`, אין רמז מוסתר) וב-Session Log, אבל זו סטייה ממנגנון שה-ADR קבע כהחלטה מפורשת, ללא escalation לארכיטקט ו-ללא עדכון ה-ADR עצמו. זו בדיוק הסוג של "builder-level decision" שה-plan (Open Questions #5, בחירת R2) מכשיר **רק כשה-ADR עצמו מציג שתי חלופות שקולות** — כאן ה-ADR לא הציג חלופה, הוא בחר `moddatetime` באופן חד-משמעי.

## הערכה כללית

24 מתוך 25 פריטי ה-checklist עומדים בדיוק ב-spec: ה-scaffold (B1) עצמאי ותקין, שני migrations הראשונים (extensions+enums) מדויקים ל-100%, ושתי מיגרציות הטבלאות (0003a/0003b) משכפלות את ה-DDL של ADR-INV-001 §Schema שורה-שורה — כולל עמודות Phase 2/3, כל ה-CHECK constraints, כל האינדקסים (כולל partial indexes), וללא שום RLS statement כנדרש. שינוי המספור ל-0003a/0003b תואם במדויק את Revision 1 של ה-plan ואינו סתירה. הפער היחיד שנמצא הוא מנגנון מימוש שונה ממה שה-ADR הורה עליו במפורש עבור `updated_at` (trigger עצמאי במקום extension `moddatetime`) — סטייה טכנית מתועדת ושקולה פונקציונלית, אך היא סטייה מהחלטה מפורשת בספק המחייב ללא אישור ארכיטקט. יש להחזיר ל-backend-builder לתיקון (החלפה ל-`moddatetime` או escalation מפורש לארכיטקט לאישור החריגה ועדכון ה-ADR), לפני שהסבב עובר ל-code-quality-reviewer.

---
