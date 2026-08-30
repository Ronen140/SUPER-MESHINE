import { z } from "zod";

/**
 * Business-creation form schema (F3). Mirrors the columns `POST /api/businesses`
 * actually accepts (`src/app/api/businesses/route.ts`'s own zod schema, which in turn
 * mirrors `public.create_business()`'s parameters — ADR-INV-001 §D10): `legal_name`,
 * `entity_type`, `tax_id`, `display_name`. `tax_id` is validated against the exact same
 * 9-digit regex as the DB's `tax_id_digits` CHECK constraint and the API route — no
 * check-digit/checksum algorithm is defined anywhere in the schema (ADR-INV-001's
 * `businesses` table only enforces digit count), so none is added here either.
 *
 * Deliberately does *not* include address fields — out of F3 scope (spec review,
 * vault/Reviews/spec/2026-08-30-invoicing-f3-f4.md). The page tells the user address
 * details are added later via business settings (Phase 1).
 */
export const businessSchema = z.object({
  legal_name: z.string().trim().min(1, "יש להזין שם חוקי לעסק."),
  entity_type: z.enum(["patur", "murshe"], "יש לבחור סוג עסק."),
  tax_id: z.string().regex(/^\d{9}$/, "מספר עוסק/ח.פ חייב להיות בן 9 ספרות."),
  display_name: z.string().trim().min(1).optional().or(z.literal("")),
});

export type BusinessInput = z.infer<typeof businessSchema>;
