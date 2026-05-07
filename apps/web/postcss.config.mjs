/**
 * Tailwind 4 PostCSS plugin (per ADR-003 §Tailwind 4).
 * The legacy `tailwindcss` PostCSS plugin is gone in v4 — `@tailwindcss/postcss`
 * is the replacement.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
