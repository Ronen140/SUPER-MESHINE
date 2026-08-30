# Spec Review: Invoicing Phase 0 — Batch 2 (B5-B8)

**תאריך:** 2026-08-30 (round submitted for review)
**Task brief:** מימוש B5-B8 מתוכנית Phase 0 של invoicing-receipts — `0004_rls_helpers.sql` (helper functions), `0005_rls_policies.sql` (RLS policies על 15 טבלאות), `0006_audit.sql` (audit trigger), `0007_immutability.sql` (immutability triggers), `0008_issue_function.sql` (`app.issue_document`/`app.seed_for`/`app.set_start_number`) + downs מקבילים, ו-`src/lib/errors.ts` (מילון `INV_*`→עברית) + טסטים.
**Spec source:** `vault/Engineering/invoicing-phase-0-plan.md` (Revision 3, subtasks B5-B8), `invoicing-receipts/docs/adr/001-data-model-and-rls.md` (כולל Amendment A), `invoicing-receipts/docs/adr/002-immutability-and-numbering.md`
**Implementer:** backend-builder
**Commits:** c3db187, 214e0b5, 8741ea8, 602a145, 1d39de9d8f370b033f4b3cf75cbe966cdccdf10b (`feat(invoicing-receipts): complete Phase 0 batch 2 — RLS, audit, immutability, issue_document (B5-B8)`)
**Round:** #1

## תוצאה: ✅ Spec compliant

## Spec Checklist

