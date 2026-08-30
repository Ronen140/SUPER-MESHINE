import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SeededBusiness, seedBusiness } from "./db/fixtures";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

/**
 * B11 — full cross-tenant isolation suite (ADR-INV-001 §D1/§D3, Amendment A §D3.1/§D10,
 * ADR-INV-001 Implementation Notes #4). 17 assertions:
 *   - 12 basic CRUD (SELECT/INSERT/UPDATE/DELETE × customers/items/documents)
 *   - 2 businesses-direct (SELECT/UPDATE on another business's `businesses` row)
 *   - 3 Amendment-A (direct INSERT to `businesses` fails, DELETE fails,
 *     `create_business()` atomicity under an injected failure)
 *
 * Two independent businesses (bizA owned by userA, bizB owned by userB) — every assertion
 * below runs as userB attempting to read or write something that belongs to bizA.
 */
describe("ADR-INV-001 — cross-tenant isolation (B11, 17 assertions)", () => {
  let db: TestDb;
  let bizA: SeededBusiness;
  let bizB: SeededBusiness;
  let documentA: string;

  beforeAll(async () => {
    db = await createTestDb();
    bizA = await seedBusiness(db, { entityType: "murshe" });
    bizB = await seedBusiness(db, { entityType: "murshe" });

    documentA = randomUUID();
    await runSql(
      db,
      `
      insert into public.documents (id, business_id, type, customer_id, created_by)
      values ('${documentA}', '${bizA.businessId}', 'receipt', '${bizA.customerId}', '${bizA.ownerId}');
      `,
      { userId: bizA.ownerId },
    );
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  // ---- customers (1-4) ----

  it("1. SELECT customers cross-tenant returns no rows", async () => {
    const out = await runSql(
      db,
      `select count(*) from public.customers where id = '${bizA.customerId}';`,
      { userId: bizB.ownerId },
    );
    expect(out.trim()).toBe("0");
  });

  it("2. INSERT customers cross-tenant (with bizA's business_id) is rejected", async () => {
    await expect(
      runSql(
        db,
        `insert into public.customers (business_id, name) values ('${bizA.businessId}', 'Injected');`,
        { userId: bizB.ownerId },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("3. UPDATE customers cross-tenant affects zero rows", async () => {
    await runSql(
      db,
      `update public.customers set name = 'Hacked' where id = '${bizA.customerId}';`,
      { userId: bizB.ownerId },
    );
    const out = await runSql(
      db,
      `select name from public.customers where id = '${bizA.customerId}';`,
      {
        userId: bizA.ownerId,
      },
    );
    expect(out.trim()).toBe("Test Customer");
  });

  it("4. DELETE customers cross-tenant affects zero rows", async () => {
    await runSql(db, `delete from public.customers where id = '${bizA.customerId}';`, {
      userId: bizB.ownerId,
    });
    const out = await runSql(
      db,
      `select count(*) from public.customers where id = '${bizA.customerId}';`,
      {
        userId: bizA.ownerId,
      },
    );
    expect(out.trim()).toBe("1");
  });

  // ---- items (5-8) ----

  let itemA: string;

  it("seeds an item for bizA", async () => {
    itemA = randomUUID();
    await runSql(
      db,
      `insert into public.items (id, business_id, name) values ('${itemA}', '${bizA.businessId}', 'Widget');`,
      { userId: bizA.ownerId },
    );
  });

  it("5. SELECT items cross-tenant returns no rows", async () => {
    const out = await runSql(db, `select count(*) from public.items where id = '${itemA}';`, {
      userId: bizB.ownerId,
    });
    expect(out.trim()).toBe("0");
  });

  it("6. INSERT items cross-tenant (with bizA's business_id) is rejected", async () => {
    await expect(
      runSql(
        db,
        `insert into public.items (business_id, name) values ('${bizA.businessId}', 'Injected');`,
        { userId: bizB.ownerId },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("7. UPDATE items cross-tenant affects zero rows", async () => {
    await runSql(db, `update public.items set name = 'Hacked' where id = '${itemA}';`, {
      userId: bizB.ownerId,
    });
    const out = await runSql(db, `select name from public.items where id = '${itemA}';`, {
      userId: bizA.ownerId,
    });
    expect(out.trim()).toBe("Widget");
  });

  it("8. DELETE items cross-tenant affects zero rows", async () => {
    await runSql(db, `delete from public.items where id = '${itemA}';`, { userId: bizB.ownerId });
    const out = await runSql(db, `select count(*) from public.items where id = '${itemA}';`, {
      userId: bizA.ownerId,
    });
    expect(out.trim()).toBe("1");
  });

  // ---- documents (9-12) ----

  it("9. SELECT documents cross-tenant returns no rows", async () => {
    const out = await runSql(
      db,
      `select count(*) from public.documents where id = '${documentA}';`,
      {
        userId: bizB.ownerId,
      },
    );
    expect(out.trim()).toBe("0");
  });

  it("10. INSERT documents cross-tenant (with bizA's business_id) is rejected", async () => {
    await expect(
      runSql(
        db,
        `insert into public.documents (business_id, type, customer_id, created_by)
         values ('${bizA.businessId}', 'receipt', '${bizA.customerId}', '${bizB.ownerId}');`,
        { userId: bizB.ownerId },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("11. UPDATE documents cross-tenant affects zero rows", async () => {
    await runSql(
      db,
      `update public.documents set internal_note = 'Hacked' where id = '${documentA}';`,
      { userId: bizB.ownerId },
    );
    const out = await runSql(
      db,
      `select coalesce(internal_note, '') from public.documents where id = '${documentA}';`,
      { userId: bizA.ownerId },
    );
    expect(out.trim()).toBe("");
  });

  it("12. DELETE documents cross-tenant affects zero rows", async () => {
    await runSql(db, `delete from public.documents where id = '${documentA}';`, {
      userId: bizB.ownerId,
    });
    const out = await runSql(
      db,
      `select count(*) from public.documents where id = '${documentA}';`,
      {
        userId: bizA.ownerId,
      },
    );
    expect(out.trim()).toBe("1");
  });

  // ---- businesses-direct (13-14, Amendment A-1) ----

  it("13. SELECT businesses direct cross-tenant returns no rows", async () => {
    const out = await runSql(
      db,
      `select count(*) from public.businesses where id = '${bizA.businessId}';`,
      {
        userId: bizB.ownerId,
      },
    );
    expect(out.trim()).toBe("0");
  });

  it("14. UPDATE businesses direct cross-tenant affects zero rows", async () => {
    await runSql(
      db,
      `update public.businesses set legal_name = 'Hacked' where id = '${bizA.businessId}';`,
      { userId: bizB.ownerId },
    );
    const out = await runSql(
      db,
      `select legal_name from public.businesses where id = '${bizA.businessId}';`,
      { userId: bizA.ownerId },
    );
    expect(out.trim()).not.toBe("Hacked");
  });

  // ---- Amendment A (15-17) ----

  it("15. direct INSERT into businesses (bypassing create_business()) is rejected — no INSERT policy at all", async () => {
    await expect(
      runSql(
        db,
        `insert into public.businesses (legal_name, entity_type, tax_id, created_by)
         values ('Direct Insert', 'murshe', '999999999', '${bizB.ownerId}');`,
        { userId: bizB.ownerId },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("16. DELETE on businesses is never visible — no DELETE policy at all, so even the owner's DELETE matches zero rows", async () => {
    // Unlike INSERT/UPDATE (which fail loudly via WITH CHECK), a missing DELETE/SELECT
    // policy makes RLS filter the target to zero rows rather than raise an error — verified
    // empirically rather than assumed, matching the same "affects zero rows" shape as
    // assertions 4/8/12/14 above, not the "throws" shape of 2/6/10/15 (which fail via an
    // explicit WITH CHECK on INSERT).
    await runSql(db, `delete from public.businesses where id = '${bizA.businessId}';`, {
      userId: bizA.ownerId,
    });
    const out = await runSql(
      db,
      `select count(*) from public.businesses where id = '${bizA.businessId}';`,
      {
        userId: bizA.ownerId,
      },
    );
    expect(out.trim()).toBe("1");
  });

  it("17. create_business() is atomic — an injected failure after the businesses INSERT leaves zero rows and a free tax_id", async () => {
    const markerTaxId = "300000001";

    // Test-only fault injection: a trigger on business_members that fails only for this
    // one call, so create_business()'s implicit-transaction atomicity (no explicit COMMIT
    // between the businesses INSERT and the business_members INSERT) can be proven rather
    // than assumed.
    await runSql(
      db,
      `
      create or replace function test_inject_atomicity_failure() returns trigger
      language plpgsql as $$
      begin
        if exists (select 1 from public.businesses b where b.id = new.business_id and b.tax_id = '${markerTaxId}') then
          raise exception 'INJECTED_TEST_FAILURE';
        end if;
        return new;
      end;
      $$;
      create trigger test_inject_atomicity_failure_trg
        before insert on public.business_members
        for each row execute function test_inject_atomicity_failure();
      `,
    );

    await expect(
      runSql(db, `select public.create_business('Atomicity Test', 'murshe', '${markerTaxId}');`, {
        userId: bizB.ownerId,
      }),
    ).rejects.toThrow("INJECTED_TEST_FAILURE");

    const businessCount = await runSql(
      db,
      `select count(*) from public.businesses where tax_id = '${markerTaxId}';`,
    );
    const memberCount = await runSql(
      db,
      `select count(*) from public.business_members bm join public.businesses b on b.id = bm.business_id where b.tax_id = '${markerTaxId}';`,
    );
    expect(businessCount.trim()).toBe("0");
    expect(memberCount.trim()).toBe("0");

    // tax_id is free again — a second, unfailing attempt succeeds.
    await runSql(db, `drop trigger test_inject_atomicity_failure_trg on public.business_members;`);
    await runSql(
      db,
      `select public.create_business('Atomicity Test Retry', 'murshe', '${markerTaxId}');`,
      {
        userId: bizB.ownerId,
      },
    );
    const retryCount = await runSql(
      db,
      `select count(*) from public.businesses where tax_id = '${markerTaxId}';`,
    );
    expect(retryCount.trim()).toBe("1");
  });

  // ---- FORCE ROW LEVEL SECURITY canary (plan AC: "נכשלת (red) אם FORCE מוסר
  // מ-business_signing_keys") ----

  it("business_signing_keys is invisible even to the table owner (superuser) — this is precisely what FORCE buys, and would go green-then-wrong if FORCE were ever dropped", async () => {
    // `business_signing_keys` (ADR-INV-001 §D3.2) has zero policies and FORCE — the one
    // table in the whole schema where even the raw admin/superuser connection (the table
    // owner, run here with no `as` — no role switch, no RLS bypass grant) must see zero
    // rows. Every other assertion in this file runs `as authenticated`, which is already
    // blocked by ENABLE ROW LEVEL SECURITY alone regardless of FORCE (a non-owner role
    // without BYPASSRLS is always subject to RLS) — this is the one query in the suite that
    // actually exercises FORCE's own effect (blocking the table *owner*), so it is the only
    // assertion that would flip from failing to passing if FORCE were silently removed.
    const out = await runSql(db, `select count(*) from public.business_signing_keys;`);
    expect(out.trim()).toBe("0");
  });
});
