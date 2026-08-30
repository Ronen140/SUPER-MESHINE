import { describe, expect, it } from "vitest";
import { mapAuthError } from "./auth-errors";

describe("mapAuthError", () => {
  it("maps invalid credentials to a Hebrew message", () => {
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe("אימייל או סיסמה שגויים.");
  });

  it("maps duplicate signup to a Hebrew message", () => {
    expect(mapAuthError({ message: "User already registered" })).toBe(
      "כבר קיים משתמש עם כתובת האימייל הזו. נסו להתחבר.",
    );
  });

  it("maps weak password to a Hebrew message", () => {
    expect(mapAuthError({ message: "Password should be at least 6 characters" })).toBe(
      "הסיסמה קצרה מדי — נדרשים לפחות 6 תווים.",
    );
  });

  it("maps invalid email format to a Hebrew message", () => {
    expect(mapAuthError({ message: "Unable to validate email address: invalid format" })).toBe(
      "כתובת האימייל אינה תקינה.",
    );
  });

  it("maps rate limiting to a Hebrew message", () => {
    expect(mapAuthError({ message: "email rate limit exceeded" })).toBe(
      "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
    );
  });

  it("maps a network/fetch failure to a Hebrew message", () => {
    expect(mapAuthError({ message: "fetch failed" })).toBe(
      "בעיית תקשורת מול השרת. בדקו את החיבור לאינטרנט ונסו שוב.",
    );
    expect(mapAuthError(new TypeError("Failed to fetch"))).toBe(
      "בעיית תקשורת מול השרת. בדקו את החיבור לאינטרנט ונסו שוב.",
    );
  });

  it("falls back to a generic Hebrew message for unrecognized errors", () => {
    expect(mapAuthError({ message: "some new supabase error we do not know" })).toBe(
      "משהו השתבש. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.",
    );
  });

  it("handles a bare unknown value without throwing", () => {
    expect(mapAuthError(undefined)).toBe("משהו השתבש. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.");
  });
});
