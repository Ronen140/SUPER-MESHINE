import { describe, expect, it } from "vitest";
import { isNextControlFlowError } from "./next-control-flow-error";

describe("isNextControlFlowError", () => {
  it("recognizes DYNAMIC_SERVER_USAGE (cookies()/headers() during static generation)", () => {
    const error = Object.assign(new Error("Dynamic server usage"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });
    expect(isNextControlFlowError(error)).toBe(true);
  });

  it("recognizes NEXT_REDIRECT and NEXT_NOT_FOUND", () => {
    expect(isNextControlFlowError(Object.assign(new Error(), { digest: "NEXT_REDIRECT;push;/x" }))).toBe(
      true,
    );
    expect(isNextControlFlowError(Object.assign(new Error(), { digest: "NEXT_NOT_FOUND" }))).toBe(true);
  });

  it("returns false for a normal error (e.g. a real Supabase failure)", () => {
    expect(isNextControlFlowError(new Error("fetch failed"))).toBe(false);
    expect(isNextControlFlowError({ message: "boom" })).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError(undefined)).toBe(false);
  });
});
