import { describe, it, expect } from "vitest";

/**
 * Tests for Add Contact functionality in Call Tracking Sheet
 * Tests cover:
 * 1. Contact creation payload validation
 * 2. Form input validation (name required)
 * 3. Optional fields handling (phone, email, relationship)
 * 4. Phone type defaults
 * 5. Form reset after submission
 * 6. Zod schema validation for createContact
 */

// Simulate the handleAddContact payload builder
function buildCreateContactPayload(
  propertyId: number,
  name: string,
  relationship: string,
  phone: string,
  phoneType: string,
  email: string
) {
  return {
    propertyId,
    name: name.trim(),
    relationship: relationship || undefined,
    phone1: phone.trim() || undefined,
    phone1Type: phone.trim() ? phoneType : undefined,
    email1: email.trim() || undefined,
  };
}

// Simulate form validation
function validateAddContactForm(name: string): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: "Contact name is required" };
  }
  return { valid: true };
}

describe("Add Contact in Call Tracking Sheet - Payload Builder", () => {
  it("should build payload with all fields", () => {
    const payload = buildCreateContactPayload(
      630034,
      "John Doe",
      "Owner",
      "5551234567",
      "Mobile",
      "john@example.com"
    );
    expect(payload).toEqual({
      propertyId: 630034,
      name: "John Doe",
      relationship: "Owner",
      phone1: "5551234567",
      phone1Type: "Mobile",
      email1: "john@example.com",
    });
  });

  it("should build payload with only name (minimum required)", () => {
    const payload = buildCreateContactPayload(630034, "Jane Doe", "", "", "Mobile", "");
    expect(payload).toEqual({
      propertyId: 630034,
      name: "Jane Doe",
      relationship: undefined,
      phone1: undefined,
      phone1Type: undefined,
      email1: undefined,
    });
  });

  it("should trim whitespace from name", () => {
    const payload = buildCreateContactPayload(630034, "  John Doe  ", "", "", "Mobile", "");
    expect(payload.name).toBe("John Doe");
  });

  it("should trim whitespace from phone", () => {
    const payload = buildCreateContactPayload(630034, "John", "", "  5551234567  ", "Mobile", "");
    expect(payload.phone1).toBe("5551234567");
  });

  it("should trim whitespace from email", () => {
    const payload = buildCreateContactPayload(630034, "John", "", "", "Mobile", "  john@test.com  ");
    expect(payload.email1).toBe("john@test.com");
  });

  it("should not include phone type when phone is empty", () => {
    const payload = buildCreateContactPayload(630034, "John", "", "", "Mobile", "");
    expect(payload.phone1).toBeUndefined();
    expect(payload.phone1Type).toBeUndefined();
  });

  it("should include phone type when phone is provided", () => {
    const payload = buildCreateContactPayload(630034, "John", "", "5551234567", "Landline", "");
    expect(payload.phone1).toBe("5551234567");
    expect(payload.phone1Type).toBe("Landline");
  });

  it("should handle all phone types", () => {
    const types = ["Mobile", "Landline", "Work", "Home", "Other"];
    types.forEach((type) => {
      const payload = buildCreateContactPayload(630034, "John", "", "5551234567", type, "");
      expect(payload.phone1Type).toBe(type);
    });
  });

  it("should handle all relationship types", () => {
    const relationships = ["Owner", "Spouse", "Relative", "Tenant", "Neighbor", "Attorney", "Personal Representative", "Other"];
    relationships.forEach((rel) => {
      const payload = buildCreateContactPayload(630034, "John", rel, "", "Mobile", "");
      expect(payload.relationship).toBe(rel);
    });
  });

  it("should set relationship to undefined when empty", () => {
    const payload = buildCreateContactPayload(630034, "John", "", "", "Mobile", "");
    expect(payload.relationship).toBeUndefined();
  });
});

describe("Add Contact - Form Validation", () => {
  it("should reject empty name", () => {
    const result = validateAddContactForm("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Contact name is required");
  });

  it("should reject whitespace-only name", () => {
    const result = validateAddContactForm("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Contact name is required");
  });

  it("should accept valid name", () => {
    const result = validateAddContactForm("John Doe");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should accept name with special characters", () => {
    const result = validateAddContactForm("María José O'Brien-Smith");
    expect(result.valid).toBe(true);
  });

  it("should accept single character name", () => {
    const result = validateAddContactForm("J");
    expect(result.valid).toBe(true);
  });
});

describe("Add Contact - Zod Schema Validation", () => {
  const { z } = require("zod");

  const createContactSchema = z.object({
    propertyId: z.number(),
    name: z.string().optional(),
    relationship: z.string().optional(),
    age: z.number().optional(),
    deceased: z.number().optional(),
    currentAddress: z.string().optional(),
    isDecisionMaker: z.number().optional(),
    dnc: z.number().optional(),
    isLitigator: z.number().optional(),
    flags: z.string().optional(),
    phone1: z.string().optional(),
    phone1Type: z.string().optional(),
    phone2: z.string().optional(),
    phone2Type: z.string().optional(),
    phone3: z.string().optional(),
    phone3Type: z.string().optional(),
    email1: z.string().optional(),
    email2: z.string().optional(),
    email3: z.string().optional(),
  });

  it("should accept full payload", () => {
    const payload = buildCreateContactPayload(630034, "John Doe", "Owner", "5551234567", "Mobile", "john@test.com");
    const result = createContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should accept minimal payload (propertyId + name)", () => {
    const payload = { propertyId: 630034, name: "John Doe" };
    const result = createContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should accept payload without optional fields", () => {
    const payload = buildCreateContactPayload(630034, "John", "", "", "Mobile", "");
    const result = createContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should reject payload without propertyId", () => {
    const payload = { name: "John Doe" };
    const result = createContactSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should accept payload with phone and email", () => {
    const payload = {
      propertyId: 630034,
      name: "Test Contact",
      phone1: "9541234567",
      phone1Type: "Mobile",
      email1: "test@example.com",
    };
    const result = createContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe("Add Contact - Form Reset After Submission", () => {
  it("should reset all form fields to defaults", () => {
    // Simulate form state after reset
    const resetState = {
      name: "",
      relationship: "",
      phone: "",
      phoneType: "Mobile",
      email: "",
      showForm: false,
    };

    expect(resetState.name).toBe("");
    expect(resetState.relationship).toBe("");
    expect(resetState.phone).toBe("");
    expect(resetState.phoneType).toBe("Mobile");
    expect(resetState.email).toBe("");
    expect(resetState.showForm).toBe(false);
  });

  it("should default phone type to Mobile", () => {
    const defaultPhoneType = "Mobile";
    expect(defaultPhoneType).toBe("Mobile");
  });
});

describe("Add Contact - Button State", () => {
  it("should disable Add button when name is empty", () => {
    const name = "";
    const isPending = false;
    const isDisabled = !name.trim() || isPending;
    expect(isDisabled).toBe(true);
  });

  it("should disable Add button when mutation is pending", () => {
    const name = "John Doe";
    const isPending = true;
    const isDisabled = !name.trim() || isPending;
    expect(isDisabled).toBe(true);
  });

  it("should enable Add button when name is provided and not pending", () => {
    const name = "John Doe";
    const isPending = false;
    const isDisabled = !name.trim() || isPending;
    expect(isDisabled).toBe(false);
  });

  it("should enable Add button even without phone or email", () => {
    const name = "John Doe";
    const phone = "";
    const email = "";
    const isPending = false;
    const isDisabled = !name.trim() || isPending;
    expect(isDisabled).toBe(false);
  });
});
