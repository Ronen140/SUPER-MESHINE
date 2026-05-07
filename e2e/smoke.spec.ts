import { expect, test } from '@playwright/test';

/**
 * Round 7a placeholder — proves the Playwright runner wires up.
 * Real flows (auth, multi-tenant isolation, end-to-end agent runs) land in 7b+.
 */
test('playwright runner is wired', () => {
  expect(1 + 1).toBe(2);
});
