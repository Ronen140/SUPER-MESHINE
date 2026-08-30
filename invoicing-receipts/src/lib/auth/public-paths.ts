/**
 * Route-protection policy for `src/middleware.ts` (F2, ADR-INV-001 D3/D3.1).
 *
 * Every route is protected by default. Only auth routes (and Next.js internals /
 * static assets, filtered separately by the middleware `matcher`) are public.
 * Pure function so the policy is unit-testable without spinning up a request.
 */
const PUBLIC_PATH_PREFIXES = ["/login", "/signup", "/auth"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
