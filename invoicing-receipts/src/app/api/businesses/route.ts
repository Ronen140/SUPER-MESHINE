import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/businesses — B9 (ADR-INV-001 §D10, Amendment A-3 / Implementation Notes #11).
 *
 * Two deliberately separate steps, never unified into one call:
 *   1. `supabase.rpc('create_business', {...})` — atomic (SECURITY DEFINER, one transaction).
 *   2. Only *after* that succeeds, `POST /api/keygen` (a separate Vercel Python function,
 *      `api/keygen.py`) generates and stores the signing key.
 * "אין לאחד את שני השלבים (קריאת HTTP מתוך Postgres)" — a Postgres function must never make
 * an outbound HTTP call itself, so this route (not the RPC) is what sequences the two.
 *
 * A keygen failure does *not* fail this request or roll back the business — the business
 * already exists validly with no signing key, a handled state
 * (`public.issue_document()` raises `INV_NO_SIGNING_KEY` until a key exists; the frontend
 * shows a retry banner, ADR-INV-001 §D10).
 */

const bodySchema = z.object({
  legal_name: z.string().trim().min(1),
  entity_type: z.enum(["patur", "murshe"]),
  tax_id: z.string().regex(/^\d{9}$/, "tax_id must be exactly 9 digits"),
  tax_id_type: z.string().trim().min(1).optional(),
  display_name: z.string().trim().min(1).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "INV_BAD_REQUEST: invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `INV_BAD_REQUEST: ${parsed.error.issues.map((i) => i.message).join("; ")}` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: business, error } = await supabase.rpc("create_business", {
    p_legal_name: parsed.data.legal_name,
    p_entity_type: parsed.data.entity_type,
    p_tax_id: parsed.data.tax_id,
    p_tax_id_type: parsed.data.tax_id_type ?? "vat",
    p_display_name: parsed.data.display_name ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const signingKeyError = await requestSigningKey(request, business);

  return NextResponse.json({ business, signingKeyError }, { status: 200 });
}

async function requestSigningKey(
  request: Request,
  business: { id: string; legal_name: string; tax_id: string },
): Promise<string | null> {
  try {
    const keygenUrl = new URL("/api/keygen", request.url);
    const response = await fetch(keygenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: business.id,
        legal_name: business.legal_name,
        tax_id: business.tax_id,
      }),
    });
    return response.ok ? null : "INV_NO_SIGNING_KEY";
  } catch {
    return "INV_NO_SIGNING_KEY";
  }
}
