import { appRouter, createCallerFactory, createTRPCContext } from '@super-meshine/api';

/**
 * Server-side tRPC caller factory.
 *
 * Usage in a Server Component:
 *
 *   const trpc = await getServerCaller();
 *   const result = await trpc.health.check();
 *
 * This bypasses HTTP entirely (no fetch round-trip when the page is rendered
 * on the same server as the router) — see tRPC docs §Server-Side Calls.
 * Round 7b will pass real headers via `createTRPCContext({ req })` so the
 * authed middleware can read the JWT.
 */
const createCaller = createCallerFactory(appRouter);

export async function getServerCaller() {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
}
