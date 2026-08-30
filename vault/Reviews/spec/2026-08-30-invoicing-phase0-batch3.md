# Spec Review: Invoicing & Receipts — Phase 0 Batch 3 (B9-B13) + ADR-INV-002 Addendum A′ fixes

**תאריך:** 2026-08-30 16:10
**Task brief:** השלמת B9 (`create_business`+keygen+`POST /api/businesses`), B10 (storage buckets), B11 (isolation suite), B12 (numbering race), B13 (CI) — לפי `vault/Engineering/invoicing-phase-0-plan.md`; בנוסף תיקוני Addendum A′ ל-ADR-INV-002 (issue_date preservation, date-derived draft VAT, blanket search_path rule + CI check ח) שנדרשו לפני בניית ה-CI.
**Spec source:** `vault/Engineering/invoicing-phase-0-plan.md` (B9-B13), `invoicing-receipts/docs/adr/001-data-model-and-rls.md` (§D10, §D3.2/§D3.3, §D5, Implementation Notes #2/#9), `invoicing-receipts/docs/adr/002-immutability-and-numbering.md` (Amendment Log — Addendum A′, Implementation Notes #2/#5/#14), `invoicing-receipts/docs/adr/003-pdf-signing-storage.md` (§D4)
**Implementer:** backend-builder
**Commits:** `c3c23cf`, `9ba0668`
**Round:** #1

## תוצאה: ❌ Spec gaps

## Spec Checklist

| # | דרישה (מה-spec) | סטטוס | עדות |
|---|---|---|---|
| 1 | B9: `public.create_business()` מדויק ל-§D10 (INV_UNAUTHENTICATED/INV_NO_PROFILE/מגבלת 10/INV_BAD_TAX_ID/INV_TAX_ID_EXISTS/2 INSERTs אטומיים+audit_log, revoke/grant) | ✅ | `invoicing-receipts/supabase/migrations/0011_create_business.sql:19-77` |
| 2 | B9: `api/keygen.py`/`api/_keygen_core.py` — RSA-3072, X.509 self-issued (CN/serialNumber/O/C, BasicConstraints, KeyUsage, EKU `1.3.6.1.5.5.7.3.36`, notAfter=+10y), envelope encryption (DEK+KEK מ-`SIGNING_MASTER_KEK_V1`), אין חומר מפתח בלוג/תשובה | ✅ | `invoicing-receipts/api/_keygen_core.py:47-95,105-136,166-192`; `invoicing-receipts/api/keygen.py:96-113` |
| 3 | B9: `POST /api/businesses` קורא RPC ואז keygen בנפרד; כשל keygen לא מפיל את יצירת העסק (Implementation Notes #11) | ✅ | `invoicing-receipts/src/app/api/businesses/route.ts:45-82` |
| 4 | B9: `errors.ts` ממופה ל-5 קודי השגיאה החדשים | ✅ | `invoicing-receipts/src/lib/errors.ts:64-69` |
| 5 | B10: bucket `documents` (private, SELECT בלבד, scoped ל-`app.current_business_ids()`), bucket `business-assets` (SELECT+INSERT ל-owner), ללא `chromium` | ✅ | `invoicing-receipts/supabase/migrations/0012_storage_buckets.sql:18-45` |
| 6 | B10 AC: "בדיקת בידוד: SELECT חוצה-עסק על `documents` נכשל" (בדיקה אוטומטית) | ❌ | לא נמצא — ראה Missing items #1 |
| 7 | B11: 17 assertions (12 CRUD + 2 businesses-direct + 3 Amendment-A) + FORCE canary נוסף | ✅ | `invoicing-receipts/tests/isolation.test.ts:45-325` |
| 8 | B12: 20 קריאות מקבילות אמיתיות (תהליכי OS נפרדים) ל-`issue_document()`, ללא חורים/כפילויות, המשכיות בהרצה נוספת | ✅ | `invoicing-receipts/tests/numbering-race.test.ts:59-111`; `invoicing-receipts/tests/db/harness.ts:59-73` (כל `runSql` = `execFile psql` נפרד) |
| 9 | B13: `ci.yml` מריץ lint/typecheck/roundtrip+meta-checks/test/build | ✅ | `invoicing-receipts/.github/workflows/ci.yml:79-92` |
| 10 | B13: כל 8 בדיקות המטא (א-ח) לפי ADR-INV-001 §Implementation Notes #2 + ADR-INV-002 §Implementation Notes #14 | ✅ | `invoicing-receipts/scripts/ci-schema-checks.sql:26-172` |
| 11 | B13: roundtrip מלא up→down→up על כל המיגרציות + schema checks בסוף | ✅ | `invoicing-receipts/scripts/migrate-down-up-roundtrip.sh:52-88` |
| 12 | Addendum A′-2: `issue_date` נשמר (`coalesce(p_issue_date, v_doc.issue_date, current_date)`) + `INV_FUTURE_ISSUE_DATE` | ✅ | `invoicing-receipts/supabase/migrations/0010_addendum_fixes.sql` (declare block + step 3a) |
| 13 | Addendum A′-1/A′-3: שכבה 1 (`document_lines_compute`) נגזרת מ-`coalesce(app.issuing_as_of, documents.issue_date, current_date)` | ✅ | `invoicing-receipts/supabase/migrations/0010_addendum_fixes.sql` (`app.document_lines_compute()`) |
| 14 | Addendum A′-4: שורש `search_path` תוקן (לא רק `recompute_draft_lines` כ-workaround) + CI check (ח) חדש | ✅ | `invoicing-receipts/supabase/migrations/0010_addendum_fixes.sql` (כל הפונקציות המתוקנות); `scripts/ci-schema-checks.sql:155-172` |
| 15 | בדיקות `issue_date`/VAT (Implementation Notes #5: 4 תרחישים) | ✅ | `invoicing-receipts/tests/addendum-a-prime.test.ts:35-88` |
| 16 | Down migrations תקינים ל-0010-0014 (invariant #4) | ✅ | `invoicing-receipts/supabase/migrations_down/00{10,11,12,13,14}_*_down.sql` |
| 17 | אין עקיפות נסתרות מעבר לארבעת הממצאים שהוסלמו (compute_line→public, business_has_signing_key #10, 0014 hardening, whitelist 9→10) | ✅ | כל הממצאים מתועדים בקוד ובקומיטים, אין ממצא חמישי נסתר |

## Missing items

1. **בדיקת בידוד אוטומטית ל-storage buckets (B10 AC, `vault/Engineering/invoicing-phase-0-plan.md` Subtask B10)** — ה-plan קובע במפורש: "policies מדויקות: 1 SELECT ל-`documents`, SELECT+INSERT ל-`business-assets`, אין UPDATE/DELETE על אף אחד" **וגם** "בדיקת בידוד: SELECT חוצה-עסק על `documents` נכשל". המיגרציה `invoicing-receipts/supabase/migrations/0012_storage_buckets.sql` מממשת את ה-policies עצמן, אך לא נמצא שום קובץ בדיקה שמפעיל אותן: `grep` על `storage.objects`/`documents_bucket_read`/`business_assets_read`/`business_assets_insert` בכל `invoicing-receipts/tests/**/*.test.ts` מחזיר אפס תוצאות, ו-`invoicing-receipts/tests/db/storage-stub.sql` (שמדמה את `storage.objects`/`storage.buckets`) קיים אך לא נצרך משום קובץ `*.test.ts`. גם `scripts/ci-schema-checks.sql` (B13) לא בודק storage policies — 8 הבדיקות שם עוסקות רק בטבלאות/פונקציות ב-`public`/`app`. כלומר policy ה-storage שנכתבה מעולם לא הופעלה אוטומטית מול תרחיש cross-tenant — בניגוד ל-AC המפורש של B10.

## הערכה כללית

הרוב המכריע של Batch 3 מדויק ל-spec: `create_business()` הוא העתק כמעט-מילולי של ADR-INV-001 §D10 עם hardening עקבי; `api/keygen.py`/`_keygen_core.py` מיישמים את ADR-INV-003 §D4 לפרטים (גודל מפתח, שדות X.509, envelope encryption, KEK מ-env, ללא חשיפת חומר מפתח) ומכוסים בבדיקות TDD מקיפות; `POST /api/businesses` מיישם נכון את הרצף הדו-שלבי עם טיפול כשל ב-keygen; חבילת ה-CI מממשת את כל שמונת בדיקות המטא (כולל (ח) החדשה מ-Addendum A′) ואת ה-roundtrip המלא; בדיקות הבידוד (17+2) ובדיקת המרוץ עומדות ב-DoD כולל ריצה על תהליכי OS נפרדים באמת; תיקוני Addendum A′ (issue_date preservation, VAT date-derivation, search_path root-cause) מלאים ומכוסים ב-4 בדיקות רגרסיה ייעודיות. ארבעת הממצאים שכבר הוסלמו לארכיטקט (compute_line→public, business_has_signing_key כפונקציית definer מספר 10, 0014 hardening, עדכון whitelist ל-10) מתועדים כראוי בקוד ובקומיטים ואינם מהווים עקיפה נסתרת נוספת. הפער היחיד שנמצא הוא **קונקרטי וספציפי**: B10 (storage buckets) כולל AC מפורש לבדיקת בידוד אוטומטית שלא מומשה — ה-policies עצמן קיימות ונראות תקינות בבדיקה ידנית של הקוד, אך אין להן שום כיסוי טסטים, בניגוד מפורש לדרישת ה-plan.

---
