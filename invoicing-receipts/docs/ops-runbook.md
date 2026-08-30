# Runbook — הקמת סביבה חיה (invoicing-receipts)

**מטרה:** צ'ק-ליסט צעד-אחר-צעד לסשן ההקמה החיה עם המייסד — יצירת פרויקט Supabase אמיתי,
חיבור Vercel, הגדרת כל הסודות, הפעלת ג'ובי ה-ops (keepalive/backup/restore-test), וגיבוי ה-KEK
מחוץ למערכת. עד לסשן הזה **כל** מה שנבנה (schema, RLS, `issue_document()`, `create_business()`,
`keygen.py`, workflows) נבדק אך ורק מול Postgres מקומי/CI — שום דבר לא רץ מול Supabase אמיתי.

**מתי להריץ את הצ'ק-ליסט הזה:** לפני שמישהו אמיתי (חוץ מהמייסד) נרשם למערכת. לא לפני — B14
נבנה כתשתית שממתינה, לא כדרישה חוסמת ל-Phase 0 עצמו (ראו
[[invoicing-phase-0-acceptance]] §B14).

**קדם-דרישות:** גישת admin ל-GitHub repo `Ronen140/SUPER-MESHINE`, חשבון Cloudflare (ל-R2),
חשבון Vercel, וכלי `supabase` CLI מותקן מקומית (`pnpm add -g supabase` או `npx supabase`).

---

## שלב 1 — יצירת פרויקט Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** → Free tier.
   שם מוצע: `invoicing-receipts-prod`. אזור: הקרוב ביותר למייסד (latency).
2. שמרו את **Database Password** שנוצר בשלב הזה — זה חלק מ-`SUPABASE_DB_URL` (שלב 3).
3. מהדשבורד → **Project Settings → General**: שמרו את ה-`Project Reference ID` (למשל `abcdefghij`).
4. מהדשבורד → **Project Settings → API**: שמרו:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (**סודי!**) → `SUPABASE_SERVICE_ROLE_KEY`
5. מהדשבורד → **Project Settings → Database → Connection string**: בחרו **URI**, מצב
   **Session** (לא Transaction/PgBouncer — `pg_dump`/migrations צריכים חיבור session יציב, לא
   pooled). זו נקודת ההתחלה של `SUPABASE_DB_URL` (שלב 3) — יש להחליף את `[YOUR-PASSWORD]`
   בסיסמה משלב 2.

## שלב 2 — הרצת ה-migrations על הפרויקט החי

```bash
cd invoicing-receipts
supabase link --project-ref <project-ref-משלב-1.3>
supabase db push        # מחיל את כל supabase/migrations/*.sql לפי הסדר, בטרנזקציה
```

