/**
 * @super-meshine/db — public surface.
 *
 * Round 7a exposes only the connection factory and the multi-tenancy primitive.
 * Real entity schemas + typed query functions arrive in 7b.
 */
export { createDb } from './client.js';
export type { Db } from './client.js';
export { withTenant } from './with-tenant.js';
export type { Tx } from './with-tenant.js';
export * as schema from './schema/index.js';
