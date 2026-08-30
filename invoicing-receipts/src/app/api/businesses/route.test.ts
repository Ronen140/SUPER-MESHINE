import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

const { POST } = await import("./route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  legal_name: "Acme Co",
  entity_type: "murshe",
  tax_id: "123456789",
};

const CREATED_BUSINESS = {
  id: "11111111-1111-1111-1111-111111111111",
  legal_name: "Acme Co",
  entity_type: "murshe",
  tax_id: "123456789",
};

describe("POST /api/businesses", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    rpcMock.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 400 for an invalid body without calling create_business", async () => {
    const response = await POST(jsonRequest({ legal_name: "" }));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a tax_id that is not exactly 9 digits", async () => {
    const response = await POST(jsonRequest({ ...VALID_BODY, tax_id: "123" }));
    expect(response.status).toBe(400);
  });

  it("calls create_business with the RPC's exact p_-prefixed parameter names", async () => {
    rpcMock.mockResolvedValue({ data: CREATED_BUSINESS, error: null });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await POST(jsonRequest(VALID_BODY));

    expect(rpcMock).toHaveBeenCalledWith("create_business", {
      p_legal_name: "Acme Co",
      p_entity_type: "murshe",
      p_tax_id: "123456789",
      p_tax_id_type: "vat",
      p_display_name: null,
    });
  });

  it("propagates a create_business RPC error and never calls keygen", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "INV_TAX_ID_EXISTS: a business with this tax_id already exists" },
    });

    const response = await POST(jsonRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("INV_TAX_ID_EXISTS");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("on success, calls /api/keygen separately (not unified with create_business) and returns the business", async () => {
    rpcMock.mockResolvedValue({ data: CREATED_BUSINESS, error: null });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const response = await POST(jsonRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.business).toEqual(CREATED_BUSINESS);
    expect(body.signingKeyError).toBeNull();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    if (!call) throw new Error("expected fetch to have been called");
    const [url, init] = call;
    expect(String(url)).toContain("/api/keygen");
    expect(JSON.parse(init.body as string)).toEqual({
      business_id: CREATED_BUSINESS.id,
      legal_name: CREATED_BUSINESS.legal_name,
      tax_id: CREATED_BUSINESS.tax_id,
    });
  });

  it("a keygen failure does not fail business creation — returns 200 with signingKeyError set", async () => {
    rpcMock.mockResolvedValue({ data: CREATED_BUSINESS, error: null });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const response = await POST(jsonRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.business).toEqual(CREATED_BUSINESS);
    expect(body.signingKeyError).toBe("INV_NO_SIGNING_KEY");
  });

  it("a keygen network exception (fetch throws) is also handled as signingKeyError, not a 500", async () => {
    rpcMock.mockResolvedValue({ data: CREATED_BUSINESS, error: null });
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));

    const response = await POST(jsonRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.signingKeyError).toBe("INV_NO_SIGNING_KEY");
  });
});
