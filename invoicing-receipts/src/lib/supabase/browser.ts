import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser (Client Component) Supabase client. `anon` key only — RLS-scoped,
 * never `service_role` (ADR-INV-001 §D5).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "createClient (browser): NEXT_PUBLIC_SUPABASE_URL is not set. See .env.example.",
    );
  }
  if (!anonKey) {
    throw new Error(
      "createClient (browser): NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. See .env.example.",
    );
  }

  return createBrowserClient(url, anonKey);
}
