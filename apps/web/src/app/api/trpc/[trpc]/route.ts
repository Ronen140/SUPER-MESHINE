import { appRouter, createTRPCContext } from '@super-meshine/api';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

/**
 * tRPC fetch-adapter route handler.
 *
 * `/api/trpc/[trpc]` is the single endpoint the typed client (and any
 * external HTTP probe) hits. The `fetch` adapter is the App Router-friendly
 * surface — it consumes a `Request` and returns a `Response`, so it works
 * in the Edge runtime as well as Node.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req: { headers: req.headers } }),
  });

export { handler as GET, handler as POST };
