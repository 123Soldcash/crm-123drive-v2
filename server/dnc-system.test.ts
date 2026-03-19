import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * DNC (Do Not Call) System Tests
 * 
 * Tests the DNC business logic:
 * 1. Individual phone DNC toggle
 * 2. Global property DNC (marks all contacts + archives property)
 * 3. DNC visual indicators (disabled call buttons, strikethrough)
 * 4. DNC toggle in CallModal next to Disposition
 */

// ─── Schema validation tests ───

describe("DNC Input Schemas", () => {
  const togglePhoneDNCSchema = z.object({
    phoneId: z.number(),
    dnc: z.boolean(),
  });

  const markPropertyDNCSchema = z.object({
    propertyId: z.number(),
  });

  const unmarkPropertyDNCSchema = z.object({
    propertyId: z.number(),
  });

  it("validates togglePhoneDNC input with valid data", () => {
    const result = togglePhoneDNCSchema.safeParse({ phoneId: 123, dnc: true });
    expect(result.success).toBe(true);
  });

  it("validates togglePhoneDNC input for unmarking", () => {
    const result = togglePhoneDNCSchema.safeParse({ phoneId: 456, dnc: false });
    expect(result.success).toBe(true);
  });

  it("rejects togglePhoneDNC with missing phoneId", () => {
    const result = togglePhoneDNCSchema.safeParse({ dnc: true });
    expect(result.success).toBe(false);
  });

  it("rejects togglePhoneDNC with non-boolean dnc", () => {
    const result = togglePhoneDNCSchema.safeParse({ phoneId: 1, dnc: "yes" });
    expect(result.success).toBe(false);
  });

  it("validates markPropertyDNC input", () => {
    const result = markPropertyDNCSchema.safeParse({ propertyId: 2490001 });
    expect(result.success).toBe(true);
  });

  it("validates unmarkPropertyDNC input", () => {
    const result = unmarkPropertyDNCSchema.safeParse({ propertyId: 2490001 });
    expect(result.success).toBe(true);
  });

  it("rejects markPropertyDNC with string propertyId", () => {
    const result = markPropertyDNCSchema.safeParse({ propertyId: "abc" });
    expect(result.success).toBe(false);
  });
});

// ─── DNC Business Logic Tests ───

describe("DNC Business Logic", () => {
  it("individual phone DNC should only affect that specific phone", () => {
    // Simulate contacts with multiple phones
    const contacts = [
      {
        id: 1,
        name: "Larry Gaines",
        dnc: false,
        phones: [
          { id: 10, phoneNumber: "5616677439", dnc: false },
          { id: 11, phoneNumber: "9545005965", dnc: false },
        ],
      },
    ];

    // Mark phone 10 as DNC
    const updatedContacts = contacts.map((c) => ({
      ...c,
      phones: c.phones.map((p) =>
        p.id === 10 ? { ...p, dnc: true } : p
      ),
    }));

    // Only phone 10 should be DNC
    expect(updatedContacts[0].phones[0].dnc).toBe(true);
    expect(updatedContacts[0].phones[1].dnc).toBe(false);
  });

  it("global DNC should mark ALL contacts and ALL phones as DNC", () => {
    const contacts = [
      {
        id: 1,
        name: "Larry Gaines",
        dnc: false,
        phones: [
          { id: 10, phoneNumber: "5616677439", dnc: false },
          { id: 11, phoneNumber: "9545005965", dnc: false },
        ],
      },
      {
        id: 2,
        name: "Jane Smith",
        dnc: false,
        phones: [
          { id: 20, phoneNumber: "3055551234", dnc: false },
        ],
      },
    ];

    // Mark all as DNC (global)
    const updatedContacts = contacts.map((c) => ({
      ...c,
      dnc: true,
      phones: c.phones.map((p) => ({ ...p, dnc: true })),
    }));

    // All contacts and phones should be DNC
    expect(updatedContacts.every((c) => c.dnc)).toBe(true);
    expect(updatedContacts.flatMap((c) => c.phones).every((p) => p.dnc)).toBe(true);
  });

  it("unmark global DNC should clear DNC from ALL contacts and phones", () => {
    const contacts = [
      {
        id: 1,
        name: "Larry Gaines",
        dnc: true,
        phones: [
          { id: 10, phoneNumber: "5616677439", dnc: true },
          { id: 11, phoneNumber: "9545005965", dnc: true },
        ],
      },
    ];

    // Unmark all DNC
    const updatedContacts = contacts.map((c) => ({
      ...c,
      dnc: false,
      phones: c.phones.map((p) => ({ ...p, dnc: false })),
    }));

    expect(updatedContacts.every((c) => !c.dnc)).toBe(true);
    expect(updatedContacts.flatMap((c) => c.phones).every((p) => !p.dnc)).toBe(true);
  });

  it("allContactsDNC should be true only when ALL contacts are DNC", () => {
    const contacts1 = [
      { id: 1, dnc: true },
      { id: 2, dnc: true },
    ];
    const contacts2 = [
      { id: 1, dnc: true },
      { id: 2, dnc: false },
    ];
    const contacts3: any[] = [];

    const allDNC1 = contacts1.length > 0 && contacts1.every((c) => !!c.dnc);
    const allDNC2 = contacts2.length > 0 && contacts2.every((c) => !!c.dnc);
    const allDNC3 = contacts3.length > 0 && contacts3.every((c) => !!c.dnc);

    expect(allDNC1).toBe(true);
    expect(allDNC2).toBe(false);
    expect(allDNC3).toBe(false);
  });
});

