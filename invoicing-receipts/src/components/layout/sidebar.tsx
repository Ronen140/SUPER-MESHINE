import { FileText, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BusinessSwitcherPlaceholder } from "@/components/layout/business-switcher-placeholder";

const NAV_ITEMS = [
  { href: "/", label: "בית", icon: LayoutDashboard },
  { href: "/documents", label: "מסמכים", icon: FileText },
  { href: "/customers", label: "לקוחות", icon: Users },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-e border-border bg-card p-4">
      <BusinessSwitcherPlaceholder />

      <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <LogoutButton />
    </aside>
  );
}
