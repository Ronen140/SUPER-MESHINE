/**
 * @super-meshine/api — public surface.
 *
 * `apps/web` imports `appRouter` for the fetch-adapter route handler
 * and `AppRouter` (type) for the typed client. Round 7b adds the authed
 * middleware + first real router.
 */
export { appRouter } from './routers/_app.js';
export type { AppRouter } from './routers/_app.js';
export { createTRPCContext } from './context.js';
export type { TRPCContext, RequestLike } from './context.js';
export { createCallerFactory } from './trpc.js';
