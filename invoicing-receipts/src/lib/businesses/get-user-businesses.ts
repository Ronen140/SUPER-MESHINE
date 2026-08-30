import { cache } from "react";
import { isNextControlFlowError } from "@/lib/next-control-flow-error";
import { createClient } from "@/lib/supabase/server";

export type BusinessListItem = {
  id: string;
  legal_name: string;
  display_name: string | null;
  entity_type: "patur" | "murshe";
  accent_color: string;
};

/**
 * All businesses the current user is a member of, via RLS (`businesses_read`,
 * ADR-INV-001 §D3.1 — `id in (select app.current_business_ids())`). There is no
 * explicit `business_id`/`user_id` filter here on purpose: RLS is the only
 * enforcement boundary, matching the rest of this project's data-access pattern
 * (no tRPC/service layer — see vault/Engineering/invoicing-phase-0-plan.md).
 *
 * Wrapped in React's `cache()` so the F4 sidebar (layout) and the dashboard
 * greeting (page) — both Server Components on the same request — share one
 * query instead of two.
 */
export const getUserBusinesses = cache(async (): Promise<BusinessListItem[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("id, legal_name, display_name, entity_type, accent_color")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[get-user-businesses] failed to load businesses:", error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    // Next.js's own internal control-flow signals (DYNAMIC_SERVER_USAGE from using
    // cookies()/headers() during static-generation attempts, redirect(), notFound())
    // are thrown as errors but must never be swallowed — Next relies on them
    // propagating to decide the route is dynamic / to actually redirect.
    if (isNextControlFlowError(err)) throw err;

    // A real Supabase failure: no live project yet in this environment (or an
    // actual outage) — fail to an empty list rather than crashing the whole app
    // shell. The switcher/dashboard already handle a zero-business state.
    console.error("[get-user-businesses] failed to load businesses:", err);
    return [];
  }
});
