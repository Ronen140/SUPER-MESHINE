import { randomUUID } from "node:crypto";
import { type TestDb, runSql } from "./harness";

export interface SeededBusiness {
  ownerId: string;
  businessId: string;
  customerId: string;
}

/**
 * Seeds one owner + one business + one membership + one customer + one (dummy) active
 * signing key, using the admin/superuser connection (no RLS — this is fixture setup, not the
 * behavior under test). Every test file composes its own scenario on top of this with
 * `runSql(db, ..., { userId })`.
 */
export async function seedBusiness(
  db: TestDb,
  opts: { entityType?: "murshe" | "patur" } = {},
): Promise<SeededBusiness> {
  const ownerId = randomUUID();
  const businessId = randomUUID();
  const customerId = randomUUID();
  const entityType = opts.entityType ?? "murshe";

  await runSql(
    db,
    `
    insert into auth.users (id, email) values ('${ownerId}', 'owner-${ownerId}@test.local');

    insert into public.businesses (id, legal_name, entity_type, tax_id, created_by)
    values ('${businessId}', 'Test Biz ${businessId}', '${entityType}',
            lpad((floor(random() * 900000000) + 100000000)::text, 9, '0'), '${ownerId}');

    insert into public.business_members (business_id, user_id, role)
    values ('${businessId}', '${ownerId}', 'owner');

    insert into public.customers (id, business_id, name)
    values ('${customerId}', '${businessId}', 'Test Customer');

    insert into public.business_signing_keys (
      business_id, certificate_pem, certificate_serial, subject_dn, fingerprint_sha256,
      not_before, not_after, private_key_ciphertext, private_key_nonce, wrapped_dek, kek_id
    ) values (
      '${businessId}', 'PEM', 'SERIAL', 'DN', '\\xdead', now(), now() + interval '1 year',
      '\\xdead', '\\xdead', '\\xdead', 'v1'
    );
    `,
  );

  return { ownerId, businessId, customerId };
}

/** Creates a draft document with one line and (for receipt-family types) a matching payment. */
export async function seedDraftReceipt(
  db: TestDb,
  biz: SeededBusiness,
  opts: { issueDate?: string; unitPrice?: number } = {},
): Promise<string> {
  const documentId = randomUUID();
  const unitPrice = opts.unitPrice ?? 100;
  const issueDateSql = opts.issueDate ? `'${opts.issueDate}'` : "null";

  await runSql(
    db,
    `
    insert into public.documents (id, business_id, type, customer_id, issue_date, created_by)
    values ('${documentId}', '${biz.businessId}', 'receipt', '${biz.customerId}', ${issueDateSql}, '${biz.ownerId}');

    insert into public.document_lines (document_id, business_id, line_number, name, quantity, unit_price)
    values ('${documentId}', '${biz.businessId}', 1, 'Widget', 1, ${unitPrice});
    `,
    { userId: biz.ownerId },
  );

  return documentId;
}

export async function addMatchingPayment(
  db: TestDb,
  biz: SeededBusiness,
  documentId: string,
  amount: number,
  paymentDate: string,
): Promise<void> {
  await runSql(
    db,
    `
    insert into public.payments (document_id, business_id, line_number, method, amount, payment_date)
    values ('${documentId}', '${biz.businessId}', 1, 'cash', ${amount}, '${paymentDate}');
    `,
    { userId: biz.ownerId },
  );
}
