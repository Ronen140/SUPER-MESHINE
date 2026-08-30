"use server";

import { cookies } from "next/headers";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/businesses/constants";
import { createClient } from "@/lib/supabase/server";

/**
 * F4 business switcher: persists which business is "active" in an httpOnly cookie so
 * every Server Component on the next request (starting with src/app/(app)/layout.tsx)
 * can scope itself to it.
 *
 * Ownership is re-verified here rather than trusted from the client: RLS
 * (`businesses_read`, ADR-INV-001 §D3.1) silently excludes any business the caller
 * isn't a member of, so a `SELECT ... WHERE id = $1` returning zero rows means "not
 * mine" regardless of whether the id is malformed, unknown, or someone else's business.
 */
export async function setActiveBusinessId(
  businessId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "העסק המבוקש לא נמצא או שאין לך גישה אליו." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true };
}
