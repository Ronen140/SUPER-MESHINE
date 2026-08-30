# Spec Review: F3-F4 (טופס יצירת עסק + business switcher) + 4 תיקוני איכות

**תאריך:** 2026-08-30 15:45
**Task brief:** מימוש F3 (טופס `/businesses/new`) ו-F4 (business switcher אמיתי) בפרויקט invoicing-receipts, בתוספת תיקון 4 ה-🟡 מסבב code-quality-reviewer של F1-F2. המצב הסופי בדיסק הוא הקובע.
**Spec source:**
- `vault/Engineering/invoicing-phase-0-plan.md` (Subtask F3, F4)
- `invoicing-receipts/docs/adr/001-data-model-and-rls.md` §D10 (bootstrap `create_business()`, קודי שגיאה, מגבלת 10, keygen-failed→"נסה שוב")
- `vault/Discovery/2026-08-30-invoicing-ui-design-research.md` (switcher pattern)
- `vault/Reviews/quality/2026-08-30-invoicing-f1-f2.md` (4 🟡 items)
**Implementer:** frontend-builder (עם קטע auth-fixes/schema scaffolding בסבב זה)
**Commits:** `2381657`, `cd88b62`, `543d5cd`, `6809463`
**Round:** #1

## תוצאה: ❌ Spec gaps

## Spec Checklist

| # | דרישה (מה-spec) | סטטוס | עדות |
|---|---|---|---|
| 1 | טופס `/businesses/new` עם react-hook-form+zod | ✅ | `invoicing-receipts/src/app/(app)/businesses/new/business-form.tsx:70-132`, `page.tsx:1-21` |
| 2 | שולח ל-`POST /api/businesses`, לא RPC ישיר מה-frontend | ✅ | `business-form.tsx:96-105` קורא `fetch("/api/businesses")`; ה-RPC (`create_business`) נקרא רק מ-`src/app/api/businesses/route.ts:46-52`, לא מהקומפוננטה |
| 3 | ה-route קורא RPC ואז keygen בנפרד (לא מאוחד) | ✅ | `route.ts:46-58` — `supabase.rpc("create_business", ...)` ואז קריאת `fetch` נפרדת ל-`/api/keygen` ב-`requestSigningKey` (`route.ts:63-82`) |
| 4 | Spinner/מצב טעינה עד מוכן | ✅ | `business-form.tsx:294-296` (`isSubmitting` → "יוצרים עסק…") |
| 5 | שגיאות `INV_*` בעברית ידידותית | ✅ | `src/lib/errors.ts:29-64` (`toUserMessage`/`INV_ERROR_MESSAGES`) — כל 5 קודי `create_business()` (`INV_UNAUTHENTICATED`, `INV_NO_PROFILE`, `INV_BUSINESS_LIMIT`, `INV_BAD_TAX_ID`, `INV_TAX_ID_EXISTS`) ממופים |
| 6 | `entity_type` עם הסבר + אזהרת אי-שינוי | ✅ | `business-form.tsx:15-26` (תיאור לכל אופציה), `business-form.tsx:240` ("לא ניתן לשנות את סוג העסק לאחר יצירתו") |
| 7 | `tax_id` — 9 ספרות, ולידציה client-side | ✅ | `src/lib/schemas/business.ts:23` (`/^\d{9}$/`), נבדק ב-`business.test.ts:24-29` |
| 8 | מצב keygen נכשל: UI מציג "נסה שוב" (ADR-001 §D10, שורה 346) | ✅ | `business-form.tsx:163-197` (`pendingKeyBusiness`/`keygenError` state, כפתור "נסה שוב" ב-שורה 181, `handleRetryKeygen` קורא ל-`POST /api/keygen`) |
| 9 | Switcher — dropdown עסקים דרך RLS | ✅ | `src/lib/businesses/get-user-businesses.ts:24-51` (שאילתה ללא סינון מפורש — RLS בלבד), `business-switcher.tsx:94-127` |
| 10 | Switcher — מצב 0 עסקים | ✅ | `business-switcher.tsx:45-55` (קישור "עסק ראשון") |
| 11 | Switcher — מצב 1 עסק, ללא dropdown מיותר | ✅ | `business-switcher.tsx:74-92` (תצוגה סטטית) |
| 12 | Switcher — מצב 2+ עסקים, dropdown תקין | ✅ | `business-switcher.tsx:94-127`, נבדק ב-`business-switcher.test.tsx` |
| 13 | ניווט מנקה state בהחלפה ("החלפה ללא דליפה") | ✅ | `actions.ts` כותב cookie httpOnly, `business-switcher.tsx:68` (`router.refresh()`) מרענן את כל ה-`(app)` layout |
| 14 | Server action מאמת בעלות לפני כתיבת cookie | ✅ | `src/app/(app)/businesses/actions.ts:20-29` — `SELECT id FROM businesses WHERE id=$1` (RLS-scoped), 0 שורות → נדחה, רק אז cookie |
| 15 | Switcher בראש ה-sidebar (דפוס Discovery) | ✅ | `src/components/layout/sidebar.tsx:27-28` — `BusinessSwitcher` הפריט הראשון ב-`aside` |
| 16 | 🟡#1 (F1-F2): `try/catch` סביב קריאות Supabase Auth ב-3 הטפסים | ✅ | `login-form.tsx:29-45`, `signup-form.tsx:30-62`, `logout-button.tsx:17-33`, עם טסטים חדשים לכל אחד (`*.test.tsx`) |
| 17 | 🟡#2 (F1-F2): signup בודק `data.session` (confirm-email flow) | ✅ | `signup-form.tsx:39-49` + `signup-form.test.tsx` (מבחן חדש ל-session null) |
| 18 | 🟡#3 (F1-F2): לוג על env חסר ב-middleware | ✅ | `src/lib/supabase/middleware.ts:22-24` |
| 19 | 🟡#4 (F1-F2): לוג ב-`catch` הרשתי ב-middleware | ✅ | `middleware.ts:49-51` |
| 20 | dev-preview scaffolding זמני (`scripts/verify-f3-f4.mjs`, `src/app/dev-preview-f3-f4/`) הוסר מהדיסק ומה-build | ✅ | `find` על הדיסק וה-`.next` — 0 תוצאות; `git status --short` נקי |

