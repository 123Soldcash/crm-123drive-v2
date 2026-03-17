import { describe, it, expect } from "vitest";

/**
 * Tests for duplicate phone/email detection logic used in ContactManagement and ContactsSection.
 * The logic normalizes phones (digits only) and emails (lowercase, trimmed) then counts occurrences
 * across all contacts in a property. Any value appearing more than once is flagged as duplicate.
 */

// Replicate the detection logic from the components
function detectDuplicates(contacts: Array<{ phones?: Array<{ phoneNumber: string }>; emails?: Array<{ email: string }> }>) {
  const phoneCount: Record<string, number> = {};
  const emailCount: Record<string, number> = {};
  for (const c of contacts) {
    if (c.phones) {
      for (const p of c.phones) {
        const normalized = (p.phoneNumber || "").replace(/\D/g, "");
        if (normalized) phoneCount[normalized] = (phoneCount[normalized] || 0) + 1;
      }
    }
    if (c.emails) {
      for (const e of c.emails) {
        const normalized = (e.email || "").trim().toLowerCase();
        if (normalized) emailCount[normalized] = (emailCount[normalized] || 0) + 1;
      }
    }
  }
  const dupPhones = new Set<string>();
  const dupEmails = new Set<string>();
  Object.entries(phoneCount).forEach(([k, v]) => { if (v > 1) dupPhones.add(k); });
  Object.entries(emailCount).forEach(([k, v]) => { if (v > 1) dupEmails.add(k); });
  return { duplicatePhones: dupPhones, duplicateEmails: dupEmails };
}

describe("Duplicate contact detection", () => {
  it("detects no duplicates when all phones and emails are unique", () => {
    const contacts = [
      { phones: [{ phoneNumber: "(555) 111-2222" }], emails: [{ email: "alice@test.com" }] },
      { phones: [{ phoneNumber: "(555) 333-4444" }], emails: [{ email: "bob@test.com" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(0);
    expect(duplicateEmails.size).toBe(0);
  });

  it("detects duplicate phone numbers across different contacts", () => {
    const contacts = [
      { phones: [{ phoneNumber: "(555) 111-2222" }], emails: [{ email: "alice@test.com" }] },
      { phones: [{ phoneNumber: "555-111-2222" }], emails: [{ email: "bob@test.com" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(1);
    expect(duplicatePhones.has("5551112222")).toBe(true);
    expect(duplicateEmails.size).toBe(0);
  });

  it("detects duplicate emails across different contacts (case-insensitive)", () => {
    const contacts = [
      { phones: [{ phoneNumber: "111" }], emails: [{ email: "Alice@Test.com" }] },
      { phones: [{ phoneNumber: "222" }], emails: [{ email: "alice@test.com" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(0);
    expect(duplicateEmails.size).toBe(1);
    expect(duplicateEmails.has("alice@test.com")).toBe(true);
  });

  it("detects duplicate emails with extra whitespace", () => {
    const contacts = [
      { phones: [], emails: [{ email: "  alice@test.com " }] },
      { phones: [], emails: [{ email: "alice@test.com" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicateEmails.size).toBe(1);
    expect(duplicateEmails.has("alice@test.com")).toBe(true);
  });

  it("detects duplicate phones within the same contact", () => {
    const contacts = [
      { phones: [{ phoneNumber: "555-111-2222" }, { phoneNumber: "(555) 111-2222" }], emails: [] },
    ];
    const { duplicatePhones } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(1);
    expect(duplicatePhones.has("5551112222")).toBe(true);
  });

  it("detects both phone and email duplicates simultaneously", () => {
    const contacts = [
      { phones: [{ phoneNumber: "555-111-2222" }], emails: [{ email: "shared@test.com" }] },
      { phones: [{ phoneNumber: "555-111-2222" }], emails: [{ email: "shared@test.com" }] },
      { phones: [{ phoneNumber: "555-999-8888" }], emails: [{ email: "unique@test.com" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(1);
    expect(duplicateEmails.size).toBe(1);
    expect(duplicatePhones.has("5551112222")).toBe(true);
    expect(duplicateEmails.has("shared@test.com")).toBe(true);
  });

  it("handles contacts with no phones or emails", () => {
    const contacts = [
      { phones: undefined, emails: undefined },
      { phones: [], emails: [] },
      { phones: [{ phoneNumber: "555-111-2222" }], emails: [{ email: "test@test.com" }] },
    ] as any;
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(0);
    expect(duplicateEmails.size).toBe(0);
  });

  it("handles empty contacts array", () => {
    const { duplicatePhones, duplicateEmails } = detectDuplicates([]);
    expect(duplicatePhones.size).toBe(0);
    expect(duplicateEmails.size).toBe(0);
  });

  it("normalizes phone numbers by stripping non-digit characters", () => {
    const contacts = [
      { phones: [{ phoneNumber: "+1 (555) 111-2222" }], emails: [] },
      { phones: [{ phoneNumber: "15551112222" }], emails: [] },
    ];
    const { duplicatePhones } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(1);
    expect(duplicatePhones.has("15551112222")).toBe(true);
  });

  it("does not flag empty phone numbers or emails as duplicates", () => {
    const contacts = [
      { phones: [{ phoneNumber: "" }], emails: [{ email: "" }] },
      { phones: [{ phoneNumber: "" }], emails: [{ email: "" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(0);
    expect(duplicateEmails.size).toBe(0);
  });

  it("detects multiple different duplicates", () => {
    const contacts = [
      { phones: [{ phoneNumber: "111" }, { phoneNumber: "222" }], emails: [{ email: "a@b.com" }, { email: "c@d.com" }] },
      { phones: [{ phoneNumber: "111" }, { phoneNumber: "333" }], emails: [{ email: "a@b.com" }, { email: "e@f.com" }] },
      { phones: [{ phoneNumber: "222" }], emails: [{ email: "c@d.com" }] },
    ];
    const { duplicatePhones, duplicateEmails } = detectDuplicates(contacts);
    expect(duplicatePhones.size).toBe(2); // 111 and 222
    expect(duplicateEmails.size).toBe(2); // a@b.com and c@d.com
  });
});
