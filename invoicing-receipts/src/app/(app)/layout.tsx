import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { getActiveBusinessContext } from "@/lib/businesses/get-active-business";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { businesses, activeBusinessId } = await getActiveBusinessContext();

  return (
    <div className="flex min-h-dvh">
      <Sidebar businesses={businesses} activeBusinessId={activeBusinessId} />
      <main className="min-w-0 flex-1 p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
