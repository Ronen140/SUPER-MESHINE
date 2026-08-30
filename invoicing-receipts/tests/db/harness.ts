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

const ADMIN_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../supabase/migrations");
const AUTH_STUB_PATH = path.resolve(import.meta.dirname, "auth-stub.sql");
const STORAGE_STUB_PATH = path.resolve(import.meta.dirname, "storage-stub.sql");

/**
 * The bootstrap `postgres` role in both a local `postgres:16` install and the official
 * `postgres:16` Docker image (used by CI's services container, B13) is an actual Postgres
 * *superuser* — `rolsuper = true`. A superuser bypasses RLS unconditionally, `FORCE` or not
 * (verified empirically: the `business_signing_keys` FORCE canary in `tests/isolation.test.ts`
 * only fails when the table owner is a non-superuser — exactly Supabase's real `postgres`
 * project role, which is documented to be a powerful-but-non-superuser role for precisely
 * this reason, matching ADR-INV-001 Amendment A-4's own stated assumption). Running every
 * migration as the bootstrap superuser would make every `FORCE`-dependent test pass
 * regardless of whether `FORCE` is actually present — a false negative baked into the test
 * environment itself, not the schema. `db_owner` (created once per test database, never
 * superuser) owns every object every migration creates, faithfully reproducing that gap.
 */
const OWNER_ROLE = "db_owner";
const OWNER_PASSWORD = "db_owner";

function urlForDb(name: string, role?: string, password?: string): string {
  const u = new URL(ADMIN_URL);
  if (role) u.username = role;
  if (password) u.password = password;
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
/** Extensions 0001_extensions.sql installs. Not all are `trusted` (moddatetime isn't) —
 * pre-installed by the superuser admin connection below, once per test database, exactly as
 * the real Supabase platform pre-installs extensions during project bootstrap (a real
 * project's `postgres` role never has to — and in vanilla Postgres, structurally cannot —
 * create a non-`trusted` extension itself). `create extension if not exists` in
 * 0001_extensions.sql then no-ops for `db_owner`, without needing its own elevated privilege
 * for extensions that already exist. */
const REQUIRED_EXTENSIONS = ["pgcrypto", "citext", "moddatetime"];

export async function createTestDb(): Promise<TestDb> {
  const name = `inv_test_${randomUUID().replace(/-/g, "")}`;

  // Roles are cluster-wide, not per-database — concurrent Vitest workers (separate
  // processes) each calling `createTestDb()` race on "does this role exist yet", not just on
  // creating it, so each creation tolerates a concurrent duplicate rather than checking
  // existence first. `service_role` needs `BYPASSRLS`, which only the superuser admin
  // connection (not `db_owner` itself — see OWNER_ROLE's comment) can grant, so every
  // Supabase-platform role this project's tests rely on is created here, once, up front.
  for (const stmt of [
    `create role ${OWNER_ROLE} login password '${OWNER_PASSWORD}' createrole`,
    "create role anon nologin",
    "create role authenticated nologin",
    "create role service_role nologin bypassrls",
  ]) {
    try {
      await psql(ADMIN_URL, ["-c", stmt]);
    } catch (error) {
      if (!/already exists/.test((error as Error).message)) throw error;
    }
  }
  // `db_owner` needs to be able to `SET ROLE` into all three — creating a role does not by
  // itself grant the creator membership in it.
  await psql(ADMIN_URL, ["-c", `grant anon, authenticated, service_role to ${OWNER_ROLE}`]);

  await psql(ADMIN_URL, ["-c", `create database ${name} owner ${OWNER_ROLE}`]);

  const superuserUrlForNewDb = urlForDb(name);
  // `public` (and every other schema inherited from `template1`) is NOT retroactively
  // reassigned by `CREATE DATABASE ... OWNER` — only the pg_database row's owner changes.
  // Transfer `public`'s ownership explicitly (must be done by the superuser admin
  // connection: only an object's current owner, or a superuser, may reassign it).
  await psql(superuserUrlForNewDb, ["-c", `alter schema public owner to ${OWNER_ROLE}`]);
  for (const ext of REQUIRED_EXTENSIONS) {
    await psql(superuserUrlForNewDb, ["-c", `create extension if not exists "${ext}"`]);
  }

  const url = urlForDb(name, OWNER_ROLE, OWNER_PASSWORD);
  await psql(url, ["-f", AUTH_STUB_PATH]);
  await psql(url, ["-f", STORAGE_STUB_PATH]);
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
   * `db_owner` (the connection's own role — the non-superuser owner of every migrated
   * object, used for fixture setup; RLS-exempt only for tables without `FORCE`). */
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
