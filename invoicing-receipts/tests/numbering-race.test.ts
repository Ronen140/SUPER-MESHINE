import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type SeededBusiness, seedBusiness } from "./db/fixtures";
import { createTestDb, dropTestDb, runSql, type TestDb } from "./db/harness";

const CONCURRENCY = 20;

/**
 * B12 — formal numbering race test (ADR-INV-002 §D1, Implementation Notes #2): 20 valid
 * drafts of the same business + document type, 20 truly concurrent `issue_document()` calls
 * (20 separate OS processes via the harness's `psql`-per-call model — not sequential
 * `await`s in a loop, which would prove nothing about the `UPDATE ... RETURNING` row lock).
 * Expects exactly 20 distinct, sequential document numbers with no gap and no repeat.
 */
describe("ADR-INV-002 §D1 — numbering race (B12, 20 concurrent issue_document calls)", () => {
  let db: TestDb;
  let biz: SeededBusiness;
  let documentIds: string[];

  beforeAll(async () => {
    db = await createTestDb();
    biz = await seedBusiness(db, { entityType: "murshe" });

    documentIds = Array.from({ length: CONCURRENCY }, () => randomUUID());
    const values = documentIds
      .map(
        (id) => `('${id}', '${biz.businessId}', 'receipt', '${biz.customerId}', '${biz.ownerId}')`,
      )
      .join(",\n");
    await runSql(
      db,
      `insert into public.documents (id, business_id, type, customer_id, created_by) values ${values};`,
      { userId: biz.ownerId },
    );

    const lineValues = documentIds
      .map((id) => `('${id}', '${biz.businessId}', 1, 'Widget', 1, 100)`)
      .join(",\n");
    await runSql(
      db,
      `insert into public.document_lines (document_id, business_id, line_number, name, quantity, unit_price) values ${lineValues};`,
      { userId: biz.ownerId },
    );

    const paymentValues = documentIds
      .map((id) => `('${id}', '${biz.businessId}', 1, 'cash', 118, current_date)`)
      .join(",\n");
    await runSql(
      db,
      `insert into public.payments (document_id, business_id, line_number, method, amount, payment_date) values ${paymentValues};`,
      { userId: biz.ownerId },
    );
  }, 60_000);

  afterAll(async () => {
    await dropTestDb(db);
  });

  it(`issues all ${CONCURRENCY} drafts concurrently with sequential, non-repeating document numbers`, async () => {
    await Promise.all(
      documentIds.map((id) =>
        runSql(db, `select public.issue_document('${id}', null);`, { userId: biz.ownerId }),
      ),
    );

    const out = await runSql(
      db,
      `select document_number from public.documents where business_id = '${biz.businessId}' and status = 'issued' order by document_number;`,
      { userId: biz.ownerId },
    );
    const numbers = out
      .trim()
      .split("\n")
      .map((n) => Number(n));

    expect(numbers).toHaveLength(CONCURRENCY);
    expect(new Set(numbers).size).toBe(CONCURRENCY); // no repeats
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(CONCURRENCY); // no gaps: max - min === count - 1

    const counterOut = await runSql(
      db,
      `select next_number from public.document_counters where business_id = '${biz.businessId}' and document_type = 'receipt';`,
      { userId: biz.ownerId },
    );
    expect(counterOut.trim()).toBe(String(CONCURRENCY + 1));
  }, 30_000);

  it("continues the sequence with no gap on a subsequent issue after the concurrent batch", async () => {
    const nextId = randomUUID();
    await runSql(
      db,
      `
      insert into public.documents (id, business_id, type, customer_id, created_by)
      values ('${nextId}', '${biz.businessId}', 'receipt', '${biz.customerId}', '${biz.ownerId}');
      insert into public.document_lines (document_id, business_id, line_number, name, quantity, unit_price)
      values ('${nextId}', '${biz.businessId}', 1, 'Widget', 1, 100);
      insert into public.payments (document_id, business_id, line_number, method, amount, payment_date)
      values ('${nextId}', '${biz.businessId}', 1, 'cash', 118, current_date);
      `,
      { userId: biz.ownerId },
    );
    await runSql(db, `select public.issue_document('${nextId}', null);`, { userId: biz.ownerId });

    const out = await runSql(
      db,
      `select document_number from public.documents where id = '${nextId}';`,
      { userId: biz.ownerId },
    );
    expect(out.trim()).toBe(String(CONCURRENCY + 1));
  });
});
