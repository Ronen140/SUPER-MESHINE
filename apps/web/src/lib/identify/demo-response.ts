import { findItemBySku } from '@/lib/mock-inventory';
import type { IdentifyResponse } from './schema';

/**
 * Hardcoded demo response — load-bearing path for screencasts and offline demos.
 *
 * Shows the prototype's compelling case: three candidates, all from the visually-identical
 * cylindrical-pin cluster (M-PIN-304, M-PIN-316L, M-PIN-AL6061). Confidence values are
 * believable (0.92 / 0.78 / 0.41 — top candidate is reasonably sure but not certain) and
 * trigger the disambiguation flow naturally.
 *
 * If the top candidate's confidence drops below 0.85, the disambiguating question fires —
 * "Is the material magnetic?" splits stainless steels (yes/maybe) from aluminum (no).
 *
 * The route handler artificially delays this response by ~1.2s so the UI's loading state
 * appears believable during recording.
 */
export const DEMO_RESPONSE: IdentifyResponse = {
  candidates: [
    {
      sku: 'M-PIN-304',
      confidence: 0.92,
      reasoning:
        'Cylindrical metal pin matching the geometry. Surface luster suggests stainless rather than anodized aluminum.',
    },
    {
      sku: 'M-PIN-316L',
      confidence: 0.78,
      reasoning:
        'Identical geometry to top match. Distinguishable from 304 only by raw-material certificate, not by visual cue.',
    },
    {
      sku: 'M-PIN-AL6061',
      confidence: 0.41,
      reasoning:
        'Same geometry but anodized aluminum surface looks subtly different from raw stainless. Lower-confidence fallback.',
    },
  ],
  disambiguatingQuestion: 'Is the material magnetic to a small magnet held nearby?',
  mode: 'demo',
};

/**
 * Demo-mode follow-up response after the worker answers the disambiguating question.
 * Used when the second call to /api/identify includes a `disambiguationAnswer`.
 *
 * If the worker says "yes" (magnetic) → 304 stainless wins, others drop.
 * If "no" (non-magnetic) → still 316L or aluminum; 316L is still slightly magnetic so
 * a "no" answer pushes confidence to AL6061. We fake the "no" branch here for the demo.
 */
export const DEMO_RESPONSE_AFTER_ANSWER: IdentifyResponse = {
  candidates: [
    {
      sku: 'M-PIN-AL6061',
      confidence: 0.95,
      reasoning:
        'Worker reports the part is not magnetic. This rules out both stainless variants — the only non-magnetic candidate is aluminum 6061.',
    },
  ],
  disambiguatingQuestion: null,
  mode: 'demo',
};

/**
 * Sanity-check at module load that all SKUs referenced above actually exist in the catalog.
 * Throws at import time if a typo creeps in — much better than silent UI breakage.
 */
const _allReferencedSkus = [
  ...DEMO_RESPONSE.candidates.map((c) => c.sku),
  ...DEMO_RESPONSE_AFTER_ANSWER.candidates.map((c) => c.sku),
];
for (const sku of _allReferencedSkus) {
  if (!findItemBySku(sku)) {
    throw new Error(
      `Demo response references unknown SKU "${sku}" — fix demo-response.ts or mock-inventory.ts`,
    );
  }
}
