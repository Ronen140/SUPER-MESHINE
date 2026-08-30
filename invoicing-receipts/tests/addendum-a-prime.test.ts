import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMatchingPayment, seedBusiness, seedDraftReceipt, type SeededBusiness } from "./db/fixtures";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

/**
 * ADR-INV-002 "Addendum A′" regression tests (Implementation Notes #5, A′-2/A′-3) — the
 * mandatory fixes from `0010_addendum_fixes.sql`, required to land before B13's CI:
 *
 *  - A′-2: `public.issue_document()` must preserve a user-set `documents.issue_date` instead
 *    of silently overwriting it with `current_date`, and must reject a future issue_date.
 *  - A′-1/A′-3: `app.document_lines_compute()`'s draft-time (layer 1) VAT-rate preview must
 *    be derived from the document's own `issue_date`, not unconditionally "today" — matching
 *    layer 2 (the issue-time recompute) exactly.
 *
 * Uses vat_rates seeded by 0003a_core_tables.sql: 17% for 2015-10-01..2024-12-31,
 * 18% for 2025-01-01 onward.
 */
describe("ADR-INV-002 Addendum A′ — issue_date / draft VAT rate", () => {
  let db: TestDb;
  let biz: SeededBusiness;

  beforeAll(async () => {
    db = await createTestDb();
    biz = await seedBusiness(db, { entityType: "murshe" });
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  it("issuing without p_issue_date preserves the draft's own backdated issue_date and derives tax_year from it", async () => {
    const documentId = await seedDraftReceipt(db, biz, { issueDate: "2024-11-15", unitPrice: 100 });
    await addMatchingPayment(db, biz, documentId, 117, "2024-11-15");

    await runSql(db, `select public.issue_document('${documentId}', null);`, { userId: biz.ownerId });

    const out = await runSql(
      db,
      `select issue_date, tax_year, vat_rate, status from public.documents where id = '${documentId}';`,
      { userId: biz.ownerId },
    );
    const [issueDate, taxYear, vatRate, status] = out.trim().split("\t");
    expect(issueDate).toBe("2024-11-15");
    expect(taxYear).toBe("2024");
    expect(vatRate).toBe("17.00");
    expect(status).toBe("issued");
  });

  it("an explicit p_issue_date argument overrides the draft's own issue_date", async () => {
    const documentId = await seedDraftReceipt(db, biz, { issueDate: "2024-06-01", unitPrice: 100 });
    await addMatchingPayment(db, biz, documentId, 118, "2025-03-01");

    await runSql(db, `select public.issue_document('${documentId}', '2025-03-01');`, { userId: biz.ownerId });

    const out = await runSql(
      db,
      `select issue_date, tax_year, vat_rate from public.documents where id = '${documentId}';`,
      { userId: biz.ownerId },
    );
    const [issueDate, taxYear, vatRate] = out.trim().split("\t");
    expect(issueDate).toBe("2025-03-01");
    expect(taxYear).toBe("2025");
    expect(vatRate).toBe("18.00");
  });

  it("rejects issuing a document with a future issue_date (INV_FUTURE_ISSUE_DATE)", async () => {
    const documentId = await seedDraftReceipt(db, biz, { issueDate: "2099-01-01", unitPrice: 100 });
    await addMatchingPayment(db, biz, documentId, 118, "2099-01-01");

    await expect(
      runSql(db, `select public.issue_document('${documentId}', null);`, { userId: biz.ownerId }),
    ).rejects.toThrow("INV_FUTURE_ISSUE_DATE");
  });

  it("a draft line saved while issue_date falls in the 17% period previews at 17%, before issuance", async () => {
    const documentId = await seedDraftReceipt(db, biz, { issueDate: "2024-11-15", unitPrice: 100 });

    const out = await runSql(
      db,
      `select line_net, line_vat, line_total from public.document_lines where document_id = '${documentId}';`,
      { userId: biz.ownerId },
    );
    const [lineNet, lineVat, lineTotal] = out.trim().split("\t");
    expect(lineNet).toBe("100.00");
    expect(lineVat).toBe("17.00");
    expect(lineTotal).toBe("117.00");
  });
});
