"use client";

import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setActiveBusinessId } from "@/app/(app)/businesses/actions";
import {
  DropdownMenu,
  DropdownMenuActiveCheck,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BusinessListItem } from "@/lib/businesses/get-user-businesses";

function businessLabel(business: BusinessListItem): string {
  return business.display_name?.trim() || business.legal_name;
}

function BusinessAvatar({ business }: { business: BusinessListItem }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: business.accent_color }}
      aria-hidden="true"
    >
      {businessLabel(business).charAt(0) || "ע"}
    </span>
  );
}

export function BusinessSwitcher({
  businesses,
  activeBusinessId,
}: {
  businesses: BusinessListItem[];
  activeBusinessId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);

  if (businesses.length === 0) {
    return (
      <Link
        href="/businesses/new"
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-start text-sm text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="size-4" aria-hidden="true" />
        עסק ראשון
      </Link>
    );
  }

  const active = businesses.find((business) => business.id === activeBusinessId) ?? businesses[0];

  function handleSelect(businessId: string) {
    if (!active || businessId === active.id) return;
    setSwitchError(null);
    startTransition(async () => {
      const result = await setActiveBusinessId(businessId);
      if (!result.ok) {
        setSwitchError(result.error ?? "לא ניתן היה להחליף עסק.");
        return;
      }
      router.refresh();
    });
  }

  if (!active) return null;

  if (businesses.length === 1) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <BusinessAvatar business={active} />
          <span className="flex-1 truncate font-medium text-foreground">
            {businessLabel(active)}
          </span>
        </div>
        <Link
          href="/businesses/new"
          className="flex items-center gap-1.5 self-start px-1 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          עסק חדש
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            aria-label="בחירת עסק פעיל"
            className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-start text-sm shadow-sm hover:bg-accent disabled:cursor-wait disabled:opacity-70"
          >
            <BusinessAvatar business={active} />
            <span className="flex-1 truncate font-medium text-foreground">
              {businessLabel(active)}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {businesses.map((business) => (
            <DropdownMenuItem key={business.id} onSelect={() => handleSelect(business.id)}>
              <BusinessAvatar business={business} />
              <span className="flex-1 truncate">{businessLabel(business)}</span>
              <DropdownMenuActiveCheck active={business.id === active.id} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/businesses/new" className="flex items-center gap-2">
              <Plus className="size-4" aria-hidden="true" />
              עסק חדש
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {switchError ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {switchError}
        </p>
      ) : null}
    </div>
  );
}
