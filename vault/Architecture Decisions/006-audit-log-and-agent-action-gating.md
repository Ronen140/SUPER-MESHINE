# ADR 006: Audit Log Architecture & Agent Action Gating

**Date:** 2026-05-07
**Status:** Proposed
**Decider:** Architect (proposed), CEO (final approval)

## Context

שני architecture invariants ב-`CLAUDE.md` תלויים בהחלטה הזו: (#2) "Audit log על כל mutation — מי, מה, מתי, מה היה לפני, מה אחרי" ו-(#3) "Agent action = transaction עם human-approval gate". כל ה-Process Agents (Procurement, Production Planner, AR, QC, Inventory, Sales Quote, Customization, Copilot) כותבים ל-DB בשם משתמשים, ולאחר מכן (Phase 2) יצטרפו Document Intelligence Agent ו-Onboarding Agent (bulk imports). הוורטיקלים של MVP — קוסמטיקה ומזון — דורשים traceability רגולטורי (FDA 21 CFR Part 11 ליצואנים ל-US, GMP, ISO 22716/22000). ADR-002 כבר קבע multi-tenancy על-בסיס RLS — כך ש-audit_log הוא רק עוד טבלה tenant-scoped, אבל המשמעות היא שכל policy ו-immutability constraint חייבים להיכתב ב-תוך גבולות ה-RLS. ההחלטה הזו קובעת איך כל mutation נרשם, איפה, ועל-ידי מי, ואיך agent שמנסה לפעול מעל threshold נחסם בצורה שאי-אפשר לעקוף.

## Options Considered

### Option A: Application-layer middleware (Drizzle) + DB triggers as defense-in-depth + dedicated `agent_action_request` gating table

Drizzle middleware עוטף כל insert/update/delete, מחשב diff של before/after, וכותב שורת `audit_log` ב-**אותו transaction** של ה-mutation. במקביל, DB triggers (per-table) שכותבים גרסה מינימלית של אותה רשומה כ-defense-in-depth שתופסת SQL ידני, jobs, או cron. Agent actions עוברים שכבת gating נפרדת: לפני שה-agent מבצע mutation הוא קורא ל-`agent_policy` table (per-tenant rules + thresholds), ואם החלטה מעל threshold — מכניס שורה ל-`agent_action_request` ב-status `pending`, מודיע למאשר, ורק אחרי approval ב-UI מבוצע ה-action בתוך transaction (שכותב גם audit_log).

- **Pros:** diff עשיר ב-application layer (יודע על relations, soft-deletes, virtual fields) שטריגרים לא יכולים להפיק; defense-in-depth של DB tigggers תופסת bypass; gating decoupled מה-mutation — אפשר להחליף UI/notification בלי לגעת ב-agent code; שתי השכבות שולחות לאותה טבלה בפורמט אחיד; משתלב יפה עם RLS של ADR-002 (audit_log עם `tenant_id`); תומך bulk imports עם path מיוחד שמייצר entry אחד לכל job (+ optional row-per-record).
- **Cons:** double-write בכל mutation — overhead של ~10-20% throughput; trigger + middleware עלולים להפיק שתי שורות אם לא מסומן (פתרון: middleware מסמן `app.audit_source = 'middleware'` ו-trigger בודק); diff חישוב ב-JS עלול לפספס changes שנעשו ב-stored procedures (ולכן ה-trigger נשאר חיוני).
- **Risk:** משתמש שנמנע מ-Drizzle (raw SQL ב-migration, או רץ דרך psql לתחזוקה) יכתוב mutation בלי audit אם ה-trigger כבוי על אותה טבלה. הפחתה: bootstrap migration שאוכף trigger לכל טבלה שיש לה `tenant_id`, + CI lint שמוודא שלכל טבלה tenant-scoped יש triger מקביל.

### Option B: DB triggers בלבד (כל ה-audit מ-Postgres)

Trigger אחיד (`audit_trigger_func`) שמופעל `AFTER INSERT/UPDATE/DELETE` על כל טבלה רלוונטית, קורא `current_setting('app.actor_id')` ו-`current_setting('app.actor_type')` שהאפליקציה מכניסה ב-`SET LOCAL` בתחילת transaction. ה-trigger עצמו כותב ל-`audit_log` עם `OLD`/`NEW` כ-jsonb. Gating נשאר באפליקציה (לא קשור ל-audit).

- **Pros:** zero-trust: שום mutation לא יכול להתחמק; פחות קוד באפליקציה; כל שינוי schema אוטומטית מנוטר אם הוסיפו לו trigger ב-migration; לא תלוי ב-ORM (יעבוד גם אם נחליף Drizzle).
- **Cons:** אין access ל-context-rich diff (Drizzle יודע מי ה-`onBehalfOf`, מה ה-policy_id שהפעיל; trigger לא); `SET LOCAL` חייב להופיע בכל transaction — שכחה שקטה; audit_log payload ב-jsonb של row שלמה גדול מאוד (אין selective fields); קשה להריץ business-logic-aware redactions (PII, secrets) ב-trigger; bulk imports יוצרים שורת audit לכל record גם אם זה לא רצוי.
- **Risk:** debug של audit שגוי דורש PL/pgSQL; כל ניסיון להוסיף smarts (compute diff של relations, חישוב delta) דורש לכתוב מחדש ב-PL/pgSQL — לא scaleable.

### Option C: Event sourcing — audit_log הוא ה-source-of-truth, ה-tables הן projections

כל mutation היא event ש-נכתב קודם ל-`event_log`, ו-`item`/`order`/`invoice` הן projections שמתעדכנות מ-events (CQRS). Agent actions גם events. Gating = events ב-status `pending_approval`.

- **Pros:** audit מובנה ב-architecture — אי-אפשר לשנות state בלי event; time-travel חינם; replay ל-debug; pattern נקי ל-agent gating (event = intent, projection = result, approval = transition).
- **Cons:** rewrite מלא של ה-data layer — Drizzle לא מותאם ל-event-sourcing out-of-the-box; eventual consistency בין event ל-projection מסבך AI agents שקוראים-וכותבים מיד; כל query הופך מורכב יותר (איפה ה-projection? עד איזה event הוא מעודכן?); MVP timeline לא תומך — זה החלטה של 6-12 חודשי refactor; reporting/analytics standard לא עובד בלי projections מוכנות מראש.
- **Risk:** בחירה ש-תיגבה את כל הצוות לשנה ב-architecture שאף אחד מהמהנדסים שלנו עוד לא הריץ ב-production. דחיית MVP ב-3+ חודשים.

## Trade-offs

| Criterion | Option A (App + Trigger + Gating) | Option B (Triggers only) | Option C (Event sourcing) |
|---|---|---|---|
| Coverage of all mutations | ✅ (defense-in-depth) | ✅ (DB-enforced) | ✅ (architectural) |
| Diff richness (on_behalf_of, policy_id) | ✅ | ❌ | ✅ |
| MVP delivery time | ✅ (אפשר ב-MVP) | ✅ | ❌ (חודשי refactor) |
| Multi-tenant safety (works with RLS of ADR-002) | ✅ | ✅ | ⚠️ (events צריכים tenant_id explicit) |
| Bulk import efficiency | ✅ (path מיוחד) | ❌ (row-per-event תמיד) | ⚠️ (events ל-thousands of records) |
| Compliance fit (FDA/GMP — immutable, queryable) | ✅ | ✅ | ✅ |
| Agent gating cleanliness | ✅ (טבלה ייעודית) | ⚠️ (decoupled, אין מבנה) | ✅ (state machine מובנה) |
| Operational complexity | ⚠️ (שתי שכבות) | ✅ (אחת) | ❌ (גבוהה) |
| Reversibility | ✅ (אפשר להוריד middleware ולהשאיר triggers) | ✅ | ❌ (rewrite) |

## Decision

**Option A — Application-layer (Drizzle middleware) + DB triggers as defense-in-depth + dedicated `agent_action_request` gating table.**

זו הבחירה הנכונה מפני שהיא היחידה שמספקת את שלושת ההיבטים שצריך MVP: (1) רישום מלא של *מי* פעל (כולל `on_behalf_of_user_id` ו-`policy_id` שטריגר לא יודע); (2) safety net כש-agent או cron כותב ב-raw SQL — ה-trigger יתפוס; (3) gating נפרד שלא מערב את ה-audit עם business logic של approval flows. Option B מאבד את ה-context העשיר שצריך לחשבונאות ול-Copilot ("איזה policy הפעיל את הסוכן הזה?"), ו-Option C היא decision של חברה בוגרת — לא של MVP. ה-overhead של 10-20% throughput הוא מחיר שווה ל-immutable trail שעומד ב-21 CFR Part 11. נחזור להחלטה הזו אם נגיע ל-scale שבו ה-audit_log עצמה הופכת ל-bottleneck (>100M rows per tenant) או אם נחליט להחליף את Drizzle.

## Consequences

- **חיובי:** כל mutation — בין אם משתמש, agent, או system process — מתועד עם before/after; agent action שמעל threshold לא יכול להתבצע בלי approval (architecturally enforced, לא רק convention); compliance audits (FDA, GMP) ניתנות לייצוא ב-endpoint אחד; Copilot יכול לענות על "מי שינה את המחיר של פריט X ב-3 חודשים האחרונים" בלי שאילתה מורכבת; bulk imports לא מציפים את ה-log.
- **שלילי / חוב טכני:** double-write overhead (~10-20% on writes); כל טבלה חדשה דורשת trigger נוסף — bootstrap migration + CI lint; jsonb diffs יכולים לתפוח (PII redaction דורש מנגנון מפורש); `agent_action_request` הופך ל-state ש-agent חייב לעקוב אחריו (polling או notify); retention policy מצריך partitioning מתישהו.
- **השפעה על מודולים אחרים:**
  - **Process Agents (כולם):** חייבים לקרוא ל-`agent_policy` לפני כל mutation, וב-action מעל threshold להכניס `agent_action_request` במקום לבצע.
  - **Customization Agent (ADR עתידי):** schema changes שלו עצמם מתועדים ב-audit_log (resource_type=`schema`); כל טבלה חדשה שהוא יוצר חייבת לקבל trigger אוטומטית.
  - **Onboarding Agent (Phase 2):** משתמש ב-bulk-import path (entry יחיד לכל job + row-per-record opt-in).
  - **Document Intelligence (Phase 2):** משתמש ב-`source_document_id` בכל audit_log entry — אין צורך בשינוי schema כשה-feature נכנס.
  - **API layer (tRPC):** middleware חדש שמכניס `app.actor_*` ב-`SET LOCAL` בתחילת כל request (משלב יפה עם RLS context של ADR-002 שכבר עושה `SET LOCAL app.current_tenant`).
  - **Frontend:** מסך approval queue חדש (Inbox) למאשרים; `pending agent actions` חי במצב.

## Reversal Conditions

נחזור ל-ADR הזה ולשקול שינוי אם:
- **`audit_log` של tenant יחיד עוברת ~100M שורות** ופוגע ב-write latency של business tables (אז: partitioning by month + cold storage לרשומות > 1 שנה, או חלוקה ל-`audit_log_hot`/`audit_log_cold`).
- **רגולטור דורש external WORM storage** (Write-Once-Read-Many — למשל S3 Object Lock) ולא DB-only — אז מוסיפים async streaming של audit_log ל-S3 עם integrity hash chain.
- **ה-trigger overhead מוכח ב-benchmark שעובר 25%** ב-loads ריאליסטיים — אז מסירים את ה-trigger ומשאירים middleware בלבד, עם CI שמבטיח שאין raw-SQL paths.
- **נחליף את Drizzle ב-ORM אחר** — ה-middleware layer צריכה להיכתב מחדש; הזדמנות לשקול event sourcing מחדש.
- **AI agents יתחילו להפעיל זה את זה (multi-agent chain)** — ה-`actor_id` היחיד לא יספיק, נצטרך `causation_chain` (parent_action_id) — שינוי schema, ADR חדש.
- **Schema-per-tenant יוחלט (סתירה ל-ADR-002)** — אז `audit_log` תזוז ל-schema של ה-tenant; כל ה-policy ייכתב מחדש.

## Implementation Notes

### Drizzle schema — `audit_log`

```typescript
// db/schema/audit.ts
import { pgTable, bigserial, uuid, timestamp, text, jsonb, pgEnum, index, inet } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const actorTypeEnum = pgEnum('actor_type', ['user', 'agent', 'system', 'api']);
export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete',
  'approve', 'reject',
  'login', 'logout',
  'bulk_import', 'export',
  'schema_change',
]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  actorType: actorTypeEnum('actor_type').notNull(),
  actorId: text('actor_id').notNull(),                  // user uuid (text), agent name, system process id
  onBehalfOfUserId: uuid('on_behalf_of_user_id'),       // when agent acts per user request

  action: auditActionEnum('action').notNull(),
  resourceType: text('resource_type').notNull(),        // 'item' | 'purchase_order' | 'invoice' | 'schema' | ...
  resourceId: uuid('resource_id'),                      // nullable for bulk/schema actions

  beforeData: jsonb('before_data'),                     // null on create
  afterData: jsonb('after_data'),                       // null on delete

  policyId: text('policy_id'),                          // which agent_policy authorized (null for users)
  requestId: text('request_id'),                        // correlation across rows in same operation
  sourceDocumentId: uuid('source_document_id'),         // Phase 2: DocIntel source

  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
}, (t) => ({
  byResource: index('audit_log_resource_idx').on(t.tenantId, t.resourceType, t.resourceId, t.createdAt.desc()),
  byActor:    index('audit_log_actor_idx').on(t.tenantId, t.actorId, t.createdAt.desc()),
  byTenantTime: index('audit_log_tenant_time_idx').on(t.tenantId, t.createdAt.desc()),
  byRequest:  index('audit_log_request_idx').on(t.tenantId, t.requestId),
}));
```

**Immutability constraint:** `audit_log` מקבל RLS policy שמתיר רק `INSERT` ו-`SELECT` לכל role פרט ל-`audit_admin` (super-admin per-tenant erasure flow). אין `UPDATE` בכלל, גם לא ל-super-admin של המערכת. trigger נוסף `audit_log_immutable_trg` שמעלה exception על כל ניסיון UPDATE.

**Partitioning (כש-נדרש):** monthly range partitioning על `created_at`, כל partition מקבל את אותם indexes. הצגה ב-MVP = single table; partitioning בחודשי scale.

### Drizzle schema — `agent_policy`

```typescript
export const agentPolicyEnum = pgEnum('agent_type', [
  'procurement', 'production_planner', 'ar', 'qc',
  'inventory', 'sales_quote', 'customization', 'copilot',
  'document_intelligence', 'onboarding',
]);

export const agentPolicy = pgTable('agent_policy', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentType: agentPolicyEnum('agent_type').notNull(),

  resourceType: text('resource_type').notNull(),       // matches audit_log.resourceType
  action: auditActionEnum('action').notNull(),

  approvalRequired: boolean('approval_required').notNull().default(true),
  monetaryThreshold: numeric('monetary_threshold', { precision: 14, scale: 2 }),  // null = always require
  thresholdCurrency: text('threshold_currency').default('ILS'),
  approverRoles: text('approver_roles').array().notNull(),   // e.g. ['ops_manager','cfo']

  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('agent_policy_uniq').on(t.tenantId, t.agentType, t.resourceType, t.action),
}));
```

### Drizzle schema — `agent_action_request`

```typescript
export const agentActionStatusEnum = pgEnum('agent_action_status', [
  'pending', 'approved', 'rejected', 'expired', 'executed', 'failed',
]);

export const agentActionRequest = pgTable('agent_action_request', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  agentType: agentPolicyEnum('agent_type').notNull(),
  policyId: uuid('policy_id').notNull().references(() => agentPolicy.id),
  onBehalfOfUserId: uuid('on_behalf_of_user_id').notNull(),

  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  proposedAction: auditActionEnum('proposed_action').notNull(),
  proposedPayload: jsonb('proposed_payload').notNull(),     // full intent (after_data shape)
  rationale: text('rationale').notNull(),                   // agent's explanation in Hebrew

  status: agentActionStatusEnum('status').notNull().default('pending'),
  approverId: uuid('approver_id'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decisionNote: text('decision_note'),

  executedAuditLogId: bigint('executed_audit_log_id', { mode: 'bigint' }),  // back-pointer after execution
}, (t) => ({
  byTenantStatus: index('aar_tenant_status_idx').on(t.tenantId, t.status, t.createdAt.desc()),
  byApprover:     index('aar_approver_idx').on(t.tenantId, t.approverId, t.status),
}));
```

### Write paths

1. **Application middleware (Drizzle):**
   - request enters → `SET LOCAL app.current_tenant`, `app.actor_id`, `app.actor_type`, `app.request_id`, `app.audit_source = 'middleware'`.
   - `db.transaction(async tx => { ... })` wraps every mutation; middleware computes `before` (SELECT) → executes → computes `after` → INSERT to `audit_log` in same `tx`.
2. **DB trigger (defense-in-depth):**
   - per-table `AFTER INSERT/UPDATE/DELETE` trigger calls `audit_trigger_func()`.
   - if `current_setting('app.audit_source', true) = 'middleware'` → trigger no-ops (middleware already wrote).
   - else → trigger writes a minimal row (`actor_type='system'`, `actor_id='trigger'`, `before/after = OLD/NEW`).
3. **Bulk import path (Onboarding Agent):**
   - opens `agent_action_request` (single approval), then on execute writes ONE `audit_log` row with `action='bulk_import'` + `request_id`.
   - per-record audit_log rows are opt-in (default off); when on, written in batched COPY with same `request_id`.
4. **Agent gating flow:**
   - agent reads policy: if `approvalRequired=false` AND (`monetaryThreshold` is null OR action.amount ≤ threshold) → execute directly via middleware path.
   - else → INSERT `agent_action_request` (status='pending'), notify approvers; agent returns "pending" to caller.
   - approver UI: GET pending requests → POST approve/reject; on approve: server runs the proposed action in a `tx` (which writes audit_log) AND updates `agent_action_request.status='executed'`, `executed_audit_log_id`.
   - expired requests (`expires_at < now()`) auto-marked `expired` by cron, audit_log entry with `action='reject'`.

### Retention & export

- per-tenant config table `audit_retention_policy`: `retention_years` (default 7), `enable_worm_export` (default false).
- monthly cron: per-tenant, copy `audit_log` rows older than retention to cold storage (Phase 2 — S3) and DELETE from hot. ה-DELETE היחיד שמותר על audit_log, נשלט ב-`audit_admin` role.
- export endpoint: `GET /api/audit/export?from=&to=&format=csv|json` — RLS-scoped, streamed; כל export עצמו רושם audit_log entry של `action='export'` (audit-of-audit).

### Lint & bootstrap

- migration `0001_audit_bootstrap.sql` יוצר את ה-trigger function אחת ופונקציה helper `enforce_audit_trigger(table_name)`.
- כל migration שמייצר טבלה חדשה עם `tenant_id` חייב לקרוא `enforce_audit_trigger('table_name')`. CI step (lint על migrations) חוסם merge אם טבלה עם `tenant_id` חסרה trigger.
- `audit_log` עצמה לא מקבלת trigger (אין recursion), אך יש לה `audit_log_immutable_trg` שמונע UPDATE.

### Multi-tenant interactions with ADR-002

- כל הטבלאות (`audit_log`, `agent_policy`, `agent_action_request`) הן tenant-scoped ויקבלו את אותו RLS pattern של ADR-002 (`USING (tenant_id = current_setting('app.current_tenant')::uuid)`).
- `super_admin` role יכול לעשות bypass ל-cross-tenant compliance reporting (אבל זה עצמו רושם audit_log עם `actor_type='system'`).
