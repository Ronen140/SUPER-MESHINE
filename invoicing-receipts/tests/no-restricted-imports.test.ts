import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Regression guard for ADR-INV-001 §D5: nothing outside src/server/service-role/ may
 * import from it. biome.json enforces this via `noRestrictedImports`
 * (pattern `**\/service-role/**`) — this test proves that rule still fires by actually
 * running Biome against a throwaway fixture, rather than trusting the config never
 * silently regresses (e.g. an accidental biome.json edit, a Biome major-version config
 * schema change, or the fixture path falling outside biome's `includes`).
 *
 * Fixture files are written under src/app/ (already covered by biome.json's `includes`)
 * and always removed in `afterEach`, even if an assertion fails.
 */

const projectRoot = path.resolve(import.meta.dirname, "..");
const biomeBin = path.join(projectRoot, "node_modules", ".bin", "biome");
const fixturePath = path.join(projectRoot, "src", "app", "__no-restricted-imports-fixture.ts");

function runBiomeLint(): { exitCode: number; output: string } {
  try {
    const output = execFileSync(biomeBin, ["lint", fixturePath], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: err.status ?? 1, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("noRestrictedImports guard on src/server/service-role", () => {
  afterEach(() => {
    rmSync(fixturePath, { force: true });
  });

  it("fails biome lint for an external import of service-role via the @ alias", () => {
    mkdirSync(path.dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      'import { createServiceRoleClient } from "@/server/service-role/client";\n' +
        "export const x = createServiceRoleClient;\n",
    );

    const result = runBiomeLint();

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("noRestrictedImports");
  });

  it("does not flag an unrelated external import (control: rule targets service-role specifically)", () => {
    mkdirSync(path.dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      'import { createClient } from "@supabase/supabase-js";\nexport const x = createClient;\n',
    );

    const result = runBiomeLint();

    expect(result.output).not.toContain("noRestrictedImports");
  });
});
