import { z } from 'zod';

/**
 * Schema describing what Claude (or the demo branch) returns to the route handler.
 * The route handler validates Claude's JSON response against this before forwarding to the UI,
 * so a malformed model output becomes a clean 502 rather than a runtime crash on the client.
 */
export const IdentifyCandidateSchema = z.object({
  sku: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
});

export const IdentifyResponseSchema = z.object({
  candidates: z.array(IdentifyCandidateSchema).min(1).max(3),
  disambiguatingQuestion: z.string().nullable(),
  mode: z.enum(['demo', 'live']),
});

export type IdentifyCandidate = z.infer<typeof IdentifyCandidateSchema>;
export type IdentifyResponse = z.infer<typeof IdentifyResponseSchema>;
