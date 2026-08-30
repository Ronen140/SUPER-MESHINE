import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SeededBusiness, seedBusiness } from "./db/fixtures";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

/**
 * Architect decision (0017_log_event_revert.sql): the `service_role` extension to
 * `public.log_event()` added in `0016_log_event_and_fixes.sql` is reverted — `service_role`
 * already has `BYPASSRLS` (see tests/db/harness.ts) and can INSERT into `audit_log` directly,
 * exactly like `public.create_business()` already does; a GUC-branched authorization path was
 * an audit-forgery surface. `api/keygen.py` now inserts into `audit_log` directly instead of
 * calling this RPC.
 */
describe("0017_log_event_revert — service_role can no longer call public.log_event()", () => {
  let db: TestDb;
  let biz: SeededBusiness;

  beforeAll(async () => {
    db = await createTestDb();
    biz = await seedBusiness(db, { entityType: "murshe" });
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  it("a service_role call to log_event() is rejected with permission denied", async () => {
    await expect(
      runSql(
        db,
        `select public.log_event('${biz.businessId}', 'key_create', 'business_signing_keys', null, '{}'::jsonb);`,
        { role: "service_role" },
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("an authenticated member can still call log_event() for a real member-initiated event", async () => {
    await runSql(
      db,
      `select public.log_event('${biz.businessId}', 'export', null, null, '{}'::jsonb);`,
      { userId: biz.ownerId },
    );

    const out = await runSql(
      db,
      `select actor_type, actor_id, action from public.audit_log
       where business_id = '${biz.businessId}' and action = 'export';`,
      { userId: biz.ownerId },
    );
    const [actorType, actorId, action] = out.trim().split("\t");
    expect(actorType).toBe("user");
    expect(actorId).toBe(biz.ownerId);
    expect(action).toBe("export");
  });

  it("an authenticated non-member is still rejected with INV_FORBIDDEN (unchanged by the revert)", async () => {
    const strangerId = randomUUID();
    await runSql(db, `insert into auth.users (id, email) values ('${strangerId}', 'stranger-${strangerId}@test.local');`);

    await expect(
      runSql(
        db,
        `select public.log_event('${biz.businessId}', 'export', null, null, '{}'::jsonb);`,
        { userId: strangerId },
      ),
    ).rejects.toThrow(/INV_FORBIDDEN/);
  });
});