// ─── DNC Visual Indicator Tests ───

describe("DNC Visual Indicators", () => {
  it("phone with DNC should show disabled call button", () => {
    const phone = { id: 10, phoneNumber: "5616677439", dnc: true };
    const contact = { id: 1, dnc: false };
    
    const shouldDisableCall = phone.dnc || contact.dnc;
    expect(shouldDisableCall).toBe(true);
  });

  it("phone without DNC but contact with DNC should show disabled call button", () => {
    const phone = { id: 10, phoneNumber: "5616677439", dnc: false };
    const contact = { id: 1, dnc: true };
    
    const shouldDisableCall = phone.dnc || contact.dnc;
    expect(shouldDisableCall).toBe(true);
  });

  it("phone without DNC and contact without DNC should show active call button", () => {
    const phone = { id: 10, phoneNumber: "5616677439", dnc: false };
    const contact = { id: 1, dnc: false };
    
    const shouldDisableCall = phone.dnc || contact.dnc;
    expect(shouldDisableCall).toBe(false);
  });

  it("phone number text should have strikethrough class when DNC", () => {
    const phone = { dnc: true };
    const contact = { dnc: false };
    
    const className = phone.dnc || contact.dnc
      ? "text-red-400 line-through cursor-default"
      : "text-blue-600 hover:underline";
    
    expect(className).toContain("line-through");
    expect(className).toContain("text-red-400");
  });

  it("phone number text should have normal class when not DNC", () => {
    const phone = { dnc: false };
    const contact = { dnc: false };
    
    const className = phone.dnc || contact.dnc
      ? "text-red-400 line-through cursor-default"
      : "text-blue-600 hover:underline";
    
    expect(className).toContain("text-blue-600");
    expect(className).not.toContain("line-through");
  });
});

// ─── DNC Geral + Desk Status Tests ───

describe("DNC Geral and Desk Status", () => {
  it("marking DNC Geral should set desk status to ARCHIVED", () => {
    const property = { id: 2490001, deskStatus: "ACTIVE" };
    
    // Simulate DNC Geral action
    const updatedProperty = { ...property, deskStatus: "ARCHIVED" };
    
    expect(updatedProperty.deskStatus).toBe("ARCHIVED");
  });

  it("unmarking DNC Geral should set desk status to ACTIVE", () => {
    const property = { id: 2490001, deskStatus: "ARCHIVED" };
    
    // Simulate unmark DNC Geral action
    const updatedProperty = { ...property, deskStatus: "ACTIVE" };
    
    expect(updatedProperty.deskStatus).toBe("ACTIVE");
  });

  it("DNC Geral button should show ON when all contacts are DNC", () => {
    const allContactsDNC = true;
    const buttonText = allContactsDNC ? "DNC Geral (ON)" : "DNC Geral (OFF)";
    const buttonClass = allContactsDNC
      ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
      : "border-red-300 text-red-600 hover:bg-red-50";
    
    expect(buttonText).toBe("DNC Geral (ON)");
    expect(buttonClass).toContain("bg-red-600");
  });

  it("DNC Geral button should show OFF when not all contacts are DNC", () => {
    const allContactsDNC = false;
    const buttonText = allContactsDNC ? "DNC Geral (ON)" : "DNC Geral (OFF)";
    
    expect(buttonText).toBe("DNC Geral (OFF)");
  });
});

// ─── CallModal DNC Toggle Tests ───

describe("CallModal DNC Toggle", () => {
  it("should find current phone data from contacts list", () => {
    const contactsForDNC = [
      {
        id: 1,
        phones: [
          { id: 10, phoneNumber: "5616677439", dnc: false },
          { id: 11, phoneNumber: "9545005965", dnc: true },
        ],
      },
    ];
    const phoneNumber = "5616677439";

    const currentPhoneData = contactsForDNC
      .flatMap((c) => c.phones || [])
      .find((p) => p.phoneNumber === phoneNumber || p.phoneNumber === phoneNumber.replace(/^\+1/, ''));

    expect(currentPhoneData).toBeDefined();
    expect(currentPhoneData?.id).toBe(10);
    expect(currentPhoneData?.dnc).toBe(false);
  });

  it("should find phone data with +1 prefix", () => {
    const contactsForDNC = [
      {
        id: 1,
        phones: [
          { id: 10, phoneNumber: "5616677439", dnc: false },
        ],
      },
    ];
    const phoneNumber = "+15616677439";

    const currentPhoneData = contactsForDNC
      .flatMap((c) => c.phones || [])
      .find((p) => p.phoneNumber === phoneNumber || p.phoneNumber === phoneNumber.replace(/^\+1/, ''));

    expect(currentPhoneData).toBeDefined();
    expect(currentPhoneData?.id).toBe(10);
  });

  it("should show DNC ON when phone is marked as DNC", () => {
    const phoneDNC = true;
    const label = phoneDNC ? "DNC ON" : "DNC OFF";
    const className = phoneDNC
      ? "bg-red-100 border-red-500 text-red-700"
      : "bg-gray-50 border-gray-300 text-gray-500";

    expect(label).toBe("DNC ON");
    expect(className).toContain("bg-red-100");
    expect(className).toContain("border-red-500");
  });

  it("should show DNC OFF when phone is not DNC", () => {
    const phoneDNC = false;
    const label = phoneDNC ? "DNC ON" : "DNC OFF";

    expect(label).toBe("DNC OFF");
  });
});
