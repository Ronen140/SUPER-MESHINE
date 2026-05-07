import { router } from '../trpc.js';
import { healthRouter } from './health.js';

/**
 * Root router. New top-level routers register here.
 *
 * Type-only export `AppRouter` is the contract `apps/web` (and any future
 * client) consumes — see `packages/api/src/index.ts`.
 */
export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