| # | דרישה (מה-spec) | סטטוס | עדות |
|---|---|---|---|
| 1 | B5: `schema app` נוצר, `revoke all ... from anon, authenticated` (ADR-INV-001 §D3) | ✅ | `invoicing-receipts/supabase/migrations/0004_rls_helpers.sql:17-18` |
| 2 | B5: `app.current_business_ids()` — `SECURITY DEFINER`, `STABLE`, `set search_path` (§D3, whitelist #1) | ✅ | `0004_rls_helpers.sql:20-23` |
| 3 | B5: `app.has_role(uuid, member_role[])` — אותה תבנית (whitelist #2) | ✅ | `0004_rls_helpers.sql:25-29` |
| 4 | B5: down מפרק את שתי הפונקציות + ה-schema | ✅ | `migrations_down/0004_rls_helpers_down.sql:7-9` |
| 5 | B6: ENABLE RLS על **כל 15** הטבלאות, ללא FORCE פרט ל-`business_signing_keys` (§D3.2, Amendment A-4) | ✅ | `0005_rls_policies.sql` (15 `enable row level security` statements); FORCE יחיד ב-שורה 87 |
| 6 | B6: `businesses` — SELECT+UPDATE בלבד, **ללא** INSERT/DELETE (§D3.1) | ✅ | `0005_rls_policies.sql:53-64` |
| 7 | B6: `business_members` — `bm_self`/`bm_peers`/`bm_manage` (§D3) | ✅ | `0005_rls_policies.sql:70-80` |
| 8 | B6: `business_signing_keys` — FORCE + אפס policies (§D3.2) | ✅ | `0005_rls_policies.sql:86-89` |
| 9 | B6: תבנית read/write גנרית על 8 טבלאות (`customers`, `items`, `customer_document_consents`, `documents`, `document_lines`, `payments`, `allocation_requests`, `document_public_links`) | ✅ | `0005_rls_policies.sql:96-155` |
| 10 | B6: `document_counters` — SELECT בלבד, אין policy כתיבה | ✅ | `0005_rls_policies.sql:163-165` |
| 11 | B6: `audit_log` — SELECT בלבד, אין policy כתיבה | ✅ | `0005_rls_policies.sql:175-177` |
| 12 | B6: `users` self-scoped, `vat_rates` global read (§D7 קטגוריות 3-4) | ✅ | `0005_rls_policies.sql:26-33, 42-45` |
| 13 | B6: down מפרק כל policy ומכבה RLS/FORCE — מחזיר למצב 0003a/0003b | ✅ | `migrations_down/0005_rls_policies_down.sql` |
| 14 | B7: `app.audit_trigger()` — `SECURITY DEFINER`, קורא `auth.uid()`/`request.jwt.claims`/`app.request_id` (§D6, Impl. Notes #5, whitelist #7) | ✅ | `0006_audit.sql:17-71` |
| 15 | B7: מוחל דרך `app.enforce_audit()` על 11 טבלאות כולל `businesses`, לא על `business_signing_keys`/`audit_log` | ✅ | `0006_audit.sql:77-102` |
| 16 | B7: `audit_log_immutable_trg` חוסם UPDATE/DELETE ללא יוצא מן הכלל | ✅ | `0006_audit.sql:107-121` |
| 17 | B7: `app.documents_immutable()` — default-deny whitelist (ADR-INV-002 §D3, verbatim) | ✅ | `0007_immutability.sql:13-91` |
| 18 | B7: `documents_immutable_trg` — `before update or delete ... when (old.status <> 'draft')` | ✅ | `0007_immutability.sql:87-90` |
| 19 | B7: `app.child_rows_locked()` על `document_lines`/`payments` | ✅ | `0007_immutability.sql:111-141` |
| 20 | B7: `app.allocation_requests_locked()` — DELETE תמיד אסור, UPDATE אסור אחרי `responded_at` | ✅ | `0007_immutability.sql:148-167` |
| 21 | B7: snapshot `business_entity_type` אוטומטי ב-`BEFORE INSERT` (§D8) | ✅ | `0007_immutability.sql:175-188` |
| 22 | B7: downs (0006/0007) מפרקים בסדר הפוך מדויק | ✅ | `migrations_down/0006_audit_down.sql`, `migrations_down/0007_immutability_down.sql` |
| 23 | B8: `app.seed_for()` — `continuous`/`yearly` (§D9) | ✅ | `0008_issue_function.sql:35-55` |
| 24 | B8: `app.issue_document(uuid,date)` — `SECURITY DEFINER`, 11 השלבים בסדר הנכון (§D2) | ✅ | `0008_issue_function.sql:61-326` — נעילה (89-94), הרשאה (96-100), מצב draft (102-106), טעינת עסק/רענון entity_type (108-113, 289), אימותי תוכן (115-151), חישוב מחדש (153-233), snapshots (235-266), הקצאת מספר (268-283), מעבר סטטוס (285-309), עדכון `credited_amount` באב (310-317), audit מפורש (319-322) |
| 25 | B8: הקצאת מספר ב-`UPDATE ... RETURNING`, לא `SEQUENCE` (§D1) | ✅ | `0008_issue_function.sql:271-283` |
| 26 | B8: סכומים תמיד נגזרים מ-`document_lines`+`vat_rates`, לא מהלקוח | ✅ | `0008_issue_function.sql:159-199` |
| 27 | B8: זיכוי — סכומים חיוביים במסמך, תקבולי החזר שליליים, `signed_total` נגזר (§D6) | ✅ | `0008_issue_function.sql:201-223` (בדיקת `sum(payments) = -payable`); `signed_total` הוא generated column קיים מ-0003b, לא נוגע בו batch זה |
| 28 | B8: `app.set_start_number(uuid,document_type,int,bigint)` — owner-only, רק כש-`next_number=start_number` (Impl. Notes #7) | ✅ | `0008_issue_function.sql:337-379` |
| 29 | B8: down מפרק 3 הפונקציות בסדר הפוך | ✅ | `migrations_down/0008_issue_function_down.sql` |
| 30 | חתימות פונקציות `SECURITY DEFINER` תואמות ל-whitelist הסגור מילה-במילה (§D3.2) | ✅ | 5 פונקציות ב-batch זה (`current_business_ids()`, `has_role(uuid,member_role[])`, `audit_trigger()`, `issue_document(uuid,date)`, `set_start_number(uuid,document_type,int,bigint)`) — כולן תואמות; `seed_for`/`enforce_audit`/`documents_immutable`/`child_rows_locked`/`allocation_requests_locked`/`documents_set_entity_type`/`audit_log_immutable` **אינן** `SECURITY DEFINER`, כנדרש |
| 31 | `src/lib/errors.ts` — כל קוד `INV_*` שמועלה ב-migrations ה-batch (ו-0003a) ממופה לעברית | ✅ | `src/lib/errors.ts:24-56` — 21/21 קודים גולמיים מה-SQL (`grep -oh INV_* 000*.sql`) קיימים במפה |
| 32 | `errors.test.ts` — מכסה קוד ידוע, קוד לא-ידוע, קלט null | ✅ | `src/lib/errors.test.ts:1-37` |
| 33 | `tests/no-restricted-imports.test.ts` — regression guard אמיתי ל-Biome `noRestrictedImports` על `service-role/**` (§D5) | ✅ | `tests/no-restricted-imports.test.ts:1-66` — מריץ Biome אמיתי מול fixture, לא בדיקה ידנית |
| 34 | 5 הסטיות שהבilder דיווח כתיקוני-באג (enum literal, אופרטור מערכים, generated column, cascade טיוטות, שיטת בדיקה) — כולן בתוך רוח ה-spec, לא דורשות עדכון ADR | ✅ | `0007_immutability.sql:60-69` (cast ל-text), `:16-21,54-57` (בניית `allowed` אדיטיבית), `:32-42,76-77` (הדרת `signed_total`), `:94-133` (`child_rows_locked` — NULL רק ב-DELETE נחשב "הורה כבר עבר בדיקה"); הסטייה החמישית (`select (fn()).*` מזמינה פונקציה כמה פעמים) היא ליקוי בשיטת הבדיקה הידנית של ה-builder, לא בקוד — מתועדת ב-session log, לא דורשת שינוי קוד |
| 35 | שני הממצאים המוסלמים (handle_new_auth_user חסר מ-whitelist; פונקציות `app.*` לא נגישות ל-`supabase.rpc`) — ללא עקיפה שקטה בקוד | ✅ | `0003a_core_tables.sql:43-67` — `handle_new_auth_user` עדיין `SECURITY DEFINER` ללא הוספה לשום whitelist בקוד (אין script CI עדיין); `0008_issue_function.sql:61,337` — `issue_document`/`set_start_number` עדיין ב-schema `app`, לא הועברו ל-`public` בלי עדכון ADR |

## הערכה כללית

ה-batch מכסה במדויק את כל דרישות B5-B8 מ-`invoicing-phase-0-plan.md` (Revision 3) ואת ADR-INV-001 (כולל Amendment A במלואה — §D3.1/§D3.2/§D7) ו-ADR-INV-002 (11 השלבים של `issue_document`, מונים ב-`UPDATE...RETURNING`, whitelist default-deny, snapshot, מכונת המצבים). כל 15 הטבלאות קיבלו RLS מדויק לפי המפה, FORCE מוגבל ל-`business_signing_keys` בלבד, וכל 5 הפונקציות `SECURITY DEFINER` שנוספו ב-batch תואמות את החתימות הסגורות ב-whitelist. חמש הסטיות שה-builder דיווח עליהן כ"תיקוני באג" נבדקו אחת-אחת מול קוד ה-ADR המילולי — כולן תיקונים לגיטימיים של פרטי-מימוש לא-תקפים בפוסטגרס (אופרטור מערכים לא קיים, השוואת generated column ב-trigger, casting של ערך enum שטרם קיים, MVCC visibility ב-cascade) שמשמרים את הכוונה המקורית של ה-ADR במדויק, לא סטייה מהותית ולא צריכים עדכון ADR. שני הממצאים שכבר הוסלמו לארכיטקט נבדקו לוודא היעדר עקיפה שקטה — אין. `errors.ts` ממפה את כל 21 קודי ה-`INV_*` שהועלו בפועל בקוד ה-SQL, ללא חוסר. לא נמצאה תוספת מעבר ל-scope (קבצי `sidebar`/`browser`/`server` בטווח ה-commits שייכים לתיקוני F1-F2 שכבר נסקרו בנפרד, לא לbatch זה). אין פערים, אין over-build.

---
