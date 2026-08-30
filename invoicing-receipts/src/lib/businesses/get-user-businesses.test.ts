import { describe, expect, it, vi } from "vitest";

const orderMock = vi.fn();
const selectMock = vi.fn(() => ({ order: orderMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

const { getUserBusinesses } = await import("./get-user-businesses");

describe("getUserBusinesses", () => {
  it("queries businesses ordered by creation date, relying on RLS for scoping", async () => {
    orderMock.mockResolvedValue({ data: [{ id: "biz-1" }], error: null });

    const result = await getUserBusinesses();

    expect(fromMock).toHaveBeenCalledWith("businesses");
    expect(selectMock).toHaveBeenCalledWith(
      "id, legal_name, display_name, entity_type, accent_color",
    );
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toEqual([{ id: "biz-1" }]);
  });

  it("fails open to an empty list on a real Supabase error", async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: "network error" } });

    const result = await getUserBusinesses();

    expect(result).toEqual([]);
  });

  it("re-throws Next.js's own DYNAMIC_SERVER_USAGE control-flow signal instead of swallowing it", async () => {
    orderMock.mockRejectedValue(
      Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" }),
    );

    await expect(getUserBusinesses()).rejects.toMatchObject({ digest: "DYNAMIC_SERVER_USAGE" });
  });
});
