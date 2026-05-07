import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — merge Tailwind class strings safely.
 *
 * Combines `clsx` (conditional class composition) with `tailwind-merge`
 * (de-duplicates conflicting Tailwind utilities, e.g. `px-2 px-4` -> `px-4`).
 * This is the canonical helper used by every shadcn primitive in the repo.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
