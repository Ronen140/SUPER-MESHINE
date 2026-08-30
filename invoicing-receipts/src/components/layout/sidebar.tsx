import { FileText, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BusinessSwitcherPlaceholder } from "@/components/layout/business-switcher-placeholder";

const ACTIVE_NAV_ITEMS = [{ href: "/", label: "בית", icon: LayoutDashboard }] as const;

/**
 * Phase 1 screens (vault/Engineering/invoicing-phase-0-plan.md: "עורך המסמכים, קטלוג
 * הפריטים, הדשבורד... נשארים Phase 1 במלואם"). Shown as disabled slots so the sidebar
 * doesn't visually jump once they land, but never as real links in F1.
 */
const UPCOMING_NAV_ITEMS = [
  { label: "מסמכים", icon: FileText },
  { label: "לקוחות", icon: Users },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-e border-border bg-card p-4">
      <BusinessSwitcherPlaceholder />

      <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-1">
        {ACTIVE_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}

        {UPCOMING_NAV_ITEMS.map(({ label, icon: Icon }) => (
          <span
            key={label}
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              בקרוב
            </span>
          </span>
        ))}
      </nav>

      <LogoutButton />
    </aside>
  );
}
