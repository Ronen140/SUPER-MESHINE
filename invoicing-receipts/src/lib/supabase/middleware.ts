import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the Supabase session cookies on every request and reports the
 * current user (or null). Called from src/middleware.ts, which owns the
 * route-protection decision (src/lib/auth/public-paths.ts).
 *
 * If the Supabase env vars are not configured yet (no live project — see
 * vault/Engineering/invoicing-phase-0-plan.md Open Question #3), this fails
 * open to "no user" instead of throwing on every request, so the app shell
 * still renders (redirected to /login) while Supabase is being connected.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: { id: string } | null }> {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response, user: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { response, user };
  } catch {
    // Network/DNS failure reaching an unconfigured or unreachable Supabase
    // project — treat as unauthenticated rather than 500ing every request.
    return { response, user: null };
  }
}
