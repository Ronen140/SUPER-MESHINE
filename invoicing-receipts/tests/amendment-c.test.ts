import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SeededBusiness, seedBusiness, seedDraftReceipt } from "./db/fixtures";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

/**
 * ADR-INV-001 Amendment C-1 regression: `app.compute_line()` moved back from `public` to
 * `app` (`0015_amendment_c.sql`), with `grant usage on schema app to authenticated` +
 * a narrow EXECUTE grant replacing the `0010_addendum_fixes.sql` schema-move fix for the
 * same underlying bug — a real `authenticated` client editing a draft's line items directly
 * (no `issue_document()` anywhere in the call stack) could never actually trigger
 * `app.document_lines_compute()` -> `app.compute_line()` successfully before either fix.
 * This is the explicit "preview flow" check Implementation Notes #5 calls out as "the test
 * that would have caught C-1".
 */
describe("ADR-INV-001 Amendment C-1 — draft line preview works for a real authenticated client", () => {
  let db: TestDb;
  let biz: SeededBusiness;

  beforeAll(async () => {
    db = await createTestDb();
    biz = await seedBusiness(db, { entityType: "murshe" });
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  it("INSERT on document_lines as authenticated (no issue_document in the stack) fires the trigger and computes correctly", async () => {
    const documentId = await seedDraftReceipt(db, biz, { unitPrice: 50 });

    const out = await runSql(
      db,
      `select quantity, unit_price, line_net, line_vat, line_total from public.document_lines where document_id = '${documentId}';`,
      { userId: biz.ownerId },
    );
    const [quantity, unitPrice, lineNet, lineVat, lineTotal] = out.trim().split("\t");
    expect(quantity).toBe("1.000");
    expect(unitPrice).toBe("50.00");
    expect(lineNet).toBe("50.00");
    expect(Number(lineVat)).toBeGreaterThan(0); // 17% or 18% depending on today's rate — never 0 for a murshe business
    expect(lineTotal).toBe((Number(lineNet) + Number(lineVat)).toFixed(2));
  });

  it("UPDATE on document_lines as authenticated (no issue_document in the stack) re-fires the trigger and recomputes", async () => {
    const documentId = await seedDraftReceipt(db, biz, { unitPrice: 50 });

    await runSql(
      db,
      `update public.document_lines set quantity = 3, unit_price = 20 where document_id = '${documentId}';`,
      { userId: biz.ownerId },
    );

    const out = await runSql(
      db,
      `select line_net, line_total from public.document_lines where document_id = '${documentId}';`,
      { userId: biz.ownerId },
    );
    const [lineNet, lineTotal] = out.trim().split("\t");
    expect(lineNet).toBe("60.00"); // 3 * 20
    expect(Number(lineTotal)).toBeGreaterThan(60); // net + a non-zero VAT amount
  });

  it("an authenticated client can call app.compute_line() directly (the narrow EXECUTE grant ADR-INV-001 §D3 relies on)", async () => {
    const out = await runSql(
      db,
      `select line_net, line_vat, line_total from app.compute_line(2, 50, 0, 'standard', 18);`,
      {
        userId: biz.ownerId,
      },
    );
    const [lineNet, lineVat, lineTotal] = out.trim().split("\t");
    expect(lineNet).toBe("100.00");
    expect(lineVat).toBe("18.00");
    expect(lineTotal).toBe("118.00");
  });

  it("an authenticated client cannot call app.business_has_signing_key() directly — USAGE on app does not open every app.* function, only the three explicitly granted", async () => {
    await expect(
      runSql(db, `select app.business_has_signing_key('${biz.businessId}');`, {
        userId: biz.ownerId,
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
