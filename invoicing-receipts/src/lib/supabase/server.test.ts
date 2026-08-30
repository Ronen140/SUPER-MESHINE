import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAllMock = vi.fn(() => [] as { name: string; value: string }[]);
const setMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: getAllMock,
    set: setMock,
  })),
}));

// Imported after the mock so `next/headers` resolves to the fake above.
const { createClient } = await import("./server");

const ORIGINAL_ENV = { ...process.env };

describe("createClient (server)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
    getAllMock.mockClear();
    setMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws a clear error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("returns a Supabase client backed by the request's cookie store", async () => {
    const client = await createClient();
    expect(client).toBeTruthy();
    expect(typeof client.auth.getUser).toBe("function");

    // Exercise the real cookie adapter (not mocked away) by reading the session,
    // which reads through to next/headers' cookies().getAll().
    await client.auth.getSession();
    expect(getAllMock).toHaveBeenCalled();
  });
});
