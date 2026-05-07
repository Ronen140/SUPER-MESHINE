import { describe, expect, it, vi } from 'vitest';
import { withTenant } from './with-tenant.js';

/**
 * `withTenant` is the multi-tenancy enforcement point per ADR-002.
 * Every RLS-aware tRPC procedure runs inside it, so it MUST:
 *
 *   1. open a real DB transaction (callers depend on tx semantics);
 *   2. issue `SET LOCAL app.current_tenant = $1` BEFORE running the caller's `fn`;
 *   3. pass the tenantId as a parameter (NOT raw-interpolated into SQL — protects
 *      against SQL injection if a `tenantId` ever leaks from an untrusted source);
 *   4. resolve to the value returned by `fn`.
 *
 * These tests use a hand-rolled fake DB+tx so the unit test stays free of a real
 * Postgres. Round 7b will add a Testcontainers integration test that asserts the
 * GUC is actually set inside Postgres.
 */
describe('withTenant', () => {
  /**
   * Flatten Drizzle's `sql\`...\`` output into a static SQL string + parameter
   * array. Drizzle emits an `SQL` instance with `queryChunks` of two kinds:
   *   - chunk has `.value` (string[])  → static SQL fragment;
   *   - bare value                      → parameter binding.
   * The fake mirrors what postgres-js does when the query reaches the wire.
   */
  function flatten(query: unknown): { sql: string; params: unknown[] } {
    const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
    let sqlText = '';
    const params: unknown[] = [];
    for (const chunk of chunks) {
      if (chunk && typeof chunk === 'object' && 'value' in chunk) {
        const value = (chunk as { value: unknown }).value;
        if (Array.isArray(value)) {
          sqlText += value.join('');
        } else if (typeof value === 'string') {
          sqlText += value;
        }
      } else {
        params.push(chunk);
        sqlText += '$';
      }
    }
    return { sql: sqlText, params };
  }

  interface FakeTx {
    execute: ReturnType<typeof vi.fn>;
  }

  function makeFakeDb() {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    const tx: FakeTx = {
      execute: vi.fn(async (query: unknown) => {
        executed.push(flatten(query));
        return { rows: [] };
      }),
    };
    const db = {
      transaction: vi.fn(async <T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> => {
        return await fn(tx);
      }),
    };
    return { db, tx, executed };
  }

  it('opens a transaction and runs SET LOCAL app.current_tenant before the callback', async () => {
    const { db, tx, executed } = makeFakeDb();

    const result = await withTenant(
      // biome-ignore lint/suspicious/noExplicitAny: test fake; real type is PostgresJsDatabase
      db as any,
      'tenant-abc',
      async (innerTx) => {
        // The fn receives the tx, not the outer db.
        expect(innerTx).toBe(tx);
        return 'ok' as const;
      },
    );

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(executed.length).toBeGreaterThanOrEqual(1);

    const setLocal = executed[0];
    expect(setLocal).toBeDefined();
    expect(setLocal?.sql).toMatch(/SET LOCAL app\.current_tenant\s*=/i);
    // The tenantId MUST be a parameter, not raw-interpolated.
    expect(setLocal?.params).toContain('tenant-abc');
    expect(setLocal?.sql).not.toContain('tenant-abc');

    expect(result).toBe('ok');
  });

  it('rejects empty tenantId — defence in depth against accidental cross-tenant queries', async () => {
    const { db } = makeFakeDb();
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      withTenant(db as any, '', async () => 'never'),
    ).rejects.toThrow(/tenantId/i);
  });
});
