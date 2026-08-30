/**
 * Next.js App Router signals certain internal control-flow events (redirect(),
 * notFound(), and — critically here — a Server Component using cookies()/headers()
 * during a static-generation attempt) by *throwing* an error with a `digest` string
 * starting with a reserved prefix. Per Next's own docs, these must always be allowed
 * to propagate — never caught and swallowed by a generic `try/catch` — or Next can't
 * correctly mark the route dynamic / perform the redirect.
 *
 * Any broad `catch` block wrapping a Server Component data-fetch (e.g.
 * `get-user-businesses.ts`, which deliberately fails-open to `[]` on a *real*
 * Supabase error) must check this first and re-throw if it matches.
 */
const RESERVED_DIGEST_PREFIXES = ["DYNAMIC_SERVER_USAGE", "NEXT_REDIRECT", "NEXT_NOT_FOUND"];

export function isNextControlFlowError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return RESERVED_DIGEST_PREFIXES.some((prefix) => digest.startsWith(prefix));
}
