import { publicProcedure, router } from '../trpc.js';

/**
 * Health router.
 *
 * `health.check` is the canonical liveness probe — used by:
 *   - the `apps/web` server-rendered home page in Round 7a (proves wiring),
 *   - load balancers / uptime checks once deployed,
 *   - tRPC client integration tests as a no-side-effect probe.
 */
export const healthRouter = router({
  check: publicProcedure.query(() => {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };
  }),
});