## Extra items

1. **שדות כתובת (`address_line1`/`city`/`postal_code`) בטופס F3** ב-`invoicing-receipts/src/app/(app)/businesses/new/business-form.tsx:268-286` — לא מופיעים בשום מקום ב-spec של F3 (`vault/Engineering/invoicing-phase-0-plan.md` Subtask F3 אינו מזכיר שדה כתובת כלל), ואינם חלק מחתימת `public.create_business()` לפי ADR-INV-001 §D10 (`p_legal_name, p_entity_type, p_tax_id, p_tax_id_type, p_display_name` — בלבד, ללא פרמטרי כתובת). ה-Discovery ממקם "כתובת" תחת "הגדרות עסק" — מסך Phase 1 נפרד (`vault/Discovery/2026-08-30-invoicing-ui-design-research.md:149`), לא תחת יצירת עסק ב-Phase 0. ה-implementer בנה מנגנון נוסף ל"best-effort" (`saveAddressDetails`, `business-form.tsx:43-68`) שכותב ישירות ל-`businesses` דרך ה-client browser, מחוץ ל-`POST /api/businesses` — פיצ'ר שלם שלא התבקש, כולל path-קוד נפרד, error handling נפרד, ובדיקה ייעודית (`business-form.test.tsx:93-116`).

## הערכה כללית

הליבה של F3-F4 מיושמת במדויק מול ה-spec: הטופס עובר דרך `POST /api/businesses` (לא RPC ישיר), הפרדת RPC/keygen נשמרת, כל 5 קודי `INV_*` של `create_business()` ממופים לעברית, מצב keygen-נכשל מציג בדיוק את הבאנר+"נסה שוב" הנדרש ב-ADR-INV-001 §D10, וה-switcher מכסה נכון את שלושת המצבים (0/1/2+) עם אימות בעלות אמיתי לפני כתיבת cookie ומיקום נכון בראש ה-sidebar. כל 4 ה-🟡 מסבב F1-F2 תוקנו בפועל עם טסטים אמיתיים (לא רק תיעוד). ה-dev-preview הזמני הוסר במלואו מהדיסק ומה-build, כנדרש. הפער היחיד שמוריד את הציון ל-❌ הוא over-build אחד ברור: שדות כתובת נוספו לטופס יצירת העסק יחד עם מנגנון כתיבה נפרד שלם (`saveAddressDetails`) — פיצ'ר שלא הוזמן ב-F3, לא נתמך ע"י `create_business()`, ומקומו התיעודי (Discovery) הוא מסך "הגדרות עסק" בפאזה מאוחרת יותר, לא טופס היצירה. זו תוספת סקופ שה-CEO צריך להחליט אם להשאיר או להסיר — במיוחד לאור זה שגם דף היצירה עצמו (`page.tsx:11-12`) אומר למשתמש שאפשר להוסיף כתובת "בהמשך דרך הגדרות העסק", מה שהופך את השדות הקיימים בטופס לכפולים-לכאורה מול ההודעה שלצידם.

**הערה נפרדת (לא checklist item, לתשומת לב ה-CEO):** בבדיקת ה-git history התברר שקבצי הליבה של F3 (`business-form.tsx`, `business-form.test.tsx`, `businesses/new/page.tsx`, `dropdown-menu.tsx`) אינם מופיעים באף אחד מ-4 ה-SHA-ים שסופקו לביקורת — הם נוספו בפועל בקומיט `d560bf0`, שכותרתו "add storage isolation suite" ואינו חלק מרשימת ה-commits של הסבב הזה. אותו קומיט גם כולל שכתוב מלא של 1001 שורות ב-ADR-INV-001. הביקורת בוצעה מול מצב הדיסק הסופי (כפי שהתבקש במפורש), כך שהמסקנה לעיל תקפה — אך worth flagging: אם ה-CEO מסתמך על רשימת commits לצורך code-quality-reviewer/domain-expert בהמשך השרשרת, יש לכלול גם את `d560bf0` בטווח ה-diff, אחרת חלק ניכר מהמימוש בפועל (כולל ה-Extra item שצוין למעלה) לא ייבדק.

---
