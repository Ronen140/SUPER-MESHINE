# SUPER-MESHINE

ERP דור חדש, AI-native. סוכני AI אוטונומיים, התאמה אישית בשפה טבעית, Copilot מובנה.

## סטטוס

Bootstrap — בונה תשתית פיתוח מבוססת-סוכנים. עוד אין מוצר.

## ארכיטקטורה (high-level)

צוות פיתוח של סוכני Claude (architect, backend-builder, frontend-builder, schema-architect, erp-domain-expert, spec-reviewer, code-quality-reviewer, erp-qa) שמתואמים ע"י CEO (המייסד + Claude הראשי), מבוססים על דפוס מוכח מ-`the-five-aegents`.

המוצר עצמו מכיל שלוש שכבות AI:
1. **Process Agents** — מבצעים תהליכי ליבה (רכש, ייצור, גבייה) אוטונומית.
2. **Customization Agent** — שינוי schema/UI מתיאור בשפה טבעית, במקום implementer ידני.
3. **Copilot** — עוזר בכל מסך, RBAC-aware.

## מבנה ספריות

```
.claude/
  agents/      ← הגדרות סוכני פיתוח
  skills/      ← skills משותפים (subagent-driven-development וכו')
  commands/    ← slash-commands
vault/         ← זיכרון ארוך טווח (Obsidian)
apps/          ← (בעתיד) frontend + backend
packages/      ← (בעתיד) shared libs, db, agents
mcp/           ← (בעתיד) MCP servers פנימיים
```

## תוכנית מלאה

`C:\Users\ronen\.claude\plans\lively-juggling-starlight.md`

## Local development

### Prerequisites

- **Node 22 LTS** — install via [fnm](https://github.com/Schniz/fnm) (recommended on Windows) or use the bundled `.nvmrc` (`22`). ADR-003 pins Node 22; Node 24 is not supported in this round.
- **pnpm 9** — `npm install -g pnpm@9`. Root `package.json` pins `packageManager: "pnpm@9.12.0"`.
- **Docker Desktop** — required by `supabase start` (the local Supabase stack runs Postgres + Auth + Storage + Realtime in containers). Make sure Docker Desktop is running before you call `supabase start`.
- **Supabase CLI** — Windows install: `scoop install supabase` or download the standalone binary from <https://github.com/supabase/cli/releases>. Verify with `supabase --version`.
- **Microsoft Visual C++ Redistributable (Windows only)** — required by the native `better-sqlite3` / `esbuild` binaries that Drizzle and Vitest pull in. If `pnpm install` errors with "missing UCRT DLLs" or similar, install the latest VC++ Redistributable from <https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist>.

### First-time setup

```bash
# 1. Install workspace dependencies (root + all packages).
pnpm install

# 2. Initialize the local Supabase project (only needed once; commits supabase/config.toml — already in repo).
supabase init

# 3. Boot the local Supabase stack (Postgres + Auth + Storage + Realtime). Requires Docker Desktop to be running.
supabase start

# 4. Copy the env template, then fill values from `supabase status` output (DB URL, Anon key, Service role key).
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
#   Then edit both .env.local files with the values printed by `supabase status`.

# 5. Run migrations against the local DB (no-op in Round 7a — no schema yet — but verifies the script wires up).
pnpm db:migrate

# 6. Start the dev server (Next.js on http://localhost:3000).
pnpm dev
```

Open <http://localhost:3000> — you should see the "hello world" page with `Status: ok` and a timestamp from the tRPC `health.check` procedure.

### Common scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Boot all dev servers (Next.js, MCP server) via Turborepo. |
| `pnpm build` | Build every package + app. |
| `pnpm test` | Run Vitest across all packages (unit + integration). |
| `pnpm e2e` | Run Playwright E2E tests (currently empty — config only). Run `pnpm exec playwright install chromium` once before first use. |
| `pnpm typecheck` | TypeScript project-wide check. |
| `pnpm lint` | Biome lint. |
| `pnpm format` | Biome format-write. |
| `pnpm db:generate` | Drizzle migration generation. |
| `pnpm db:migrate` | Apply migrations to the configured DB. |

### Troubleshooting

- **`supabase start` fails with "Cannot connect to the Docker daemon"** — Docker Desktop is not running. Start Docker Desktop and wait for the whale icon to turn green, then retry.
- **`pnpm install` fails on Windows with errors about missing UCRT DLLs (`api-ms-win-crt-*.dll`)** — install the latest Microsoft Visual C++ Redistributable (link in Prerequisites above) and reboot. Native Node modules (`esbuild`, `better-sqlite3`) require the UCRT runtime.
- **`pnpm e2e` fails with "browserType.launch: Executable doesn't exist"** — run `pnpm exec playwright install chromium` to download the browser binaries (one-time, ~150 MB).
- **`supabase status` shows the stack is down** — re-run `supabase start`. If it still fails, `supabase stop --no-backup && supabase start` resets the local containers cleanly.
