import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

/**
 * code-quality review (Batch 3, 🟡 TOCTOU): `public.create_business()`'s 10-business limit
 * read `count(*)` then `insert` with no lock in between. Reproduced empirically per the
 * review report (5 concurrent calls at count=9 → 12 businesses). Fixed in
 * `0016_log_event_and_fixes.sql` with `pg_advisory_xact_lock(hashtext(v_uid::text))`.
 *
 * Uses real OS-level concurrency (5 separate `psql` processes via `Promise.all`, same
 * pattern as `tests/numbering-race.test.ts`) — sequential `await`s in a loop would prove
 * nothing about a race that only exists between two genuinely concurrent transactions.
 */
describe("ADR-INV-001 §D10 — create_business() 10-business limit race (code-quality fix)", () => {
  let db: TestDb;
  let ownerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    ownerId = randomUUID();

    await runSql(
      db,
      `insert into auth.users (id, email) values ('${ownerId}', 'race@test.local');`,
    );

    // Seed exactly 9 pre-existing businesses for this user (one below the limit) —
    // sequential on purpose, this part is not what's under test.
    for (let i = 0; i < 9; i++) {
      const taxId = String(600000001 + i).padStart(9, "0");
      await runSql(
        db,
        `select public.create_business('Pre-existing ${i}', 'murshe', '${taxId}');`,
        { userId: ownerId },
      );
    }
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  it("5 concurrent create_business() calls at count=9 result in exactly 10 businesses, never 11+", async () => {
    const attempts = Array.from({ length: 5 }, (_, i) => {
      const taxId = String(700000001 + i).padStart(9, "0");
      return runSql(db, `select public.create_business('Race ${i}', 'murshe', '${taxId}');`, {
        userId: ownerId,
      }).then(
        () => ({ ok: true as const }),
        (error: Error) => ({ ok: false as const, error }),
      );
    });

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(4);
    for (const failure of failed) {
      if (!failure.ok) {
        expect(failure.error.message).toContain("INV_BUSINESS_LIMIT");
      }
    }

    const out = await runSql(
      db,
      `select count(*) from public.businesses where created_by = '${ownerId}';`,
      { userId: ownerId },
    );
    expect(out.trim()).toBe("10");
  }, 30_000);
});
