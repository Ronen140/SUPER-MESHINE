import { describe, expect, it } from "vitest";
import { businessSchema } from "./business";

const VALID = {
  legal_name: "רונן דורמן בע\"מ",
  entity_type: "murshe" as const,
  tax_id: "123456789",
};

describe("businessSchema", () => {
  it("accepts the minimal valid input", () => {
    const result = businessSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("rejects an empty legal_name", () => {
    const result = businessSchema.safeParse({ ...VALID, legal_name: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("יש להזין שם חוקי לעסק.");
  });

  it("rejects a missing entity_type", () => {
    const { entity_type, ...withoutEntityType } = VALID;
    const result = businessSchema.safeParse(withoutEntityType);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("יש לבחור סוג עסק.");
  });

  it("rejects a tax_id that is not exactly 9 digits", () => {
    expect(businessSchema.safeParse({ ...VALID, tax_id: "12345" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...VALID, tax_id: "1234567890" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...VALID, tax_id: "12345678a" }).success).toBe(false);
    const result = businessSchema.safeParse({ ...VALID, tax_id: "abc" });
    expect(result.error?.issues[0]?.message).toBe("מספר עוסק/ח.פ חייב להיות בן 9 ספרות.");
  });

  it("accepts optional display_name and address fields, including left empty", () => {
    expect(
      businessSchema.safeParse({
        ...VALID,
        display_name: "",
        address_line1: "",
        city: "",
        postal_code: "",
      }).success,
    ).toBe(true);

    expect(
      businessSchema.safeParse({
        ...VALID,
        display_name: "רונן",
        address_line1: "הרצל 1",
        city: "תל אביב",
        postal_code: "6100000",
      }).success,
    ).toBe(true);
  });
});
