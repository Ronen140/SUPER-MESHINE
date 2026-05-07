# ADR 005: Authentication, Authorization (RBAC) & Agent Actor Model

**Date:** 2026-05-07
**Status:** Proposed
**Decider:** Architect (proposed), CEO (final approval)

## Context

SUPER-MESHINE היא ERP B2B multi-tenant הרץ cloud-only על Vercel + Supabase (לפי D2), עם isolation דרך RLS על schema משותף (לפי ADR-002), ועם stack של TypeScript + Next.js + tRPC (לפי ADR-003). שלוש דרישות חוצות-מודולים מאלצות החלטה אחת מאוחדת על שכבת ה-auth: (א) tRPC context middleware ב-ADR-002 כבר חייב לדעת מי המשתמש ולאיזה tenant הוא שייך כדי להריץ `SET LOCAL app.current_tenant` — בלי החלטת auth מעוגנת, ה-builder הראשון של ה-DB layer חסום; (ב) **AI agents** (Process Agents, Copilot) מבצעים פעולות בשם משתמשים ולפי architecture invariant #2 חייבים להיות attributable ב-audit log; (ג) architecture invariant #3 מחייב **human approval gates** מעל סף — סף זה חייב להיות חלק מ-RBAC ולא bolt-on. הרגליים העסקיות של ERP (admin, manager, accountant, warehouse, sales, auditor) ידועות מ-discovery; השאלה היא איך לקודד אותן בצורה שתשרוד customization (ADR-002 §6) ושתתאים ל-agent actor model.

## Options Considered

### Option A: Supabase Auth + JWT (httpOnly) + Role Enum + Permissions Lookup + Agent Service Accounts

Authentication: Supabase Auth עם email+password (MVP) ו-Google OAuth כ-second method. Session: access token JWT 15 דק' + refresh token 30 יום ב-httpOnly + Secure + SameSite=Lax cookie; logout מבטל refresh ב-Supabase server. ה-`auth.uid()` ב-JWT משולב native ב-RLS policies של ADR-002. User → Tenant: יחס יחיד ב-MVP (`users.tenant_id` not null), עם `tenant_id` ב-JWT custom claim שנקרא ב-tRPC middleware ל-`SET LOCAL app.current_tenant`. RBAC: 6 roles מובנים (`admin`, `manager`, `accountant`, `warehouse_lead`, `salesperson`, `viewer`) כ-Postgres ENUM, עם טבלת `permissions(role, resource, action)` כ-lookup ב-`tenant_id IS NULL` (global) + override per-tenant ב-`tenant_role_permissions`. Agents: כל agent הוא service account עם `actor_type='agent'` ו-`agent_name`; פועל דרך tRPC procedure ייעודית שלוקחת `on_behalf_of` user_id. Approval gates: טבלת `approval_policies(tenant_id, action, threshold_field, threshold_value)` + `approval_requests(...)`.

- **Pros:** native לכל ה-stack — Supabase Auth כבר מטופל ב-RLS דרך `auth.uid()`, אין middleware חיצוני; JWT custom claim ל-`tenant_id` מאפשר ל-Postgres לאמת ישירות; role enum + permission table = פשוט ל-MVP אבל ניתן להרחיב לקסטומיזציה (Customization Agent יכול להוסיף permission rows); service account נפרד לכל agent מבטיח attribution מובחן ב-audit; approval threshold כ-data ולא קוד = ניתן לעריכה דרך UI per-tenant.
- **Cons:** Supabase Auth מגביל בכמה features (אין native MFA enforcement פר-tenant ב-tier הבסיסי; webhooks ל-user lifecycle דורשים Edge Functions); ENUM של roles דורש migration כדי להוסיף role חדש (Customization Agent לא יכול להוסיף role חדש בלי DDL); two tables ל-permissions (global + per-tenant override) = שתי queries או JOIN בכל בקשה.
- **Risk:** vendor lock-in ל-Supabase Auth — מעבר עתידי ל-Auth0/Clerk/Cognito ידרוש re-keying של כל ה-users + עדכון כל RLS policy שמשתמשת ב-`auth.uid()`. הפחתה: שכבת abstraction דקה בקוד (`getCurrentUser()`) שמסתירה את המקור.

