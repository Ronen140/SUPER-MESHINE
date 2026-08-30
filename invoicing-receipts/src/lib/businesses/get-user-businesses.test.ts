// @vitest-environment node
//
// This file is genuinely server-only code (never bundled to the browser), and
// `next/navigation`'s `unstable_rethrow` picks its server vs. browser implementation
// via `typeof window === 'undefined'` — the global jsdom environment (needed for
// component tests elsewhere in this project) would make it silently resolve to the
// browser variant here, which doesn't check DYNAMIC_SERVER_USAGE at all. Forcing
// "node" for this file matches Next's real runtime and is why this suite exists.
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

  it("re-throws Next.js's real notFound() signal (not the incorrect NEXT_NOT_FOUND prefix a prior hand-rolled check used)", async () => {
    // This uses next/navigation's real `unstable_rethrow` (not mocked here), so this test
    // is pinned against whatever digest format the installed Next version actually uses —
    // code-quality review, Issue #3: the previous hand-rolled prefix list said
    // "NEXT_NOT_FOUND", which does not exist anywhere in Next 15.5.24; the real digest is
    // "NEXT_HTTP_ERROR_FALLBACK;404".
    orderMock.mockRejectedValue(
      Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }),
    );

    await expect(getUserBusinesses()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("does not re-throw a plain application error (only recognized Next control-flow signals)", async () => {
    orderMock.mockRejectedValue(new Error("boom"));

    await expect(getUserBusinesses()).resolves.toEqual([]);
  });
});
