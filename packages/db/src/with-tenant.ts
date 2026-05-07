import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase, PostgresJsTransaction } from 'drizzle-orm/postgres-js';

/**
 * Permissive transaction shape — covers both `PostgresJsDatabase` (when used as
 * a transactional db) and `PostgresJsTransaction` (the value drizzle hands to
 * the inner callback). Concrete generics intentionally left wide because the
 * schema lives in another package and is not present at this point.
 */
// biome-ignore lint/suspicious/noExplicitAny: Drizzle generics resolved at call site
export type Tx = PostgresJsTransaction<any, any>;

/**
 * Wrap an RLS-scoped operation in a Postgres transaction with the tenant
 * GUC set so RLS policies can use `current_setting('app.current_tenant')`.
 *
 * Per ADR-002, every business-data query MUST run inside `withTenant`. The
 * helper:
 *   1. opens a transaction on `db`;
 *   2. issues `SET LOCAL app.current_tenant = $1` (parameterised, not interpolated);
 *   3. invokes the caller's `fn(tx)` and returns its result.
 *
 * @param db A Drizzle DB instance bound to `postgres-js`.
 * @param tenantId The tenant id to scope the transaction to. Must be non-empty.
 * @param fn Callback receiving the active transaction.
 * @returns Whatever `fn` resolves to.
 *
 * @throws If `tenantId` is empty/whitespace — defence-in-depth against
 *   accidental cross-tenant queries when an upstream layer forgets to populate
 *   the JWT claim.
 */
export async function withTenant<T>(
  // biome-ignore lint/suspicious/noExplicitAny: schema generic resolved at call site
  db: PostgresJsDatabase<any>,
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('withTenant: tenantId is required and must be non-empty');
  }

  return await db.transaction(async (tx) => {
    // SET LOCAL applies to the current transaction only and is reset on COMMIT/ROLLBACK.
    // tenantId is a parameter — never raw-interpolated — to prevent SQL injection if
    // a tenantId ever flows from an untrusted source.
    await tx.execute(sql`SET LOCAL app.current_tenant = ${tenantId}`);
    return await fn(tx as Tx);
  });
}
