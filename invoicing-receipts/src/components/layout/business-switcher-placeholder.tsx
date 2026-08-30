import { ChevronDown } from "lucide-react";

/**
 * Placeholder for the real business switcher (F4, blocked on B9/`create_business`).
 * Renders the final visual slot — top of the sidebar, logo/avatar + name + chevron
 * (vault/Discovery/2026-08-30-invoicing-ui-design-research.md §4.5) — but with no
 * business list yet, so the layout doesn't shift once F4 lands.
 */
export function BusinessSwitcherPlaceholder() {
  return (
    <button
      type="button"
      disabled
      aria-label="בחירת עסק (זמנית לא זמין)"
      className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-start text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        ע
      </span>
      <span className="flex-1 truncate font-medium text-foreground">טוען עסקים…</span>
      <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
