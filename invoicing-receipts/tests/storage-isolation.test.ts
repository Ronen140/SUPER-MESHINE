import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SeededBusiness, seedBusiness } from "./db/fixtures";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

/**
 * B10/B11 gap fix (spec-review, vault/Reviews/spec/2026-08-30-invoicing-phase0-batch3.md) —
 * `0012_storage_buckets.sql`'s policies on `storage.objects` (`documents_bucket_read`,
 * `business_assets_read`, `business_assets_insert`) had no automated regression test:
 * `tests/db/storage-stub.sql` existed but no `*.test.ts` consumed it. This is the missing
 * "SELECT חוצה-עסק על documents נכשל" assertion the plan requires at the storage layer,
 * plus the equivalent for `business-assets`' SELECT+INSERT policies, plus the positive
 * (same-business) cases for both.
 *
 * Object paths follow the convention both `0012_storage_buckets.sql`'s policies and
 * ADR-INV-001 Implementation Notes #9 assume: `<business_id>/...`, i.e.
 * `(storage.foldername(name))[1]::uuid` is the owning business.
 */
describe("ADR-INV-001 Implementation Notes #9 — storage bucket isolation", () => {
  let db: TestDb;
  let bizA: SeededBusiness;
  let bizB: SeededBusiness;

  beforeAll(async () => {
    db = await createTestDb();
    bizA = await seedBusiness(db, { entityType: "murshe" });
    bizB = await seedBusiness(db, { entityType: "murshe" });

    // Seeded via service_role — matches how these objects are actually written in
    // production: the PDF pipeline (ADR-INV-001 §D5) for `documents`, and (for this test's
    // purposes only) also `business-assets`, since `authenticated` INSERT into
    // `business-assets` is exactly one of the behaviors under test below and must not be
    // pre-empted by the seed step itself.
    await runSql(
      db,
      `
      insert into storage.objects (bucket_id, name) values
        ('documents', '${bizA.businessId}/doc-a/original.pdf'),
        ('documents', '${bizB.businessId}/doc-b/original.pdf'),
        ('business-assets', '${bizA.businessId}/logo.png'),
        ('business-assets', '${bizB.businessId}/logo.png');
      `,
      { role: "service_role" },
    );
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  // ---- documents bucket: SELECT only, no write policy for authenticated at all ----

  it("owner of bizA can SELECT bizA's own object in the documents bucket", async () => {
    const out = await runSql(
      db,
      `select name from storage.objects where bucket_id = 'documents' and name = '${bizA.businessId}/doc-a/original.pdf';`,
      { userId: bizA.ownerId },
    );
    expect(out.trim()).toBe(`${bizA.businessId}/doc-a/original.pdf`);
  });

  it("owner of bizB cannot SELECT bizA's object in the documents bucket (cross-tenant read)", async () => {
    const out = await runSql(
      db,
      `select count(*) from storage.objects where bucket_id = 'documents' and name = '${bizA.businessId}/doc-a/original.pdf';`,
      { userId: bizB.ownerId },
    );
    expect(out.trim()).toBe("0");
  });

  it("owner of bizB only ever sees bizB's own objects in the documents bucket, never bizA's", async () => {
    const out = await runSql(
      db,
      `select name from storage.objects where bucket_id = 'documents' order by name;`,
      {
        userId: bizB.ownerId,
      },
    );
    expect(out.trim()).toBe(`${bizB.businessId}/doc-b/original.pdf`);
  });

  it("no INSERT policy exists for the documents bucket — even the owner of bizA cannot INSERT into their own path", async () => {
    await expect(
      runSql(
        db,
        `insert into storage.objects (bucket_id, name) values ('documents', '${bizA.businessId}/doc-a/copy.pdf');`,
        { userId: bizA.ownerId },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  // ---- business-assets bucket: SELECT for any member, INSERT for an owner only ----

  it("owner of bizA can SELECT bizA's own object in the business-assets bucket", async () => {
    const out = await runSql(
      db,
      `select name from storage.objects where bucket_id = 'business-assets' and name = '${bizA.businessId}/logo.png';`,
      { userId: bizA.ownerId },
    );
    expect(out.trim()).toBe(`${bizA.businessId}/logo.png`);
  });

  it("owner of bizB cannot SELECT bizA's object in the business-assets bucket (cross-tenant read)", async () => {
    const out = await runSql(
      db,
      `select count(*) from storage.objects where bucket_id = 'business-assets' and name = '${bizA.businessId}/logo.png';`,
      { userId: bizB.ownerId },
    );
    expect(out.trim()).toBe("0");
  });

  it("owner of bizA can INSERT a new object into business-assets under bizA's own path", async () => {
    await runSql(
      db,
      `insert into storage.objects (bucket_id, name) values ('business-assets', '${bizA.businessId}/logo-v2.png');`,
      { userId: bizA.ownerId },
    );
    const out = await runSql(
      db,
      `select count(*) from storage.objects where bucket_id = 'business-assets' and name = '${bizA.businessId}/logo-v2.png';`,
      { userId: bizA.ownerId },
    );
    expect(out.trim()).toBe("1");
  });

  it("owner of bizB cannot INSERT into business-assets under bizA's path (cross-tenant write)", async () => {
    await expect(
      runSql(
        db,
        `insert into storage.objects (bucket_id, name) values ('business-assets', '${bizA.businessId}/hacked.png');`,
        { userId: bizB.ownerId },
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
