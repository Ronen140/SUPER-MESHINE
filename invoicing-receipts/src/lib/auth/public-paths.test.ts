import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("treats /login and /signup as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
  });

  it("treats nested auth routes as public", () => {
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("treats everything else as protected by default", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/businesses/new")).toBe(false);
  });

  it("does not treat lookalike paths as public (prefix must be a full segment)", () => {
    expect(isPublicPath("/login-history")).toBe(false);
  });
});
