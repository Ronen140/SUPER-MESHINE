import { describe, expect, it } from "vitest";
import { toUserMessage } from "./errors";

describe("toUserMessage", () => {
  it("maps a known INV_* code to its Hebrew message", () => {
    expect(toUserMessage("INV_ALREADY_ISSUED: document R1 is already issued")).toBe(
      "המסמך כבר הופק ולא ניתן להפיק אותו שוב.",
    );
  });

  it("maps a different known INV_* code to a different message", () => {
    expect(toUserMessage("INV_NO_SIGNING_KEY: business x has no active signing key")).toBe(
      "לעסק אין מפתח חתימה פעיל — לא ניתן להפיק מסמכים כרגע.",
    );
  });

  it("maps INV_CREDIT_PARENT_TYPE (ADR-INV-002 Amendment A-2) to its Hebrew message", () => {
    expect(
      toUserMessage("INV_CREDIT_PARENT_TYPE: cannot credit a document of type price_quote"),
    ).toBe(
      "ניתן להפיק זיכוי רק כנגד קבלה, חשבונית מס או חשבונית מס-קבלה — לא כנגד הצעת מחיר או חשבונית עסקה.",
    );
  });

  it("maps INV_FUTURE_ISSUE_DATE (ADR-INV-002 Addendum A′-2) to its Hebrew message", () => {
    expect(toUserMessage("INV_FUTURE_ISSUE_DATE: issue date 2027-01-01 is in the future")).toBe(
      "לא ניתן להפיק מסמך עם תאריך הפקה עתידי.",
    );
  });

  it("maps the five public.create_business() error codes (B9, ADR-INV-001 §D10) to Hebrew messages", () => {
    expect(toUserMessage("INV_UNAUTHENTICATED: no authenticated user")).toBe(
      "יש להתחבר כדי לבצע פעולה זו.",
    );
    expect(toUserMessage("INV_NO_PROFILE: no public.users row for the current user")).toBe(
      "לא נמצא פרופיל משתמש. נסו להתנתק ולהתחבר מחדש.",
    );
    expect(toUserMessage("INV_BUSINESS_LIMIT: a user may own at most 10 businesses")).toBe(
      "לא ניתן ליצור יותר מ-10 עסקים למשתמש אחד.",
    );
    expect(toUserMessage("INV_BAD_TAX_ID: tax_id must be exactly 9 digits")).toBe(
      "מספר עוסק/ח.פ אינו תקין — נדרשות 9 ספרות.",
    );
    expect(toUserMessage("INV_TAX_ID_EXISTS: a business with this tax_id already exists")).toBe(
      "כבר קיים עסק עם מספר עוסק/ח.פ זה במערכת.",
    );
  });

  it("falls back to a generic Hebrew message for an unrecognized INV_* code", () => {
    expect(toUserMessage("INV_SOMETHING_NEW_NOT_YET_MAPPED: detail")).toBe(
      "אירעה שגיאה בלתי צפויה. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.",
    );
  });

  it("falls back to a generic Hebrew message for a raw Postgres error with no INV_* code", () => {
    expect(
      toUserMessage('duplicate key value violates unique constraint "customers_taxid_uk"'),
    ).toBe("אירעה שגיאה בלתי צפויה. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.");
  });

  it("falls back to a generic Hebrew message for null/undefined input", () => {
    expect(toUserMessage(null)).toBe(
      "אירעה שגיאה בלתי צפויה. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.",
    );
    expect(toUserMessage(undefined)).toBe(
      "אירעה שגיאה בלתי צפויה. נסו שוב, ואם הבעיה חוזרת פנו לתמיכה.",
    );
  });
});
