import { Button } from '@super-meshine/ui';

import { getServerCaller } from '@/lib/trpc/server';

/**
 * Round 7a hello-world page.
 *
 * Server Component (no `'use client'`) — calls the tRPC server-side caller
 * directly, no HTTP. Renders the `health.check` payload to prove:
 *   1. `@super-meshine/api` is wired into Next via `transpilePackages`.
 *   2. The Tailwind 4 + shadcn pipeline from `@super-meshine/ui` ships
 *      working CSS (the styled Button).
 */
export default async function HomePage() {
  const trpc = await getServerCaller();
  const health = await trpc.health.check();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">SUPER-MESHINE</h1>
      <p className="text-lg" data-testid="health-status">
        Status: {health.status} | <span className="font-mono text-sm">{health.timestamp}</span>
      </p>
      <Button>Hello, world</Button>
    </main>
  );
}
