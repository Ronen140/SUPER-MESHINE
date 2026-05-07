/**
 * Shared ESLint base for SUPER-MESHINE.
 *
 * Per ADR-003: Biome owns formatting + most lints. ESLint is intentionally minimal
 * and applied ONLY inside `apps/web` for the two rule sets Biome doesn't yet cover well:
 *   - eslint-plugin-react-hooks
 *   - @next/eslint-plugin-next (via next/core-web-vitals)
 *
 * Stylistic rules are disabled — Biome owns formatting.
 */
module.exports = {
  root: false,
  extends: ['next/core-web-vitals', 'plugin:react-hooks/recommended'],
  rules: {
    // Biome owns formatting; explicitly do not enable any stylistic ESLint rules here.
  },
  ignorePatterns: ['.next', 'node_modules', 'dist', '.turbo'],
};
