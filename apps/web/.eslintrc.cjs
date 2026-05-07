/**
 * apps/web ESLint config.
 *
 * Adopts the shared base from `@super-meshine/config` (which extends
 * `next/core-web-vitals` + `react-hooks`). Biome handles formatting + the
 * generic JS/TS lints; ESLint is kept solely for the Next-specific rules
 * and the React-hooks rules per ADR-003 §Biome+ESLint hybrid.
 */
module.exports = {
  root: true,
  extends: ['@super-meshine/config/eslint.base.cjs'],
};
