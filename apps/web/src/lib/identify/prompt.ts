import { getCatalogForPrompt } from '@/lib/mock-inventory';

/**
 * Single source of truth for the Claude vision model used by the identify route.
 * Sonnet was chosen over Opus (5x cheaper per call, vision quality good enough for the demo)
 * and over Haiku (Haiku's vision is noticeably weaker on cluttered warehouse-shelf shots).
 * Change this constant to swap models — no other file should mention a model id.
 */
export const IDENTIFY_MODEL = 'claude-sonnet-4-6' as const;

/**
 * Builds the system prompt sent to Claude. The catalog is embedded inline (compact one-line-
 * per-item format from `getCatalogForPrompt`) so Claude can match a photo against the seeded
 * inventory without us needing a vector store for the prototype.
 *
 * Optional `disambiguationAnswer` is appended when the worker has answered a clarifying
 * question on the second call — this lets Claude refine its earlier candidate ranking.
 */
export function buildSystemPrompt(disambiguationAnswer?: string): string {
  const catalog = getCatalogForPrompt();

  const baseInstructions = [
    'You are an inventory identification assistant for a small Israeli manufacturing plant.',
    'A warehouse worker has photographed an item from a shelf. Match the photo to entries in the seeded catalog below.',
    '',
    'CATALOG (one item per line — format: SKU | name | visualDescription | RM: rawMaterial):',
    catalog,
    '',
    'OUTPUT — respond with strict JSON only, no prose, no markdown fence:',
    '{',
    '  "candidates": [',
    '    { "sku": "<exact SKU from catalog>", "confidence": <0..1>, "reasoning": "<≤200 chars>" }',
    '  ],',
    '  "disambiguatingQuestion": "<one short question>" | null',
    '}',
    '',
    'RULES:',
    '- Return 1 to 3 candidates, ordered by descending confidence.',
    '- Every SKU you return MUST appear verbatim in the catalog above. Do not invent SKUs.',
    '- If the top candidate confidence is < 0.85, include a disambiguatingQuestion that, if answered, would let you narrow the list. The question must be answerable in one short phrase (e.g., "Is the material metallic or plastic?", "Is this larger or smaller than 50mm?").',
    '- If confidence ≥ 0.85, set disambiguatingQuestion to null.',
    '- Be honest about confidence — many items in this catalog are visually identical and differ only by raw material composition that a photo cannot reveal. Lower confidence is correct in those cases.',
  ];

  if (disambiguationAnswer && disambiguationAnswer.trim().length > 0) {
    baseInstructions.push(
      '',
      'PRIOR CONTEXT — the worker was asked a clarifying question on a previous call and answered:',
      `"${disambiguationAnswer.trim()}"`,
      'Use this answer to refine your candidate list. Confidence should now be higher for matches consistent with the answer.',
    );
  }

  return baseInstructions.join('\n');
}
