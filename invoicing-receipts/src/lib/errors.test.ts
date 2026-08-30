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
