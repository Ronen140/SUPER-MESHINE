# ADR 002: Multi-Tenancy Strategy

**Date:** 2026-05-07
**Status:** Proposed
**Decider:** Architect (proposed), CEO (final approval)

## Context

SUPER-MESHINE היא ERP multi-tenant עם MVP cloud-only על Vercel + Supabase (Postgres יחיד), והיעד הוא 1-50 tenants ב-MVP ו-200-1000 tenants בשנה השנייה. ה-architecture invariant ב-`CLAUDE.md` קובע: "Multi-tenancy בכל שורה" — כל טבלה שמשויכת ל-tenant חייבת `tenant_id` עם RLS / scoped query. שתי דרישות מיוחדות מקשות על הבחירה: (א) **Customization Agent** משנה schema per-tenant (הוספת שדות, טבלאות, lookups), ו-(ב) **AI agents** (Process Agents, Copilot) מריצים queries בשם משתמשים וחייבים לכבד את ה-isolation אוטומטית, גם כשאין מהנדס שעובר על הקוד. ההחלטה הזו תקבע איך כל טבלה תיראה, איך כל query ייכתב, ואיך onboarding עובד — היא בפועל בלתי-הפיכה אחרי שיש ייצור.

## Options Considered

### Option A: Row-Level Security (RLS) על Schema משותף

כל הטבלאות שלמעט metadata גלובלי (tenants, users, billing) חיות ב-schema יחיד עם עמודת `tenant_id uuid not null` ו-RLS policies שמסננות לפי `current_setting('app.current_tenant')`. כל בקשה (HTTP/tRPC) פותחת transaction ש-`SET LOCAL app.current_tenant = '<uuid>'` לפני שמריצה queries. Customization Agent מוסיף עמודות/טבלאות עם ה-convention הקבוע ויוצר RLS policy אחיד לכל טבלה חדשה.

- **Pros:** native ל-Supabase ולמערכת ה-auth שלו (`auth.uid()`); cluster יחיד = onboarding מיידי וזול; cross-tenant analytics טריוויאלי (super-admin role עוקף RLS); migration אחת מתפרסת לכל ה-tenants ביחד; backup/restore של ה-DB כולה ב-snapshot אחד; הכי מתאים ל-AI agents כי הם פותחים session ב-tenant context וכל query אחרי זה בטוח אוטומטית.
- **Cons:** isolation logical בלבד — bug ב-policy או query שעוקף RLS (למשל function עם `security definer` שכתוב לא נכון) יכול לדלוף; "noisy neighbor" — tenant אחד עם שאילתה כבדה משפיע על השאר; restore של tenant יחיד דורש logical extraction ולא pg restore; index bloat כש-`tenant_id` הוא prefix של כל index.
- **Risk:** RLS policy שגוי או חסר על טבלה חדשה = data leak בין lקוחות. הפחתה: bootstrap migration שאוכף RLS לכל טבלה חדשה אוטומטית + lint בזמן build.

### Option B: Schema-per-Tenant

