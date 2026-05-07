# @super-meshine/config

Shared tooling configuration for the SUPER-MESHINE monorepo.

Three artifacts are exported:

- `tsconfig.base.json` — TypeScript strict-mode base. Other packages extend it via
  `"extends": "@super-meshine/config/tsconfig.base.json"`.
- `biome.base.json` — Biome formatter + linter base. The repo-root `biome.json`
  extends it; per-package `biome.json` files (if any) extend it as well.
- `eslint.base.cjs` — minimal ESLint config used **only** inside `apps/web` for
  the React-hooks and Next.js rule sets that Biome does not cover. Per ADR-003,
  Biome owns formatting and the bulk of linting; ESLint is augmentation only.

This package ships no runtime code.
