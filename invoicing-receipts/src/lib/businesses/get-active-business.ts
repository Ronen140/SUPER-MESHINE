import { cookies } from "next/headers";
import { cache } from "react";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/businesses/constants";
import { type BusinessListItem, getUserBusinesses } from "@/lib/businesses/get-user-businesses";

export type ActiveBusinessContext = {
  businesses: BusinessListItem[];
  activeBusinessId: string | null;
  activeBusiness: BusinessListItem | null;
};

/**
 * Shared by `(app)/layout.tsx` (sidebar switcher) and `(app)/page.tsx` (dashboard
 * greeting) — both Server Components on the same request. `cache()` here (on top of
 * `getUserBusinesses`'s own `cache()`) means computing "which business is active" only
 * happens once per request even though two independent components need it.
 */
export const getActiveBusinessContext = cache(async (): Promise<ActiveBusinessContext> => {
  const [businesses, cookieStore] = await Promise.all([getUserBusinesses(), cookies()]);
  const cookieBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;

  // The cookie can point at a business that no longer exists / the user lost access to
  // (or simply hasn't been set yet) — fall back to the first business rather than trust
  // a stale value blindly.
  const activeBusinessId = businesses.some((business) => business.id === cookieBusinessId)
    ? cookieBusinessId
    : (businesses[0]?.id ?? null);

  const activeBusiness = businesses.find((business) => business.id === activeBusinessId) ?? null;

  return { businesses, activeBusinessId, activeBusiness };
});