כל tenant מקבל schema משלו (`tenant_<slug>.items`, `tenant_<slug>.purchase_orders` וכו'); `public` מחזיק רק metadata (tenants, users, sessions). הבקשה קובעת `SET search_path = tenant_<slug>, public` בתחילת ה-transaction. Customization Agent מבצע ALTER על ה-schema הספציפי; migrations של core עוברות ב-loop על כל ה-schemas.

- **Pros:** isolation חזק יותר — שגיאת search_path מחזירה "table does not exist" במקום נתונים זרים; per-tenant customization "טבעי" (העמודה המותאמת קיימת רק ב-schema של ה-tenant, בלי `customizations.field_x` JSON על משותף); per-tenant restore פשוט יחסית (`pg_dump --schema=tenant_x`).
- **Cons:** ב-1000 tenants → 1000+ schemas × עשרות טבלאות = עשרות אלפי relations; פוגע ב-Postgres catalog performance ("too many tables" — תיעוד ידוע מ-Citus/Crunchy ב-scale הזה); כל core migration רצה N פעמים — עם 1000 tenants migration שלוקחת 200ms = 200 שניות + risk של partial failure באמצע; cross-tenant analytics דורש UNION ALL מ-N schemas (יקר ולא מנוהל); Supabase RLS-on-`auth.uid()` לא עובד out-of-the-box; connection pooler (PgBouncer ב-transaction mode) לא תומך ב-`SET search_path` persistent — צריך להריץ את זה בכל transaction.
- **Risk:** ב-200+ tenants המודל מתחיל להיתקל בקירות performance של Postgres עצמו (catalog, autovacuum על אלפי טבלאות, planner overhead); migration matrix הופך ל-bottleneck תפעולי.

### Option C: Database-per-Tenant

כל tenant מקבל database נפרדת (או cluster נפרד ב-enterprise). השרת מנתב כל בקשה ל-connection pool של ה-DB המתאימה לפי ה-tenant ב-JWT.

- **Pros:** isolation מקסימלי (גם performance וגם security); restore/backup פר-tenant ב-`pg_dump` אחד; deletion של tenant = `DROP DATABASE`; הכי קל לעבור ל-BYOC/on-prem בעתיד עם אותו קוד אפליקציה.
- **Cons:** ב-Supabase free/pro לא מעשי — אין API ליצירת DBs דינמית; cluster-per-tenant יקר פי 50-200 ב-1000 tenants; cross-tenant analytics דורש ETL חיצוני (ClickHouse/BigQuery); migration matrix גרוע יותר מ-Option B (כל DB עם connection pool נפרד); onboarding לוקח דקות במקום שניות; AI agents שעובדים על שני tenants (למשל benchmark agent) דורשים cross-DB אורקסטרציה.
- **Risk:** עלות תפעולית שעוצרת growth — לא נוכל להציע tier בחינם או מחיר נמוך כי כל tenant הוא overhead קבוע. סותר את D2 ("free tier = 0 ש"ח/חודש עד שיש לקוחות").

## Trade-offs

| Criterion | Option A (RLS) | Option B (Schema-per-Tenant) | Option C (DB-per-Tenant) |
|---|---|---|---|
| Tenant isolation strength | ⚠️ logical (RLS) | ✅ schema boundary | ✅✅ physical |
| Performance at 1000 tenants | ✅ index per `tenant_id` | ❌ catalog/planner pressure | ⚠️ depends on infra cost |
| Customization Agent compatibility | ⚠️ דורש convention משותף + מטא-טבלת fields | ✅ ALTER על schema אחד, נקי | ✅ אבל overhead תפעולי |
| Backup / restore granularity | ❌ logical extraction בלבד | ✅ `pg_dump --schema` | ✅✅ `pg_dump` per DB |
| Onboarding new tenant | ✅✅ INSERT row | ⚠️ CREATE SCHEMA + N migrations | ❌ provision DB (דקות) |
| Cross-tenant analytics (own metrics) | ✅ super-admin bypass | ❌ UNION ALL × N | ❌ ETL חיצוני |
| Supabase compatibility | ✅✅ native (`auth.uid()`, RLS) | ⚠️ אפשר אבל לא הדרך הסטנדרטית | ❌ לא מעשי ב-Supabase |
| Cost at MVP scale (1-50) | ✅✅ free tier מספיק | ✅ אותו cluster | ❌ פי 50 יקר |
| Cost at year-2 (200-1000) | ✅ cluster יחיד מספיק (Pro/Team) | ⚠️ אותו cluster אבל catalog overhead | ❌ פי 200 יקר |
| Migration safety (Customization Agent) | ⚠️ migration אחת = blast radius רחב | ✅ migration לכל tenant מבודד | ✅ migration לכל tenant מבודד |
| AI agent context propagation | ✅✅ `SET LOCAL` ב-session | ⚠️ search_path בכל transaction | ⚠️ חיבור שונה לכל tenant |

## Decision

**Option A — Row-Level Security (RLS) על schema משותף.**

הבחירה מעוגנת בארבעה גורמים. **ראשית**, D2 (cloud-only על Vercel + Supabase) הופך את Option A ל-default היחיד שמשתלב מלא עם ה-platform — RLS הוא הפנים של Supabase והאמון ב-`auth.uid()` ברמת ה-DB מסיר שכבת middleware שצריך לתחזק. **שנית**, המעבר מ-1-50 ל-200-1000 tenants הוא בדיוק ה-scale שבו Option B מתחיל להיתקל בכאבי catalog ב-Postgres; אנחנו נכנסים לבעיה תפעולית בדיוק כשהעסק מתחיל לצמוח. **שלישית**, AI agents המבצעים queries בשם משתמש מקבלים isolation "חינם" — `SET LOCAL app.current_tenant` ב-session beginning ואז כל query, גם זה ש-LLM כתב, מסונן אוטומטית; ב-Option B צריך לסמוך על search_path בכל transaction. **רביעית**, Customization Agent יכול לחיות עם RLS בעזרת convention: כל טבלה חדשה חייבת `tenant_id` + policy סטנדרטי, ושדות מותאמים נשמרים ב-`tenant_custom_fields` (EAV) או בטבלאות `tenant_<id>_<entity>_ext` עם RLS — לא נדרש schema-per-tenant בשביל זה. **המקרה שבו ההמלצה תהיה שגויה:** אם נמצא ש-Customization Agent דורש שינויים מבניים עמוקים ב-schema (למשל indexes שונים לכל tenant, או partitioning per tenant) — נחזור לשקול Option B כ-hybrid (core ב-RLS, customizations ב-schema-per-tenant).

## Consequences

- **חיובי:**
  - Onboarding tenant = `INSERT INTO tenants` + יצירת admin user. שניות, לא דקות.
  - Migration אחת מתפרסת על כל ה-tenants ב-DDL יחיד. אין migration matrix.
  - Cross-tenant analytics (KPIs פנימיים של SUPER-MESHINE עצמה — count tenants, MRR, agent action volume) באמצעות role `super_admin` שעוקף RLS — query רגיל.
  - Supabase auth + RLS = stack מינימלי. פחות שכבות = פחות bugs.
  - AI agents מקבלים tenant scoping ב-DB layer — גם prompt injection שמנסה לכתוב query ל-tenant אחר ייעצר.

- **שלילי / חוב טכני:**
  - Per-tenant restore דורש logical extraction (כתיבת job שעושה `COPY` מסונן). לא קיים out-of-the-box.
  - "Noisy neighbor": tenant גדול עם query כבדה יכול להאט אחרים. הפחתה: pg `statement_timeout` ו-monitoring per-tenant.
  - חובה לכפות RLS על **כל** טבלה חדשה — bug בפיתוח (שכחו `ENABLE ROW LEVEL SECURITY`) = leak. דורש lint וכלי בדיקה אוטומטיים (ראה Implementation Notes).
  - Custom fields של Customization Agent חיים ב-EAV או JSONB — שאילתות מותאמות פחות זריזות מ-native columns. סביר ב-MVP, יש לבחון מחדש ב-scale.
  - Index bloat: כל index חייב להתחיל ב-`tenant_id` אחרת queries מסרבות לבחור אותו אחרי RLS rewrite.

- **השפעה על מודולים אחרים:**
  - **Schema/Drizzle:** כל טבלה ש-belongs-to-tenant חייבת `tenant_id uuid not null references tenants(id)` ו-helper שמייצר את ה-RLS policy.
  - **tRPC layer:** כל procedure פותחת transaction עם `SET LOCAL app.current_tenant`. Middleware אחד ב-`createContext`.
  - **Customization Agent:** מקבל convention ברור — אסור ליצור טבלה בלי `tenant_id` ו-RLS; אסור להוסיף עמודה בלי לוודא שאין index שמפר את ה-prefix rule.
  - **Audit log:** עצמו טבלה עם `tenant_id` ו-RLS — לא יהיה global audit חוצה-tenants.
  - **Process Agents (workflow engine):** Temporal worker שרץ עבור tenant חייב לפתוח DB session עם ה-tenant context לפני כל activity שנוגעת ב-DB.

## Reversal Conditions

נחזור ל-ADR הזה ולשקול שינוי אם:

- **רגולציה דורשת isolation פיזי** (לקוח אנטרפרייז שמחויב ב-data residency/HIPAA/חוק נתונים — בעיקר חברות תרופות, ביטחון, רפואה). אז: hybrid — Option A ל-tenants רגילים, Option C ל-tenants שמשלמים tier ייעודי.
- **Customization Agent דורש שינויים מבניים** מעבר להוספת עמודות (למשל indexes שונים לכל tenant, partitioning, או triggers שונים) — אז Option B כ-hybrid.
- **Performance מתדרדר** ב-tenant יחיד גדול שמשפיע על השאר באופן שלא ניתן להפחית עם `statement_timeout`/connection pooling — אז migration של ה-tenant הספציפי ל-DB נפרדת (Option C מקומי).
- **Customer count חורג מ-5,000** ב-cluster יחיד — Postgres עצמו מתחיל להיתקל בגבולות; שקול sharding לפי tenant_id range.
- **דליפה אמיתית בין tenants התרחשה** דרך bug ב-RLS policy — אירוע security שמחייב reassessment של isolation strength.

## Implementation Notes

נקודות שה-builder הראשון של ה-DB layer (backend-builder) חייב ליישם. קונקרטי, לא קוד:

1. **Bootstrap migration `0001_multi_tenancy_foundation`:**
   - יוצר `tenants` (id uuid PK, slug text unique, created_at, status), `users` (id uuid PK, tenant_id FK, email, role), ו-`audit_log` (כולל `tenant_id`).
   - מגדיר Postgres role-ים: `app_user` (default; כפוף ל-RLS), `app_admin` (super-admin פנימי של SUPER-MESHINE; `BYPASSRLS`).
   - מגדיר GUC: `app.current_tenant` (text). Default: NULL → policies יחזרו 0 rows = fail-safe.

2. **RLS convention שכל טבלת-tenant חייבת לציית לה:**
   ```
   CREATE TABLE foo (
     id uuid primary key default gen_random_uuid(),
     tenant_id uuid not null references tenants(id) on delete restrict,
     ...
   );
   ALTER TABLE foo ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON foo
     USING (tenant_id::text = current_setting('app.current_tenant', true));
   ```
   צור Drizzle helper (`tenantTable(name, columns)`) שמייצר את שלוש הפעולות יחד. אסור לכתוב טבלה ידנית בלי ההלפר.

3. **CI lint:** הוסף בדיקה ב-CI שמריצה query מטא:
   ```sql
   SELECT c.relname FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
   WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
     AND c.relname NOT IN ('tenants', 'users', '_drizzle_migrations', ...);
   ```
   אם מחזיר שורות — build fail. הרשימה ה-whitelist מוגדרת מפורשות.

4. **tRPC context middleware (`createContext`):**
   - מאמת JWT (Supabase auth), שולף `tenant_id` מה-claims.
   - פותח Drizzle transaction; מריץ `SET LOCAL app.current_tenant = '<tenant_id>'`.
   - מעביר את ה-`tx` לכל procedure. בלי `tx`, בלי DB access — זה לא עוקף לפי שכחה.

5. **Index rule:** כל index על טבלת-tenant חייב להתחיל ב-`tenant_id` (composite). Drizzle helper יכפה את זה. בלי זה, Postgres אחרי RLS rewrite יבחר seq scan ב-tables גדולות.

6. **Customization Agent guardrails:**
   - הסוכן יכול להוסיף טבלאות/עמודות **רק** דרך migration שעוברת דרך ה-helper של סעיף 2.
   - שדות מותאמים ב-MVP נשמרים ב-`tenant_custom_field_defs` (definition) + עמודת `custom_fields jsonb` בטבלת ה-entity הרלוונטית, עם `tenant_id` ו-RLS על שתיהן.
   - אסור לסוכן ליצור Postgres role או policy חדשה — רק migrations של DDL טבלאות + indexes.

7. **AI agent (Process Agent / Copilot) DB access:**
   - כל agent run פותח session/transaction דרך service layer שמחיל `SET LOCAL app.current_tenant` לפי ה-context של ה-run.
   - אסור לסוכן לקבל connection ישיר ל-DB. כל DB access דרך MCP server פנימי או tRPC procedure שמחיל את המידלוור.

8. **Backup/restore strategy:**
   - Daily Supabase snapshot של ה-cluster כולה (ברירת מחדל ב-Pro tier).
   - בנוסף: nightly logical export per-tenant (`COPY (SELECT ... WHERE tenant_id = $1) TO ...`) ל-S3-compatible. נדרש מ-Day 1 עבור tenant-level restore או GDPR/erasure requests.
   - Documentation של restore procedure לפני production launch.

9. **Pooler caveat (Supabase Supavisor):** ב-transaction mode, `SET LOCAL` עובד נכון (scope = transaction). ב-session mode זה מסוכן (state ידלוף בין tenants דרך connection reuse). חובה: transaction mode לכל ה-app traffic. ל-jobs ארוכים (Temporal workers) — direct connection מחוץ ל-pooler עם הקפדה על reset בין runs.

10. **Monitoring:**
    - מטריקה per-`tenant_id` של query latency ו-row counts (PostHog event ב-tRPC middleware).
    - alert על kernel events של RLS policy failures ב-pg logs.
    - super_admin role מוגן: רק ל-DB credentials של service account ייעודי, לא ל-app traffic רגיל.

11. **טבלאות גלובליות (לא tenant-scoped) — רשימה סגורה:**
    - `tenants`, `users` (ה-PII קשור ל-tenant אבל ה-row עצמו global), `auth.*` (Supabase), `_drizzle_migrations`, `feature_flags` (global), `system_audit` (פעולות super-admin).
    - כל הוספה לרשימה דורשת ADR חדש או עדכון של ADR-002.
