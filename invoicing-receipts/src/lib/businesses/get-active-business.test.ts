import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserBusinessesMock = vi.fn();
vi.mock("@/lib/businesses/get-user-businesses", () => ({
  getUserBusinesses: () => getUserBusinessesMock(),
}));

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
}));

const BUSINESS_A = { id: "biz-a", legal_name: "A", display_name: null, entity_type: "murshe" as const, accent_color: "#000" };
const BUSINESS_B = { id: "biz-b", legal_name: "B", display_name: null, entity_type: "patur" as const, accent_color: "#111" };

describe("getActiveBusinessContext", () => {
  beforeEach(() => {
    getUserBusinessesMock.mockReset();
    cookieGetMock.mockReset();
  });

  it("uses the cookie's business when it matches one of the user's businesses", async () => {
    getUserBusinessesMock.mockResolvedValue([BUSINESS_A, BUSINESS_B]);
    cookieGetMock.mockReturnValue({ value: "biz-b" });

    const { getActiveBusinessContext } = await import("./get-active-business");
    const result = await getActiveBusinessContext();

    expect(result.activeBusinessId).toBe("biz-b");
    expect(result.activeBusiness).toEqual(BUSINESS_B);
  });

  it("falls back to the first business when the cookie is missing", async () => {
    getUserBusinessesMock.mockResolvedValue([BUSINESS_A, BUSINESS_B]);
    cookieGetMock.mockReturnValue(undefined);

    const { getActiveBusinessContext } = await import("./get-active-business");
    const result = await getActiveBusinessContext();

    expect(result.activeBusinessId).toBe("biz-a");
  });

  it("falls back to the first business when the cookie points at a business the user no longer has (stale/foreign id)", async () => {
    getUserBusinessesMock.mockResolvedValue([BUSINESS_A, BUSINESS_B]);
    cookieGetMock.mockReturnValue({ value: "some-other-business" });

    const { getActiveBusinessContext } = await import("./get-active-business");
    const result = await getActiveBusinessContext();

    expect(result.activeBusinessId).toBe("biz-a");
  });

  it("returns a null active business when the user has none", async () => {
    getUserBusinessesMock.mockResolvedValue([]);
    cookieGetMock.mockReturnValue(undefined);

    const { getActiveBusinessContext } = await import("./get-active-business");
    const result = await getActiveBusinessContext();

    expect(result.activeBusinessId).toBeNull();
    expect(result.activeBusiness).toBeNull();
  });
});
