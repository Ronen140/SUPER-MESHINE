import type { Db } from '@super-meshine/db';

/**
 * Shape of the tRPC request context.
 *
 * Round 7a stub: all three fields are `null`. Round 7b will:
 *   - extract the Supabase JWT from the request,
 *   - verify it (using `@supabase/ssr`),
 *   - read the `sub` and `tenant_id` claims,
 *   - construct a Drizzle DB bound to the request's pooled connection.
 */
export interface TRPCContext {
  userId: string | null;
  tenantId: string | null;
  db: Db | null;
}

/**
 * Build a request context. Round 7a accepts no input; the signature already
 * takes a `RequestLike` so 7b can pull headers without churn.
 */
export interface RequestLike {
  headers: Headers | Record<string, string | undefined>;
}

export async function createTRPCContext(_opts?: { req?: RequestLike }): Promise<TRPCContext> {
  // Round 7a: no auth wiring; downstream procedures must guard themselves
  // against null context fields until Round 7b adds the authed middleware.
  return {
    userId: null,
    tenantId: null,
    db: null,
  };
}
