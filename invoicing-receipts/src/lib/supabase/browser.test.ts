import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "./browser";

const ORIGINAL_ENV = { ...process.env };

describe("createClient (browser)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws a clear error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("returns a Supabase client (anon-scoped) when both env vars are present", () => {
    const client = createClient();
    expect(client).toBeTruthy();
    expect(typeof client.auth.signInWithPassword).toBe("function");
    expect(typeof client.from).toBe("function");
  });
});
