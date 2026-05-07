'use client';

import type { AppRouter } from '@super-meshine/api';
import { type CreateTRPCReact, createTRPCReact } from '@trpc/react-query';

/**
 * Typed tRPC React hook collection.
 *
 * Round 7a does not actually use these hooks (the homepage is a Server
 * Component using the server-side caller). The export exists so client
 * components added in Round 7b have a ready entry point.
 *
 * The matching `<TRPCProvider>` wrapper (QueryClient + httpBatchLink) is
 * deferred to Round 7b — adding it now would be dead code, since no client
 * component on the homepage calls these hooks. The explicit type annotation
 * keeps the inferred type portable across the workspace (TS2742 otherwise).
 */
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();
