import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * The Drizzle DB type produced by `createDb`.
 *
 * Aliased as a runtime-derived type so callers can write
 * `import type { Db } from '@super-meshine/db'` without recreating the generic.
 */
export type Db = ReturnType<typeof drizzle>;

/**
 * Create a Drizzle client backed by `postgres-js`.
 *
 * Per ADR-003, `postgres-js` is the canonical driver — it supports `SET LOCAL`
 * inside a transaction cleanly, which is the foundation for `withTenant` (ADR-002).
 *
 * Two connection strings are used in the deployed system:
 *   - pooled (Supabase Pooler, transaction mode) for runtime tRPC,
 *   - direct (port 5432) for `drizzle-kit migrate` only.
 * This factory does not enforce which one — that is the caller's responsibility.
 *
 * @param connectionString A Postgres connection string (`postgres://...`).
 * @returns A Drizzle ORM client.
 */
export function createDb(connectionString: string): Db {
  if (!connectionString) {
    throw new Error('createDb: connectionString is required');
  }
  const sql = postgres(connectionString, {
    // Per ADR-003: transaction-mode pooling. Prepared statements must be off
    // when running through Supabase Pooler in transaction mode.
    prepare: false,
  });
  return drizzle(sql);
}
