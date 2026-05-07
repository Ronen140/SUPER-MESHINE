import { describe, expect, it } from 'vitest';
import { createTRPCContext } from '../context.js';
import { createCallerFactory } from '../trpc.js';
import { appRouter } from './_app.js';

/**
 * The `health.check` procedure is the canonical Round 7a liveness probe.
 * This test exercises it end-to-end via tRPC's server-side caller — same code
 * path the Next.js Server Component uses in `apps/web`.
 */
describe('health.check', () => {
  const createCaller = createCallerFactory(appRouter);

  it('returns status: ok with an ISO 8601 timestamp', async () => {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);

    const result = await caller.health.check();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Must round-trip through Date — guards against accidental refactors that
    // return raw numbers / `Date` instances (which would break wire format).
    expect(Number.isFinite(Date.parse(result.timestamp))).toBe(true);
  });
});
