# Spec Review: invoicing-receipts F1-F2 (app shell + auth flow)

**תאריך:** 2026-08-30 (זמן כתיבה)
**Task brief:** F1 — shadcn/ui init + RTL layout + Supabase client wiring (anon בלבד). F2 — signup/login/logout + middleware הפניה.
**Spec source:** `vault/Engineering/invoicing-phase-0-plan.md` (Revision 3, subtasks F1/F2) + `vault/Discovery/2026-08-30-invoicing-ui-design-research.md` + `invoicing-receipts/docs/adr/001-data-model-and-rls.md` §D5
**Implementer:** frontend-builder
**Commits:** ae24c22
**Round:** #1

## תוצאה: ❌ Spec gaps

## Spec Checklist

| # | דרישה (מה-spec) | סטטוס | עדות |
|---|---|---|---|
| 1 | F1: `shadcn/ui` init — primitives + `components.json` | ✅ | `invoicing-receipts/components.json:1-21` (style=new-york, baseColor=stone, aliases תקינים); primitives ידניים תואמי-מוסכמה ב-`src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`. חריגה מתועדת (proxy חוסם `ui.shadcn.com` 403) — תואם רוח ה-spec, לא סטייה מהותית. |
| 2 | F1: `<html dir="rtl" lang="he">` גלובלי | ✅ | `invoicing-receipts/src/app/layout.tsx:20` |
| 3 | F1/Discovery §6: logical properties בלבד, אין `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` פיזיים | ✅ | grep על כל קבצי `.tsx` שנוספו/שונו בקומיט — 0 matches. `sidebar.tsx`/`aside` משתמש ב-`border-e` (logical) |
| 4 | Discovery §3: primary אחד בלבד — stone נייטרלי + emerald | ✅ | `invoicing-receipts/src/app/globals.css:11-40` — `--primary: #047857` (emerald-700) יחיד; שאר הטוקנים ניטרליים (stone) או סמנטיים (success/warning/destructive) לפי §3 |
| 5 | Discovery §3: פונט Assistant + fallback Heebo/Noto Sans Hebrew | ✅ | `invoicing-receipts/src/app/layout.tsx:2-11` (`next/font/google`, subsets hebrew+latin); `invoicing-receipts/src/app/globals.css:46-47` (`--font-sans: var(--font-assistant), Heebo, "Noto Sans Hebrew", ...`) |
| 6 | Discovery §3/§6: `tabular-nums` לטבלאות/מספרים | ✅ | `invoicing-receipts/src/app/globals.css:98-102` |
| 7 | F1: `src/lib/supabase/browser.ts`+`server.ts`, `anon` בלבד | ✅ | `invoicing-receipts/src/lib/supabase/browser.ts:1-23`, `server.ts:1-46` — קוראים רק `NEXT_PUBLIC_SUPABASE_ANON_KEY`, אין `service_role`/`SUPABASE_SERVICE_ROLE_KEY` בקוד הלקוח (grep על כל הקומיט — 0 matches מחוץ להערות ADR) |
| 8 | F1 brief (CEO): sidebar עם placeholder ל-switcher | ✅ | `invoicing-receipts/src/components/layout/sidebar.tsx`, `business-switcher-placeholder.tsx` — כפתור מנוטרל, ללא רשימת עסקים אמיתית |
| 9 | F1: עמוד בית | ✅ | `invoicing-receipts/src/app/(app)/page.tsx:1-11` |
| 10 | F1 AC: "client factories מכוסים בבדיקות" | ❌ | אין קובץ טסט ל-`src/lib/supabase/browser.ts` ולא ל-`server.ts`. הקבצים היחידים שמזכירים `@/lib/supabase/browser` הם `login-form.test.tsx`, `signup-form.test.tsx`, `logout-button.test.tsx` — וכולם עושים `vi.mock(...)` עליו, כך שהקוד עצמו (כולל ה-`throw` על env חסר) אף פעם לא רץ תחת טסט |
| 11 | F1 AC: "ווידוא דפדפן" | ❌ | האימות שבוצע הוא `pnpm dev` + `curl` (HTML/redirects) ו-Vitest+Testing-Library על jsdom — לא דפדפן אמיתי/headless. מתועד במפורש ב-session log כ"לא אומת" (`vault/Meeting Notes/invoicing-receipts-system.md`, סעיף Verified) |
| 12 | F2: middleware מגן על כל הנתיבים חוץ מ-public paths | ✅ | `invoicing-receipts/src/middleware.ts:1-32`, `invoicing-receipts/src/lib/auth/public-paths.ts:1-14` (`/login`, `/signup`, `/auth`) |
| 13 | F2: `/login`, `/signup` pages | ✅ | `invoicing-receipts/src/app/(auth)/login/page.tsx`, `.../signup/page.tsx` |
| 14 | F2: logout מנקה session | ✅ | `invoicing-receipts/src/components/auth/logout-button.tsx:1-51` (`supabase.auth.signOut()` + redirect ל-`/login`) |
| 15 | F2 brief: ולידציה zod | ✅ | `invoicing-receipts/src/app/(auth)/login/login-form.schema.ts`, `.../signup/signup-form.schema.ts` |
| 16 | F2 brief: שגיאות בעברית | ✅ | `invoicing-receipts/src/lib/supabase/auth-errors.ts:1-37` (`mapAuthError`) |
| 17 | ADR-INV-001 §D5: אין import של `service-role`/`SUPABASE_SERVICE_ROLE_KEY` מ-frontend | ✅ | אומת ב-grep על כל הקומיט — אין import מ-`src/server/service-role/` וללא `SUPABASE_SERVICE_ROLE_KEY` בקוד חדש |
| 18 | חריגה מסומנת: primitives shadcn ידניים תואמים רוח ה-spec | ✅ | ראה #1 |
| 19 | חריגה מסומנת: Supabase Auth ישירות מהדפדפן בלי tRPC — האם מתועד כהכרעת ארכיטקט | ✅ | `vault/Engineering/invoicing-phase-0-plan.md:25` — "אין Drizzle/tRPC בפרויקט הזה... זו בחירת הארכיטקט המחייבת" — כתוב מפורשות ב-plan, לא המצאה של ה-builder |
| 20 | היקף: אין מימוש F3 (יצירת עסק) | ✅ | לא נמצאו קבצים תחת `/businesses/new` בקומיט |
| 21 | היקף: אין switcher פונקציונלי (F4) | ✅ | `business-switcher-placeholder.tsx` — כפתור `disabled`, ללא רשימת עסקים |
| 22 | היקף: אין נגיעה ב-migrations/backend | ✅ | `git show ae24c22 --stat` — כל השינויים תחת `src/`, config files, ו-vault בלבד |

