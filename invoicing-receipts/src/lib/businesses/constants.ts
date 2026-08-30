/**
 * Cookie that remembers the user's active business across requests (F4). `httpOnly` —
 * only ever read/written server-side (src/app/(app)/businesses/actions.ts,
 * src/app/(app)/layout.tsx); the client never needs to read the raw cookie value, it
 * receives the resolved active business as a prop instead.
 */
export const ACTIVE_BUSINESS_COOKIE = "active_business_id";
