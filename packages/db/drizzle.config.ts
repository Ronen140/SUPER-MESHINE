import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for SUPER-MESHINE.
 *
 * Two connection strings per ADR-003:
 *   - DATABASE_URL — pooled (Supabase Pooler, port 6543, transaction mode) for runtime tRPC.
 *   - DIRECT_URL  — direct (port 5432) for `drizzle-kit migrate` only.
 *
 * Schema folder is empty in Round 7a; real tables arrive in 7b.
 */
export default {
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config;
