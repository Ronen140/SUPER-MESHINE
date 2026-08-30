import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

const cookieSetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock }),
}));

const { setActiveBusinessId } = await import("./actions");

describe("setActiveBusinessId", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    eqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
    cookieSetMock.mockReset();
  });

  const NOT_MINE_ID = "11111111-1111-4111-8111-111111111111";
  const OWNED_ID = "22222222-2222-4222-8222-222222222222";

  it("rejects an obviously malformed business id before ever querying the database", async () => {
    const result = await setActiveBusinessId("biz-1");

    expect(result.ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("rejects a business the user is not a member of (RLS returns no row)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await setActiveBusinessId(NOT_MINE_ID);

    expect(result.ok).toBe(false);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("rejects on a query error without setting the cookie", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await setActiveBusinessId(OWNED_ID);

    expect(result.ok).toBe(false);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("sets an httpOnly cookie for a business the user owns", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: OWNED_ID }, error: null });

    const result = await setActiveBusinessId(OWNED_ID);

    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("businesses");
    expect(eqMock).toHaveBeenCalledWith("id", OWNED_ID);
    expect(cookieSetMock).toHaveBeenCalledWith(
      "active_business_id",
      OWNED_ID,
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });
});