### Option B: Auth0/Clerk Hosted + JWT עם Custom Claims + CASL/Permit.io ל-RBAC

Authentication: Auth0 או Clerk כ-IdP חיצוני, מנפיק JWT עם custom claims (`tenant_id`, `role`). RBAC: ספרייה ייעודית כמו CASL (TypeScript) או Permit.io (managed) שמגדירה policies כ-code/data במקום טבלאות. Multi-tenancy: organizations של Clerk/Auth0 ממופים ל-`tenants`. Agents: ייצוג כ-machine-to-machine clients ב-Auth0 (M2M tokens).

- **Pros:** features עשירים (MFA, SSO, magic link, passwordless, social login כל אחד) out-of-the-box; CASL מאפשר policy-as-code שעובד גם client-side (UI hides buttons); ניתן להחליף backend בעתיד בלי לאבד את ה-IdP; M2M tokens של Auth0 הם standard לסוכנים.
- **Cons:** 50-300$/חודש ב-tier מינימלי (Clerk free עד 10K MAU אבל features מוגבלים) — סותר את D2 ("free tier 0 ש"ח עד שיש לקוחות"); הרבה יותר surface area ל-prompt injection דרך claims שלא נשלטים מהמערכת; integration עם RLS דורש שכבת תרגום (`auth.uid()` → JWT subject → user row); אין native ל-Supabase ולכן כל login flow דורש webhook + sync user records; CASL טוב ל-UI אבל לא אוכף ב-DB layer — צריך להמציא duplicate enforcement.
- **Risk:** שתי source-of-truth ל-identity (Clerk + DB users table) → bugs של drift; cost שיכול לקפוץ פתאום ב-scale (Auth0 לפי MAU); אם ה-IdP נופל — כל המוצר נופל.

### Option C: Custom JWT + Database Sessions + ACL Table

Authentication: לא להסתמך על Supabase Auth, לכתוב מימוש משלנו — bcrypt על passwords, JWT שמונפק מ-Next.js API route, sessions table ב-DB. RBAC: ACL גמיש לחלוטין — `permissions(subject_type, subject_id, resource_type, resource_id, action, effect)` עם wildcard ו-inheritance.

- **Pros:** שליטה מלאה — אפשר להוסיף MFA, role hierarchy, row-level permissions בלי תלות ב-vendor; ACL גנרי תומך גם ב-future row-level (e.g., "salesperson X can see customer Y") בלי שינוי schema.
- **Cons:** בנייה עצמית של auth = תקלות security ידועות (timing attacks, password storage, token rotation, session invalidation, CSRF) — עוצרים את ה-MVP בשלושה חודשים; ACL גנרי הוא overkill ל-MVP ועלול להאט כל בקשה (recursive lookups); אין integration native עם RLS — צריך לכתוב custom GUC injection מתוך JWT validation; כל tenant onboarding דורש user creation flow שלם שאנחנו כותבים.
- **Risk:** vulnerability ב-auth שלנו = אסון; זמן בנייה = 4-6 שבועות לפני ה-feature הראשון של ERP. סותר את "speed to MVP" של D1.

## Trade-offs

| Criterion | Option A (Supabase + Enum + Lookup) | Option B (Auth0/Clerk + CASL) | Option C (Custom JWT + ACL) |
|---|---|---|---|
| Time to MVP | ✅✅ ימים | ⚠️ שבוע-שבועיים integration | ❌ 4-6 שבועות |
| Cost at MVP scale | ✅✅ free tier מספיק | ❌ 50-300$/חודש מהיום הראשון | ✅ 0$ (אבל time-cost) |
| Cost at year-2 (1000 tenants) | ✅ scales עם Supabase tier | ❌ MAU billing יקפוץ | ✅ עלות תפעול בלבד |
| RLS integration (ADR-002) | ✅✅ native (`auth.uid()`) | ⚠️ דורש sync layer | ⚠️ דורש GUC injection ידני |
| Security risk surface | ✅ Supabase מתוחזק | ✅ vendor mature | ❌ self-rolled = bugs |
| MFA / SSO future | ⚠️ tier-dependent ב-Supabase | ✅✅ out-of-the-box | ❌ נכתוב לבד |
| Customization Agent ל-roles | ⚠️ enum = DDL נדרש; permissions = INSERT | ✅ CASL policies = data | ✅ ACL = data בלבד |
| Agent actor attribution | ✅ service account row | ✅ M2M client | ✅ ACL row |
| Approval gate flexibility | ✅ data-driven | ✅ data-driven | ✅ data-driven |
| Vendor lock-in | ⚠️ Supabase Auth | ⚠️ Auth0/Clerk | ✅ אין |
| Operational complexity | ✅✅ stack אחד | ❌ שני vendors + sync | ❌ הכל לבד |

## Decision

**Option A — Supabase Auth + JWT (httpOnly) + Role Enum + Permissions Lookup + Agent Service Accounts.**

הבחירה מעוגנת בארבעה גורמים. **ראשית**, ADR-002 כבר נעל אותנו ל-Supabase ול-RLS native דרך `auth.uid()` — Option B/C ידרשו לבנות שכבת תרגום בין IdP חיצוני לבין `auth.uid()` ב-DB, וזה duplicate source-of-truth שגורם ל-drift bugs. **שנית**, D2 ("free tier 0 ש"ח") שולל את Option B מהיום הראשון, ו-D1 ("speed to MVP") שולל את Option C. **שלישית**, ה-MVP צריך 6 roles ידועים, לא ACL גנרי — over-engineering ב-RBAC עכשיו זה זמן שמופחת מ-features של ERP. נתחיל עם enum + lookup, נעבור ל-row-level permissions רק כשיש לקוח שדורש זאת. **רביעית**, Customization Agent לא צריך ליצור roles חדשים ב-MVP — הצרכים שעולים מ-discovery הם להוסיף **שדות** ו-**workflow steps**, לא **role taxonomies**; כשיגיע הצורך, נוסיף `tenant_custom_roles` table בלי להחליף את ה-enum הבסיסי. **המקרה שבו ההמלצה תהיה שגויה:** אם לקוח אנטרפרייז דורש SSO/SAML או custom roles per-tenant ב-MVP — נשקול hybrid (Supabase Auth ל-tenants רגילים, Auth0 ל-enterprise tier), או נעבור ל-Clerk אם זה הופך לדרישה אוניברסלית.

## Consequences

- **חיובי:**
  - JWT custom claim (`tenant_id`, `role`) נקרא ב-tRPC middleware של ADR-002 → `SET LOCAL app.current_tenant` עובד מהיום הראשון.
  - `auth.uid()` זמין ב-RLS policies → policy שמסתמך גם על user_id (לא רק tenant_id) הוא חינם, בלי middleware נוסף.
  - Onboarding משתמש = `supabase.auth.admin.createUser()` + INSERT ב-`users` עם `tenant_id` + role default. שניות.
  - Audit log אחיד: `actor_type` ENUM (`'user' | 'agent' | 'system'`), `actor_id`, `on_behalf_of` — agent actions נראות בדיוק כמו user actions עם metadata נוסף.
  - Approval threshold כ-data ב-`approval_policies` → Customization Agent יכול לערוך thresholds per-tenant בלי deployment.

- **שלילי / חוב טכני:**
  - Vendor lock-in ל-Supabase Auth — מעבר עתידי = re-keying של users + שינוי כל RLS policy. הפחתה: `lib/auth.ts` היחיד שמייבא `@supabase/auth-helpers` — שאר הקוד עובר דרכו.
  - הוספת role חדש = migration (ENUM ALTER). לא דרמטי אבל לא data-driven. אם זה הופך לחיכוך — נעבור ל-`roles` table.
  - חסר native MFA ב-Supabase free tier (קיים ב-Pro). MVP יחיה בלי MFA enforcement; admin role יחויב MFA דרך Supabase Pro לפני production launch.
  - JWT 15 דק' = רענון תכוף; חוויה רעה אם הרשת כושלת בדיוק ברגע הרענון. הפחתה: refresh ב-`onIdle` של ה-Supabase JS client.
  - Approval queue = UI נוסף שצריך לבנות ב-MVP (לא ניתן לדחות — invariant #3 מחייב).

- **השפעה על מודולים אחרים:**
  - **Schema:** טבלאות `users`, `roles` (enum), `permissions`, `tenant_role_permissions`, `agent_accounts`, `approval_policies`, `approval_requests`, `audit_log` (כבר ב-ADR-002, מקבל `actor_type` + `on_behalf_of`).
  - **tRPC layer:** `createContext` קורא `tenant_id` + `role` מה-JWT, מחיל ב-GUC, מעביר `user`/`agent` actor ל-procedures. Procedure שדורשת approval מחזירה `{ status: 'pending_approval', request_id }` במקום result.
  - **AI agents:** כל agent run פועל דרך service account עם `agent_name` (e.g., `procurement-agent`), מקבל user `on_behalf_of` מה-trigger context. אסור ל-agent לקבל `app_admin` role; כולם `app_user` + role-ים מוגבלים.
  - **Customization Agent:** יכול להוסיף permission rows ב-`tenant_role_permissions` + ליצור `approval_policies` per-tenant. **לא יכול** לערוך את ה-roles enum (DDL forbidden).
  - **Audit log (invariant #2):** כל פעולה כותבת `(tenant_id, actor_type, actor_id, on_behalf_of, action, resource_type, resource_id, policy_id, outcome, occurred_at)`.
  - **Frontend:** UI של approval queue (manager view), UI ניהול roles+permissions (admin view), UI ניהול thresholds (admin view).

## Reversal Conditions

נחזור ל-ADR הזה ולשקול שינוי אם:

- **לקוח אנטרפרייז דורש SAML/SSO/SCIM** ב-MVP או רגע אחרי — Supabase Auth לא תומך טוב ב-tier הבסיסי. אז: hybrid עם Auth0 לטיירים גבוהים, או מעבר מלא ל-Clerk Organizations.
- **דרישה לקסטומיזציה של roles per-tenant** עולה מיותר מ-2 לקוחות ראשונים — נוסיף `tenant_custom_roles` table ונפסיק להשתמש ב-ENUM כיחיד source.
- **Same user belongs to multiple tenants** הופך לדרישה (consultants/MSPs) — נשנה את הקשר מ-`users.tenant_id` ל-`tenant_memberships(user_id, tenant_id, role)` עם `tenant_id` נשלף מ-context (header/path) ולא מ-JWT. זה שינוי schema גדול אבל RLS פוליסי לא משתנה.
- **דליפה דרך JWT** התרחשה (replay attack, token theft) — נשקול introspection mode (DB session validation per request), קצור access token ל-5 דק', או move ל-PASETO.
- **MFA enforcement** הופך לדרישת רגולציה (חוק נתונים, SOC2) ולא מספיק עם Supabase Pro — נעבור ל-IdP חיצוני.
- **Approval queue scale** עולה מעל 100 בקשות פתוחות בו-זמנית per-tenant — נשקול workflow engine (Temporal) במקום DB-only queue.
- **Vendor lock-in pain** — אם Supabase מעלה מחירים דרמטית או דועך, ה-abstraction ב-`lib/auth.ts` חייב להחליף ב-IdP אחר תוך שבוע; זה ה-test.

## Implementation Notes

נקודות שה-builder הראשון של auth layer (backend-builder) חייב ליישם. קונקרטי, לא קוד מוצר אלא חוזים:

### 1. Schema (Drizzle / SQL)

```ts
// roles enum — DDL נדרש כדי להוסיף role
export const roleEnum = pgEnum('role', [
  'admin', 'manager', 'accountant', 'warehouse_lead', 'salesperson', 'viewer'
]);

export const actorTypeEnum = pgEnum('actor_type', ['user', 'agent', 'system']);

// users — טבלה גלובלית (לא tenant-scoped row-wise; tenant_id הוא FK)
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // == auth.users.id ב-Supabase
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' }),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull().default('viewer'),
  isActive: boolean('is_active').notNull().default(true),
  mfaEnrolled: boolean('mfa_enrolled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// permissions (global default per-role) — seeded, לא נערך per-tenant ישירות
export const permissions = pgTable('permissions', {
  role: roleEnum('role').notNull(),
  resource: text('resource').notNull(), // 'item' | 'purchase_order' | 'invoice' | ...
  action: text('action').notNull(),     // 'read' | 'write' | 'approve' | 'delete'
  // PK = (role, resource, action)
});

// tenant_role_permissions — override per-tenant (Customization Agent כותבת לכאן)
export const tenantRolePermissions = tenantTable('tenant_role_permissions', {
  role: roleEnum('role').notNull(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  granted: boolean('granted').notNull(), // override default — true=add, false=revoke
});

// agent_accounts — service accounts לסוכנים, scoped ל-tenant
export const agentAccounts = tenantTable('agent_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentName: text('agent_name').notNull(), // 'procurement-agent', 'reconciliation-agent', ...
  role: roleEnum('role').notNull(),         // role שהסוכן יורש
  isActive: boolean('is_active').notNull().default(true),
  // PK + UNIQUE(tenant_id, agent_name)
});

// approval_policies — סף אנושי per-action
export const approvalPolicies = tenantTable('approval_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),               // 'purchase_order.create'
  thresholdField: text('threshold_field'),        // 'total_amount_ils'
  thresholdValue: numeric('threshold_value'),     // 5000.00
  requiresRole: roleEnum('requires_role').notNull().default('manager'), // מי מאשר
  isActive: boolean('is_active').notNull().default(true),
});

// approval_requests — תור אישורים פתוח
export const approvalRequests = tenantTable('approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  policyId: uuid('policy_id').notNull().references(() => approvalPolicies.id),
  requestedBy: uuid('requested_by').notNull(), // agent_account.id או user.id
  requestedByType: actorTypeEnum('requested_by_type').notNull(),
  onBehalfOf: uuid('on_behalf_of'), // user.id אם agent → user
  payload: jsonb('payload').notNull(), // הנתונים שיתבצעו אם יאושר
  status: text('status').notNull().default('pending'), // pending | approved | rejected | expired
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// audit_log — מעודכן מ-ADR-002 לכלול actor model
export const auditLog = tenantTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: actorTypeEnum('actor_type').notNull(),
  actorId: uuid('actor_id').notNull(),
  onBehalfOf: uuid('on_behalf_of'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  policyId: uuid('policy_id'), // ה-approval_policy שהותר תחתיה (אם יש)
  outcome: text('outcome').notNull(), // 'success' | 'denied' | 'pending_approval'
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 2. Zod schemas (tRPC inputs/outputs)

```ts
export const RoleSchema = z.enum([
  'admin', 'manager', 'accountant', 'warehouse_lead', 'salesperson', 'viewer'
]);

export const ActorTypeSchema = z.enum(['user', 'agent', 'system']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: RoleSchema,
  isActive: z.boolean(),
  mfaEnrolled: z.boolean(),
});

export const ActorSchema = z.object({
  type: ActorTypeSchema,
  id: z.string().uuid(),
  onBehalfOf: z.string().uuid().optional(),
});

export const PermissionSchema = z.object({
  role: RoleSchema,
  resource: z.string().min(1),
  action: z.enum(['read', 'write', 'approve', 'delete']),
});

export const AgentActionSchema = z.object({
  tenantId: z.string().uuid(),
  agentName: z.string(),
  onBehalfOf: z.string().uuid(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().uuid().optional(),
  payload: z.record(z.unknown()),
});

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  policyId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  requestedByType: ActorTypeSchema,
  onBehalfOf: z.string().uuid().optional(),
  payload: z.record(z.unknown()),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  expiresAt: z.string().datetime(),
});

export const ApprovalPolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  action: z.string(),
  thresholdField: z.string().nullable(),
  thresholdValue: z.number().nullable(),
  requiresRole: RoleSchema,
  isActive: z.boolean(),
});
```

### 3. Default permissions seed (MVP starting point)

| Role | items | purchase_orders | invoices | journal_entries | users | reports |
|---|---|---|---|---|---|---|
| admin | * | * | * | * | * | * |
| manager | r/w | r/w/approve | r/w/approve | r | r | r |
| accountant | r | r | r/w | r/w | - | r |
| warehouse_lead | r/w | r | - | - | - | r (inventory) |
| salesperson | r | r (own) | r/w (own) | - | - | r (own pipeline) |
| viewer | r | r | r | r | - | r |

ה-builder יזרע את `permissions` table מהטבלה הזו ב-migration `0002_auth_seed`. row-level scoping ("own") הוא **future** — ב-MVP, salesperson רואה הכל ברמת ה-tenant.

### 4. Session & cookie config

- Access token: Supabase JWT, 15 דק' lifetime. Refresh token: 30 יום.
- שמירה: refresh token ב-cookie `sb-refresh-token` עם `HttpOnly; Secure; SameSite=Lax; Path=/`. Access token ב-memory בלבד (Supabase JS client default).
- Logout: `supabase.auth.signOut()` → השרת מנפיק revocation; כל JWT עם `session_id` הזה ייכשל בבדיקה הבאה (Supabase מתחזק blocklist).
- CSRF: SameSite=Lax מספיק ל-tRPC (POST-only mutations); אין double-submit cookie ב-MVP.

### 5. tRPC middleware (auth flow)

ב-`createContext`:
1. שליפת `Authorization: Bearer <jwt>` מה-headers, או refresh דרך cookie אם access token פג.
2. Verify JWT דרך Supabase SDK → `auth.uid()`, `tenant_id` (custom claim), `role`.
3. שליפת `users` row לוודא `is_active=true`.
4. פתיחת DB transaction → `SET LOCAL app.current_tenant = '<tenant_id>'` (כפי שמוגדר ב-ADR-002).
5. הגדרת `ctx.actor = { type: 'user', id: user.id }`.
6. בכל procedure: בדיקת permission לפי `(role, resource, action)` ב-`permissions` UNION `tenant_role_permissions`. Permission denied → throw `TRPCError({ code: 'FORBIDDEN' })`.

### 6. Agent flow (separate procedure family)

- Agent run יזום מ-trigger (cron/webhook/UI button). ה-trigger מצרף `(agent_name, tenant_id, on_behalf_of_user_id)`.
- Procedure ייעודית `agentRun` מוודאת שה-agent קיים ב-`agent_accounts`, פותחת context עם `actor = { type: 'agent', id: agent_account.id, onBehalfOf: user_id }`, `SET LOCAL app.current_tenant`.
- כל פעולה של ה-agent עוברת permission check לפי `agent_account.role`. Agent עם role `viewer` יכול רק לקרוא.
- **לפני ביצוע**: בדיקה ב-`approval_policies` לפי `(tenant_id, action)`. אם הסף נחצה → INSERT ל-`approval_requests` עם status `pending`, החזרה לקורא: `{ status: 'pending_approval', request_id }`. ה-agent **לא מבצע** את הפעולה כעת.
- **אחרי אישור human (manager)** דרך UI → trigger procedure `approveRequest` → ביצוע ה-action המקורי + audit log entry עם `policy_id` של ה-policy שמכוון.

### 7. Audit log invariant

כל mutation procedure (user או agent) חייב לכתוב `audit_log` row לפני commit. Helper `withAudit(tx, actor, action, resource, fn)` שעוטף את הקריאה. בלי helper, build fail (lint).

### 8. Secrets management

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` ב-Vercel env (public).
- `SUPABASE_SERVICE_ROLE_KEY` ב-Vercel env server-side בלבד (`encrypted`); משמש רק ב-Edge Functions / Next.js server-side ל-admin operations.
- `ANTHROPIC_API_KEY` ב-Vercel env server-side. Rotation: כל 90 יום, ידני. ב-MVP — מפתח אחד גלובלי. **לא** per-tenant API keys ב-MVP (כל ה-AI usage מבוקר דרך rate limits per-tenant ב-app layer).
- אסור secrets ב-DB. אסור secrets ב-client bundles. גלאי ב-CI (`gitleaks`).

### 9. MFA roadmap

- MVP: לא אכוף.
- לפני production launch (לקוח משלם ראשון): admin role חייב MFA (Supabase Pro tier).
- Year 2: enforcement per-tenant (admin של tenant יכול להחיל MFA על כל ה-users שלו).

### 10. Customization Agent guardrails (auth-specific)

- אסור ALTER על `role` enum.
- אסור CREATE על `permissions` (global table).
- מותר INSERT/UPDATE/DELETE על `tenant_role_permissions` (per-tenant override) במגבלת ה-tenant שלה.
- מותר INSERT/UPDATE על `approval_policies` של ה-tenant.
- אסור גישה ל-`agent_accounts` של tenants אחרים (RLS אוכף).
- כל שינוי כותב ל-`audit_log` עם `actor_type='agent'` ו-`agent_name='customization-agent'`.