## Missing items

1. **client factories מכוסים בבדיקות (F1 AC)** — `invoicing-receipts/src/lib/supabase/browser.ts` ו-`invoicing-receipts/src/lib/supabase/server.ts` אין להם קובצי טסט משלהם. הם רק מוחלפים ב-`vi.mock` בטסטים של `login-form`/`signup-form`/`logout-button`, כך שהלוגיקה בפועל בתוך ה-factories (כולל שגיאת ה-`throw` כש-`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` חסרים) אינה נבדקת בשום מקום.
2. **ווידוא דפדפן (F1 AC)** — הספק דרש "ווידוא דפדפן" כ-acceptance criterion. מה שבוצע בפועל הוא `curl` (בדיקת HTML/redirects/headers) ו-Vitest על jsdom — לא דפדפן אמיתי או headless (Playwright וכד'). מתועד בעצמו כ"לא אומת" ב-session log.

## Extra items

1. **קישורי ניווט ל-`/documents` ו-`/customers`** ב-`invoicing-receipts/src/components/layout/sidebar.tsx:6-10` (`NAV_ITEMS`) — אלו מסכי Phase 1 מלאים לפי `vault/Engineering/invoicing-phase-0-plan.md` ("עורך המסמכים, קטלוג הפריטים, הדשבורד... נשארים Phase 1 במלואם") ולפי `vault/Discovery/2026-08-30-invoicing-ui-design-research.md` §4.3-4.4. F1 spec (`Files predicted`) לא כלל sidebar עם ניווט למסכים אלו — ההכרעה המפורשת ב-plan הייתה "שלד אפליקציה מינימלי + auth + יצירת עסק + business switcher — **ולא יותר**". הקישורים מובילים לנתיבים שלא קיימים (404), אז אינם מזיקים פונקציונלית, אך הם חשיפת מבנה-ניווט של Phase 1 שלא הוזמן במסגרת F1.

## הערכה כללית

המימוש מכסה נכון את רוב הדרישות המהותיות של F1-F2: RTL תקין (`dir="rtl" lang="he"`, logical properties בלבד, ללא הפרות פיזיות), שפת העיצוב (stone+emerald primary יחיד, פונט Assistant+fallbacks, tabular-nums) יושמה מדויק לפי מסמך המחקר, ה-Supabase clients הם anon-בלבד ותואמים את ADR-INV-001 §D5 (אין import של service-role/service_role key), ושתי החריגות שה-builder סימן (primitives ידניים, קריאה ישירה ל-Supabase Auth בלי tRPC) מתועדות ומאומתות מול ה-plan בפועל. עם זאת, שני AC מפורשים מ-F1 לא מולאו: אין טסט ישיר ל-client factories (`browser.ts`/`server.ts`), והאימות שבוצע הוא curl+jsdom ולא "ווידוא דפדפן" אמיתי כפי שנדרש. בנוסף נמצאה חריגת scope קלה — קישורי ניווט ב-sidebar למסכי Phase 1 (`/documents`, `/customers`) שלא נכללו ב-F1 spec ומנוגדים במפורש להכרעת הגבול Phase 0/1 בתוכנית העבודה.

---

# Round 2 — Re-review of 3 fixes (commit b8602d3)

**תאריך:** 2026-08-30 (זמן כתיבה, סבב 2)
**Commits:** b8602d3
**Scope:** בדיקה ממוקדת של שלושת ה-Missing/Extra items מסבב 1 בלבד — לא re-review מלא של F1-F2.

## תוצאה (סבב 2, ממוקד): ✅ שלושת הפערים נסגרו

| # | פער מסבב 1 | סטטוס | עדות |
|---|---|---|---|
| 1 | client factories מכוסים בבדיקות | ✅ נסגר | `invoicing-receipts/src/lib/supabase/browser.test.ts` (חדש) — מריץ את `createClient()` האמיתי (import ישיר, לא mock): בודק `throw` על `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` חסרים וגם מקרה הצלחה (`client.auth.signInWithPassword`, `client.from` קיימים). `invoicing-receipts/src/lib/supabase/server.test.ts` (חדש) — מוקם רק `next/headers` (Next runtime API, לא הקוד שלנו), מריץ את `createClient()` האמיתי כולל שני נתיבי ה-`throw`, ומאמת שה-cookie adapter האמיתי נקרא בפועל (`getAllMock` נקרא דרך `client.auth.getSession()`). זו כיסוי אמיתי של הקוד, לא רק mock. |
| 2 | ווידוא דפדפן | ✅ נסגר | 7 screenshots ב-scratchpad, נבדקו 3: `login-validation-errors.png` — RTL מלא (לייבלים וטקסט מיושרים לימין, כיוון קריאה נכון), הודעות שגיאה בעברית ("נא להזין כתובת אימייל תקינה.", "יש להזין סיסמה.") בגבול אדום; `signup-mismatch-error.png` — טופס הרשמה מלא ב-RTL, "הסיסמאות אינן תואמות." מוצג נכון; `root-redirected-to-login.png` — ניווט מ-`/` (לא מחובר) הגיע בפועל למסך login מרונדר ב-Chromium אמיתי (RTL, פונט, טוקני עיצוב stone+emerald נראים תואמים ל-globals.css). זהו אימות Chromium headless אמיתי (Playwright), לא רק curl/jsdom כפי שהיה בסבב 1. |
| 3 | Sidebar — "מסמכים"/"לקוחות" ל-Phase 1 | ✅ נסגר | `invoicing-receipts/src/components/layout/sidebar.tsx` — פוצל ל-`ACTIVE_NAV_ITEMS` (רק "בית", `<Link href="/">`) ו-`UPCOMING_NAV_ITEMS` ("מסמכים"/"לקוחות" — `<span aria-disabled="true">` עם badge "בקרוב", **ללא** `href`/`<Link>`). `invoicing-receipts/src/components/layout/sidebar.test.tsx` (חדש) מוודא במפורש: `queryByRole("link", { name: /מסמכים/ })`/`/לקוחות/` אינם קיימים ב-DOM כ-link, וטקסט "בקרוב" מופיע פעמיים. |

## Extra items (סבב 2 — נבדק, לא נמצא חדש)

בדיקת ה-diff המלא של `b8602d3` (`package.json`, `errors.ts`/`errors.test.ts`) — אין תוספת scope חדשה: `playwright` נוסף כ-devDependency (תואם את הצורך באימות דפדפן, לא שימוש-יתר); השינויים ב-`errors.ts`/`errors.test.ts` הם עיצוב/פורמט בלבד (biome quoting/line-wrap) על קובץ קיים של backend-builder, לא שינוי פונקציונלי ולא בסקופ F1/F2.

## הערכה כללית (סבב 2)

שלושת הפערים שזוהו בסבב 1 נסגרו במלואם ובאופן שממש עונה על רוח ה-AC המקורי (בדיקות שמריצות קוד אמיתי, לא mock; דפדפן headless אמיתי, לא curl/jsdom; sidebar שאין בו קישורים אמיתיים ל-Phase 1). לא נמצאה חריגת scope חדשה בתיקון עצמו. **מסקנה: F1-F2 כעת ✅ Spec compliant** (בכפוף לכך שזהו re-review ממוקד בשלושת הפריטים בלבד ולא ביקורת חוזרת מלאה של כל ה-checklist המקורי מסבב 1 — שאר 22 השורות שם כבר היו ✅ ולא שונו בקומיט הזה).

---
