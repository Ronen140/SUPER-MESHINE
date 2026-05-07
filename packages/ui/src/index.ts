/**
 * @super-meshine/ui — public surface.
 *
 * Re-exports primitives and helpers consumed by `apps/web` (and any future
 * client). Components live under `src/components/`; helpers under `src/lib/`.
 * The Tailwind 4 stylesheet is imported directly via the package export
 * `@super-meshine/ui/styles/globals.css`.
 */
export { Button, buttonVariants, type ButtonProps } from './components/button.js';
export { cn } from './lib/utils.js';
export { designTokens, type DesignTokens } from './tailwind.preset.js';
