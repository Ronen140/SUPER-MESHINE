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

  it("rejects a business the user is not a member of (RLS returns no row)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await setActiveBusinessId("biz-not-mine");

    expect(result.ok).toBe(false);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("rejects on a query error without setting the cookie", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await setActiveBusinessId("biz-1");

    expect(result.ok).toBe(false);
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("sets an httpOnly cookie for a business the user owns", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: "biz-1" }, error: null });

    const result = await setActiveBusinessId("biz-1");

    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("businesses");
    expect(eqMock).toHaveBeenCalledWith("id", "biz-1");
    expect(cookieSetMock).toHaveBeenCalledWith(
      "active_business_id",
      "biz-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });
});
