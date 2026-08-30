import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client authenticated with the `service_role` key.
 * Bypasses RLS entirely (`FORCE ROW LEVEL SECURITY` does not apply to it).
 *
 * Only the three call sites named in ADR-INV-001 §D5 may use this: the PDF
 * signing pipeline, the public document-viewer route, and the nightly
 * backup/export job. Every other read/write path must go through the
 * `authenticated` RLS-scoped client or a `SECURITY DEFINER` Postgres function.
 *
 * Import boundary is enforced by `biome.json` (`noRestrictedImports`) — see
 * src/server/service-role/README.md.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "createServiceRoleClient: NEXT_PUBLIC_SUPABASE_URL is not set. See .env.example.",
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "createServiceRoleClient: SUPABASE_SERVICE_ROLE_KEY is not set. See .env.example.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
