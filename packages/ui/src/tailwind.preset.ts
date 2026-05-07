/**
 * Tailwind 4 preset — design-token export.
 *
 * Tailwind 4 is CSS-first, so the canonical place for tokens is
 * `src/styles/globals.css` (consumed via `@import` from the app).
 * This preset exists as a typed mirror so non-CSS consumers (e.g. token
 * docs, a future Storybook config, or programmatic theme tooling)
 * have a single import to reach for.
 */
export const designTokens = {
  colors: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(0 0% 3.9%)',
    primary: 'hsl(0 0% 9%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(0 0% 96.1%)',
    secondaryForeground: 'hsl(0 0% 9%)',
    muted: 'hsl(0 0% 96.1%)',
    mutedForeground: 'hsl(0 0% 45.1%)',
    accent: 'hsl(0 0% 96.1%)',
    accentForeground: 'hsl(0 0% 9%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    destructiveForeground: 'hsl(0 0% 98%)',
    border: 'hsl(0 0% 89.8%)',
    input: 'hsl(0 0% 89.8%)',
    ring: 'hsl(0 0% 3.9%)',
  },
  radius: '0.5rem',
  fontFamily: {
    sans: [
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ],
  },
} as const;

export type DesignTokens = typeof designTokens;
