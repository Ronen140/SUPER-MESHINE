import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { TRPCContext } from './context.js';

/**
 * tRPC root initialiser.
 *
 * - `superjson` per ADR-003 so Date/Map/BigInt round-trip through the wire.
 * - Context shape is the result of `createTRPCContext` (see `context.ts`).
 *
 * Round 7a exposes only public procedures. Round 7b adds an `authedProcedure`
 * middleware that asserts `ctx.userId` + `ctx.tenantId` and wraps DB access
 * in `withTenant` (ADR-002).
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;
