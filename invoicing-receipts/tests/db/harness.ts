/**
 * Throwaway-Postgres test harness shared by every DB-level test in this suite
 * (Addendum A′ regression tests, the B11 isolation suite, the B12 numbering-race test).
 *
 * Deliberately shells out to the `psql` CLI instead of adding a Postgres client library
 * (`pg`) as a new npm dependency — this project's hard rule #7 requires flagging/approval
 * before adding any new dependency, and `tests/no-restricted-imports.test.ts` already
 * established the precedent of shelling out to an external tool (`biome`) from a Vitest test
 * rather than reaching for a library. `psql` is already a required tool for this project
 * regardless (every migration is applied via `psql`/`supabase migration up` in dev and CI),
 * so this adds no new tooling surface.
 *
 * Connects over TCP with `DATABASE_URL` (defaults to the conventional
 * `postgres:16` GitHub Actions services-container credentials, `postgres`/`postgres` on
 * `localhost:5432`) rather than the Unix-socket peer auth used elsewhere in this project's
 * manual verification — CI's services container only exposes TCP, so the harness is written
 * once, the same way, for both local `pnpm test` and CI.
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../supabase/migrations");
const AUTH_STUB_PATH = path.resolve(import.meta.dirname, "auth-stub.sql");

function urlForDb(name: string): string {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${name}`;
  return u.toString();
}

async function psql(url: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "psql",
      [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", ...args],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return stdout;
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    // Re-throw with stdout+stderr concatenated so callers can assert on INV_* codes that
    // Postgres printed via RAISE EXCEPTION regardless of which stream psql routed them to.
    throw new Error(`${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}`);
  }
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

export interface TestDb {
  url: string;
  name: string;
}

/**
 * Creates a fresh, uniquely-named database, applies the test auth stub and every migration
 * in `supabase/migrations/` (in filename order — 0001, 0002, ... 0010, ...) exactly as CI's
 * down/up roundtrip and the real Supabase project do.
 */
export async function createTestDb(): Promise<TestDb> {
  const name = `inv_test_${randomUUID().replace(/-/g, "")}`;
  await psql(ADMIN_URL, ["-c", `create database ${name}`]);
  const url = urlForDb(name);
  await psql(url, ["-f", AUTH_STUB_PATH]);
  for (const file of migrationFiles()) {
    await psql(url, ["-f", file]);
  }
  return { url, name };
}

export async function dropTestDb(db: TestDb): Promise<void> {
  await psql(ADMIN_URL, [
    "-c",
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${db.name}' and pid <> pg_backend_pid()`,
  ]);
  await psql(ADMIN_URL, ["-c", `drop database if exists ${db.name}`]);
}

export interface RunAs {
  /** auth.uid() for the statement — sets `request.jwt.claim.sub` before running. */
  userId?: string;
  /** Postgres role to run as. Defaults to `authenticated` when `userId` is set, otherwise
   * the raw admin/superuser connection role (used for fixture setup, which intentionally
   * bypasses RLS). */
  role?: "anon" | "authenticated" | "service_role";
}

/**
 * Runs one or more `;`-separated SQL statements against `db` inside a single transaction,
 * optionally impersonating a business member. Returns raw psql `-t -A` output (tuples only,
 * unaligned, tab-separated fields) for the caller to parse. Throws (with the Postgres error
 * text, including any `INV_*` code) if any statement in the batch fails — callers expecting
 * a failure should wrap the call in `await expect(...).rejects.toThrow(...)`.
 */
export async function runSql(db: TestDb, sql: string, as?: RunAs): Promise<string> {
  const role = as?.role ?? (as?.userId ? "authenticated" : undefined);
  const preamble = [
    role ? `set local role ${role};` : "",
    as?.userId ? `set local request.jwt.claim.sub = '${as.userId}';` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const script = `begin;\n${preamble}\n${sql}\ncommit;\n`;
  return psql(db.url, ["-t", "-A", "-F", "\t", "-c", script]);
}