**וידוא:** בדשבורד → **Table Editor** — 15+ הטבלאות (`businesses`, `documents`,
`business_signing_keys` וכו') קיימות. בדשבורד → **Database → Functions** — `create_business`,
`issue_document`, `current_business_ids` וכו' קיימות תחת schema `app`.

⚠️ **אל תריצו `supabase db reset` על הפרויקט החי** — זו פקודה הרסנית (מוחקת הכל ובונה מחדש).
היא בטוחה רק מקומית. אין ל-Supabase CLI מקבילה ל"push גולמי" ללא migrations מוסכמות — `db push`
עצמו כבר עושה את זה נכון (מריץ קבצי migration בסדר, לא DDL אד-הוק).

## שלב 3 — Storage buckets

`supabase db push` כבר יצר את שני ה-buckets (`documents`, `business-assets`) ואת ה-policies
שלהם — הם מוגדרים ב-`supabase/migrations/0012_storage_buckets.sql`, לא בממשק. בדקו בדשבורד →
**Storage** ששניהם מופיעים ומסומנים **Private**. אין צורך ליצור bucket `chromium` — הוא Phase 1
(ADR-INV-003 §D1) ולא קיים ב-migrations של Phase 0.

## שלב 4 — הגדרת כל ה-Secrets

### 4א. משתני סביבה של האפליקציה (Vercel)

| שם | ערך | מקור |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | שלב 1.4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | שלב 1.4 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | שלב 1.4 — **Sensitive**, לעולם לא `NEXT_PUBLIC_` |
| `SIGNING_MASTER_KEK_V1` | ראו למטה | נוצר כאן, פעם אחת |
| `INTERNAL_PIPELINE_SECRET` | ערך אקראי | נוצר כאן, פעם אחת (Phase 1, אך מומלץ להגדיר כבר עכשיו) |

**יצירת `SIGNING_MASTER_KEK_V1`** (ADR-INV-003 §D4 — 32 בייט אקראיים, **base64**, לא hex):

```bash
python3 -c "import base64, os; print(base64.b64encode(os.urandom(32)).decode())"
```

הריצו **פעם אחת בלבד**. הערך הזה מפענח את כל מפתחות החתימה של כל העסקים — ראו שלב 6 (גיבוי
ה-KEK) לפני שממשיכים הלאה. אובדן שלו ⇒ לא ניתן לחתום מסמכים חדשים (מסמכים חתומים קיימים
נשארים תקפים — ADR-INV-003 §D4 "אובדן ה-KEK אינו קטסטרופה").

**יצירת `INTERNAL_PIPELINE_SECRET`:**

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4ב. Secrets של GitHub Actions (ops jobs — B14)

ב-GitHub: **Settings → Secrets and variables → Actions → New repository secret**, ברמת
הרפוזיטורי (`Ronen140/SUPER-MESHINE`) — כל ה-workflows (`keepalive.yml`, `backup.yml`,
`restore-test.yml`) נמצאים ב-`.github/workflows/` **בשורש הרפוזיטורי** (לא תחת
`invoicing-receipts/` — ראו הערה חשובה בסוף המסמך).

| שם | ערך | מקור |
|---|---|---|
| `SUPABASE_DB_URL` | connection string session-mode | שלב 1.5 — **בדיוק** אותו ערך המשמש ל-`supabase link` |
| `BACKUP_ENCRYPTION_KEY` | passphrase ארוך אקראי | ראו למטה |
| `R2_ACCOUNT_ID` | Cloudflare account ID | שלב 5 |
| `R2_ACCESS_KEY_ID` | R2 API token | שלב 5 |
| `R2_SECRET_ACCESS_KEY` | R2 API token | שלב 5 |
| `R2_BUCKET` | שם ה-bucket ב-R2 | שלב 5 |

**יצירת `BACKUP_ENCRYPTION_KEY`** (סוד עצמאי — **שונה** מ-`SIGNING_MASTER_KEK_V1`; אובדן שלו לא
פוגע בחתימות, רק בגיבויים):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

שמרו אותו גם מחוץ למערכת (יחד עם ה-KEK, שלב 6) — בלעדיו הגיבויים הקיימים ב-R2 בלתי-קריאים
לצמיתות, גם אם ה-repo וה-Supabase project עצמם שלמים.

## שלב 5 — יצירת bucket ב-Cloudflare R2

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**.
   שם מוצע: `invoicing-receipts-backups`. Location: Automatic.
2. **Manage R2 API Tokens** → **Create API token** → הרשאות **Object Read & Write** מוגבלות
   ל-bucket הזה בלבד (לא Account-wide). שמרו **Access Key ID** ו-**Secret Access Key** —
   מוצגים פעם אחת בלבד.
3. ה-Account ID מופיע בפינה הימנית העליונה של דשבורד Cloudflare (או ב-URL של ה-bucket).
4. מלאו את ארבעת ה-secrets מטבלת 4ב.

## שלב 6 — חיבור Vercel

1. [vercel.com/new](https://vercel.com/new) → Import מ-`Ronen140/SUPER-MESHINE`.
2. **Root Directory:** `invoicing-receipts` (הפרויקט הוא תת-תיקייה עצמאית ב-monorepo — ראו
   `pnpm-workspace.yaml` המקומי).
3. **Framework Preset:** Next.js (אוטומטי).
4. **Environment Variables:** הזינו את חמשת המשתנים מטבלת 4א (Production **וגם** Preview אם
   רוצים preview deployments עובדים מול אותו פרויקט Supabase — לא מומלץ ל-production data,
   שקלו פרויקט Supabase נפרד ל-preview בעתיד).
5. **Deploy.** ודאו build ירוק — הוא כולל גם את ה-Python function (`api/keygen.py`,
   `requirements.txt` בשורש) בנוסף ל-Next.js.
6. **Root Directory ל-Python:** ודאו ש-Vercel זיהה את `api/keygen.py` כ-Python Function
   (Vercel → Deployments → Functions — אמור להופיע `api/keygen.py` עם runtime Python).

## שלב 7 — גיבוי ה-KEK מחוץ למערכת (⚠️ C4 — לא ניתן לדילוג)

**זו התחייבות תפעולית אישית של המייסד, לא שלב טכני** (ADR-INV-003 §Reversal Conditions, C4).
מי ששולט בערך `SIGNING_MASTER_KEK_V1` שולט ביכולת לחתום מסמכים חדשים בשם כל עסק במערכת;
אובדן שלו בלי גיבוי חיצוני = חסימת הפקת מסמכים לצמיתות (לא אובדן מסמכים קיימים — ראו §D4).

1. העתיקו את הערך של `SIGNING_MASTER_KEK_V1` (משלב 4א) ואת `BACKUP_ENCRYPTION_KEY` (משלב 4ב)
   **למקום מחוץ ל-Vercel/GitHub לגמרי** — מומלץ אחד משני אלה:
   - **1Password** (או מנהל סיסמאות אחר) — פריט חדש "invoicing-receipts — master secrets",
     עם שני הערכים + תאריך היצירה + `kek_id` (`v1`).
   - **מעטפה חתומה פיזית** — הדפסה, חתימה על הסגירה, אחסון במקום בטוח (כספת/תיק מסמכים).
2. **וודאו שאתם יכולים לשחזר את הערך בפועל** — פתחו את הפריט ב-1Password (או המעטפה) ווידאו
   שהוא קריא ותואם למה שמוגדר ב-Vercel/GitHub. גיבוי שלא נבדק הוא לא גיבוי.
3. תעדו את התאריך והמיקום ב-`vault/Meeting Notes/invoicing-receipts-system.md` (Session Log)
   — **בלי הערך עצמו**, רק "בוצע ב-[תאריך], מיקום: [1Password/מעטפה]".

## שלב 8 — הפעלת ה-workflows

שלושת ה-workflows כבר קיימים ב-`.github/workflows/` (בשורש הרפוזיטורי) ורצים על cron אוטומטית
ברגע שה-secrets מוגדרים (שלב 4ב) — אין "הפעלה" נפרדת נדרשת. לבדיקה ידנית מיידית (לא להמתין
ל-cron):

1. GitHub → **Actions** → בחרו workflow → **Run workflow** (workflow_dispatch), עבור כל אחד
   משלושת אלה, **בסדר הזה**:
   - **Keepalive** — אמור לרוץ תוך שניות, ללא שגיאה. לוג מצופה: `keepalive: OK`.
   - **Backup to R2** — אמור ליצור אובייקט `daily/<תאריך-היום>.sql.enc` ב-bucket
     (בדקו בדשבורד Cloudflare R2 → Objects). לוג מצופה: `backup-to-r2 OK (<תאריך>)`.
   - **Restore Test** — רק אחרי שיש לפחות גיבוי אחד מהשלב הקודם. אמור לשחזר לבסיס נתונים
     זמני על ה-runner עצמו (לא נוגע ב-Supabase החי) ולדווח `restore-test OK (..., N public
     tables, M documents rows)`. אם `documents rows` הוא 0 — תקין (אין עדיין מסמכים אמיתיים),
     אבל `public tables` חייב להיות > 0.
2. אם workflow כלשהו מדפיס `skipping — missing: ...` — חסר secret. חזרו לשלב 4/5.

## שלב 9 — אימות ראשון (signup → create business → בדיקת מפתח)

1. גשו ל-`https://<vercel-deployment-url>/signup`, הירשמו עם אימייל אמיתי של המייסד.
2. וודאו ב-Supabase Dashboard → **Authentication → Users** שהמשתמש נוצר, **וגם** ב-
   **Table Editor → public.users** ששורה מקבילה נוצרה (`on_auth_user_created` trigger).
3. גשו ל-`/businesses/new`, מלאו טופס עסק ראשון (ח.פ/ע.מ תקין, 9 ספרות).
4. **וידוא הצלחה (בתוך 5 שניות, לפי F3 AC):**
   - העסק מופיע ב-**Table Editor → public.businesses**.
   - שורה תואמת ב-**public.business_members** עם `role='owner'`.
   - שורה ב-**public.business_signing_keys** עם `is_active=true` — **זה הבדיקה הקריטית**: אם
     חסרה, `POST /api/keygen` נכשל בשקט (יש retry banner ב-UI — ADR-INV-001 §D10) ולא ניתן
     יהיה להפיק מסמכים (`INV_NO_SIGNING_KEY`).
   - בדקו שדה `certificate_pem` בשורה — אמור להתחיל ב-`-----BEGIN CERTIFICATE-----`.
5. שורת `audit_log` נוצרה עם `action` מתאים ליצירת העסק (invariant #2 — audit על כל mutation).
6. אם יש 2+ עסקים, בדקו את ה-business switcher (F4) — מעבר בין עסקים לא דולף נתונים
   (RLS מוכח כבר ב-CI, זה רק sanity ויזואלי).

**סטטוס אחרי הצ'ק-ליסט הזה:** המערכת חיה, מגובה, ומאומתת עם עסק אמיתי אחד. Phase 0 "go-live"
הושלם. שימוש נוסף (עורך מסמכים, PDF, שליחה) הוא Phase 1 ואינו חלק מהצ'ק-ליסט הזה.

---

## הערה חשובה — מיקום קבצי ה-Workflow (התגלה ותוקן ב-B14)

GitHub Actions מזהה workflows **אך ורק** תחת `.github/workflows/` ב**שורש הרפוזיטורי**
(`SUPER-MESHINE/`), לא תחת תיקיית תת-פרויקט. `ci.yml` (B13) נוצר בטעות תחת
`invoicing-receipts/.github/workflows/` — כלומר **מעולם לא היה יכול לרוץ בפועל** על GitHub,
למרות שה-Phase-0-acceptance-review תיאר זאת כ"לא נבדק על runner אמיתי, אך לא defect" (ראו
[[invoicing-phase-0-acceptance]] §B13). ב-B14 גיליתי את זה תוך כדי מיקום שלושת ה-workflows
החדשים, ו**העברתי גם את `ci.yml`** לשורש הרפוזיטורי (`git mv`, ללא שינוי תוכן מלבד תיקון שגיאת
YAML לא-קשורה שנמצאה תוך כדי — ציטוט `name:` עם `:` פנימי שגרם ל-parse error). כל ארבעת
ה-workflows (`ci.yml`, `keepalive.yml`, `backup.yml`, `restore-test.yml`) נמצאים כעת יחד תחת
`SUPER-MESHINE/.github/workflows/`, עם `working-directory: invoicing-receipts` ו-`paths:
["invoicing-receipts/**"]` (עבור `ci.yml`) כדי לפעול נכון מתוך ה-monorepo.
