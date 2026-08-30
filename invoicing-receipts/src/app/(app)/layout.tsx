import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
