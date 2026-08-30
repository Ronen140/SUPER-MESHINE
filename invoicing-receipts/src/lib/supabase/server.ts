import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server (Server Component / Route Handler / Server Action) Supabase client.
 * `anon` key only — auth comes from the request's cookies, RLS still applies
 * (ADR-INV-001 §D5: `service_role` is limited to `src/server/service-role/`).
 *
 * Must be awaited fresh per request — do not cache the returned client.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "createClient (server): NEXT_PUBLIC_SUPABASE_URL is not set. See .env.example.",
    );
  }
  if (!anonKey) {
    throw new Error(
      "createClient (server): NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. See .env.example.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `cookies().set()` throws when called from a Server Component render
          // (no mutable response yet). Session-refresh cookies are written
          // instead by src/middleware.ts on every request — safe to ignore here.
        }
      },
    },
  });
}
