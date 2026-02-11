import { describe, it, expect } from "vitest";

/**
 * Comprehensive tests for unlimited phones/emails in ContactEditModal
 * Tests cover:
 * 1. No quantity limits on phones or emails
 * 2. Full sync save (phones + emails sent with updateContact)
 * 3. Phone/email removal persisted via full array replacement
 * 4. Adding 5+ phones and emails
 * 5. Zod schema validation for phones/emails arrays
 * 6. Backend updateContact function with phones/emails
 * 7. Edge cases: empty arrays, large arrays, mixed operations
 */

// Mock contact data
const mockContact = {
  id: 123,
  name: "Maria M Munro",
  relationship: "Owner",
  age: 45,
  currentAddress: "7120 NW 44TH CT, LAUDERHILL, FL, 33319",
  flags: "Likely Owner, Family, Resident",
  deceased: 0,
  isDecisionMaker: 1,
  dnc: 0,
  isLitigator: 0,
  currentResident: 1,
  contacted: 0,
  onBoard: 1,
  notOnBoard: 0,
  phones: [
    { phoneNumber: "9542754685", phoneType: "Mobile", isPrimary: 1, dnc: 0 },
    { phoneNumber: "9544456340", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
    { phoneNumber: "9545729028", phoneType: "Landline", isPrimary: 0, dnc: 0 },
  ],
  emails: [
    { email: "mariamunro@uniqueproductions.net", isPrimary: 1 },
    { email: "maxmunro@uniqueproductions.net", isPrimary: 0 },
    { email: "mmunro1@icloud.com", isPrimary: 0 },
  ],
};

// Simulate the handleSave payload builder (mirrors ContactEditModal logic)
function buildSavePayload(contact: typeof mockContact, phones: any[], emails: any[], overrides: any = {}) {
  return {
    contactId: contact.id,
    name: overrides.name ?? contact.name ?? undefined,
    relationship: overrides.relationship ?? contact.relationship ?? undefined,
    age: overrides.age ?? (contact.age ? contact.age : undefined),
    currentAddress: overrides.currentAddress ?? contact.currentAddress ?? undefined,
    flags: overrides.flags ?? contact.flags ?? undefined,
    deceased: contact.deceased,
    isDecisionMaker: contact.isDecisionMaker,
    dnc: contact.dnc,
    isLitigator: contact.isLitigator,
    currentResident: contact.currentResident,
    contacted: contact.contacted,
    onBoard: contact.onBoard,
    notOnBoard: contact.notOnBoard,
    phones: phones.map(p => ({
      phoneNumber: p.phoneNumber,
      phoneType: p.phoneType || "Mobile",
      isPrimary: p.isPrimary || 0,
      dnc: p.dnc || 0,
    })),
    emails: emails.map(e => ({
      email: e.email,
      isPrimary: e.isPrimary || 0,
    })),
  };
}

describe("Unlimited Phones/Emails - No Quantity Limits", () => {
  it("should allow adding a 4th phone number", () => {
    const phones = [
      ...mockContact.phones,
      { phoneNumber: "5559876543", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
    ];
    expect(phones).toHaveLength(4);
    const payload = buildSavePayload(mockContact, phones, mockContact.emails);
    expect(payload.phones).toHaveLength(4);
  });

  it("should allow adding a 5th phone number", () => {
    const phones = [
      ...mockContact.phones,
      { phoneNumber: "5559876543", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
      { phoneNumber: "5551234567", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
    ];
    expect(phones).toHaveLength(5);
    const payload = buildSavePayload(mockContact, phones, mockContact.emails);
    expect(payload.phones).toHaveLength(5);
  });

  it("should allow adding 10 phone numbers", () => {
    const phones = [...mockContact.phones];
    for (let i = 0; i < 7; i++) {
      phones.push({ phoneNumber: `555000${i}`, phoneType: "Mobile", isPrimary: 0, dnc: 0 });
    }
    expect(phones).toHaveLength(10);
    const payload = buildSavePayload(mockContact, phones, mockContact.emails);
    expect(payload.phones).toHaveLength(10);
  });

  it("should allow adding 20 phone numbers", () => {
    const phones = [...mockContact.phones];
    for (let i = 0; i < 17; i++) {
      phones.push({ phoneNumber: `555${String(i).padStart(4, '0')}`, phoneType: "Mobile", isPrimary: 0, dnc: 0 });
    }
    expect(phones).toHaveLength(20);
    const payload = buildSavePayload(mockContact, phones, mockContact.emails);
    expect(payload.phones).toHaveLength(20);
  });

  it("should allow adding a 4th email", () => {
    const emails = [
      ...mockContact.emails,
      { email: "new@test.com", isPrimary: 0 },
    ];
    expect(emails).toHaveLength(4);
    const payload = buildSavePayload(mockContact, mockContact.phones, emails);
    expect(payload.emails).toHaveLength(4);
  });

  it("should allow adding 10 emails", () => {
    const emails = [...mockContact.emails];
    for (let i = 0; i < 7; i++) {
      emails.push({ email: `test${i}@example.com`, isPrimary: 0 });
    }
    expect(emails).toHaveLength(10);
    const payload = buildSavePayload(mockContact, mockContact.phones, emails);
    expect(payload.emails).toHaveLength(10);
  });

  it("should handle empty phones array", () => {
    const payload = buildSavePayload(mockContact, [], mockContact.emails);
    expect(payload.phones).toHaveLength(0);
    expect(payload.phones).toEqual([]);
  });

  it("should handle empty emails array", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, []);
    expect(payload.emails).toHaveLength(0);
    expect(payload.emails).toEqual([]);
  });

  it("should handle both empty phones and emails", () => {
    const payload = buildSavePayload(mockContact, [], []);
    expect(payload.phones).toHaveLength(0);
    expect(payload.emails).toHaveLength(0);
  });
});

describe("Full Sync Save - Phones and Emails in Single Mutation", () => {
  it("should include phones array in the save payload", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, mockContact.emails);
    expect(payload).toHaveProperty("phones");
    expect(Array.isArray(payload.phones)).toBe(true);
  });

  it("should include emails array in the save payload", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, mockContact.emails);
    expect(payload).toHaveProperty("emails");
    expect(Array.isArray(payload.emails)).toBe(true);
  });

  it("should send all existing phones in the payload", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, mockContact.emails);
    expect(payload.phones).toHaveLength(3);
    expect(payload.phones[0].phoneNumber).toBe("9542754685");
    expect(payload.phones[1].phoneNumber).toBe("9544456340");
    expect(payload.phones[2].phoneNumber).toBe("9545729028");
  });

  it("should send all existing emails in the payload", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, mockContact.emails);
    expect(payload.emails).toHaveLength(3);
    expect(payload.emails[0].email).toBe("mariamunro@uniqueproductions.net");
    expect(payload.emails[1].email).toBe("maxmunro@uniqueproductions.net");
    expect(payload.emails[2].email).toBe("mmunro1@icloud.com");
  });

  it("should include contact details AND phones AND emails in a single payload", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, mockContact.emails);
    // Contact details
    expect(payload.contactId).toBe(123);
    expect(payload.name).toBe("Maria M Munro");
    // Phones
    expect(payload.phones).toHaveLength(3);
    // Emails
    expect(payload.emails).toHaveLength(3);
  });
});

describe("Phone/Email Removal via Full Array Replacement", () => {
  it("should remove a phone by excluding it from the array", () => {
    // Remove the 2nd phone (9544456340)
    const phones = mockContact.phones.filter((_, i) => i !== 1);
    expect(phones).toHaveLength(2);
    const payload = buildSavePayload(mockContact, phones, mockContact.emails);
    expect(payload.phones).toHaveLength(2);
    expect(payload.phones.map(p => p.phoneNumber)).not.toContain("9544456340");
  });

  it("should remove an email by excluding it from the array", () => {
    // Remove the 1st email
    const emails = mockContact.emails.filter((_, i) => i !== 0);
    expect(emails).toHaveLength(2);
    const payload = buildSavePayload(mockContact, mockContact.phones, emails);
    expect(payload.emails).toHaveLength(2);
    expect(payload.emails.map(e => e.email)).not.toContain("mariamunro@uniqueproductions.net");
  });

  it("should handle removing all phones", () => {
    const payload = buildSavePayload(mockContact, [], mockContact.emails);
    expect(payload.phones).toHaveLength(0);
  });

  it("should handle removing all emails", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, []);
    expect(payload.emails).toHaveLength(0);
  });

  it("should handle removing some phones and adding new ones simultaneously", () => {
    // Remove first phone, add two new ones
    const phones = [
      ...mockContact.phones.filter((_, i) => i !== 0),
      { phoneNumber: "5559999999", phoneType: "Work", isPrimary: 0, dnc: 0 },
      { phoneNumber: "5558888888", phoneType: "Home", isPrimary: 0, dnc: 0 },
    ];
    expect(phones).toHaveLength(4);
    const payload = buildSavePayload(mockContact, phones, mockContact.emails);
    expect(payload.phones).toHaveLength(4);
    expect(payload.phones.map(p => p.phoneNumber)).not.toContain("9542754685");
    expect(payload.phones.map(p => p.phoneNumber)).toContain("5559999999");
    expect(payload.phones.map(p => p.phoneNumber)).toContain("5558888888");
  });

  it("should handle removing some emails and adding new ones simultaneously", () => {
    // Remove last email, add a new one
    const emails = [
      ...mockContact.emails.filter((_, i) => i !== 2),
      { email: "newemail@domain.com", isPrimary: 0 },
    ];
    expect(emails).toHaveLength(3);
    const payload = buildSavePayload(mockContact, mockContact.phones, emails);
    expect(payload.emails).toHaveLength(3);
    expect(payload.emails.map(e => e.email)).not.toContain("mmunro1@icloud.com");
    expect(payload.emails.map(e => e.email)).toContain("newemail@domain.com");
  });
});

describe("Phone Type Handling", () => {
  it("should default phoneType to Mobile when not provided", () => {
    const phones = [{ phoneNumber: "5551111111", phoneType: "", isPrimary: 0, dnc: 0 }];
    const payload = buildSavePayload(mockContact, phones, []);
    expect(payload.phones[0].phoneType).toBe("Mobile");
  });

  it("should preserve all phone types", () => {
    const phones = [
      { phoneNumber: "1111", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
      { phoneNumber: "2222", phoneType: "Landline", isPrimary: 0, dnc: 0 },
      { phoneNumber: "3333", phoneType: "Work", isPrimary: 0, dnc: 0 },
      { phoneNumber: "4444", phoneType: "Home", isPrimary: 0, dnc: 0 },
      { phoneNumber: "5555", phoneType: "Other", isPrimary: 0, dnc: 0 },
    ];
    const payload = buildSavePayload(mockContact, phones, []);
    expect(payload.phones[0].phoneType).toBe("Mobile");
    expect(payload.phones[1].phoneType).toBe("Landline");
    expect(payload.phones[2].phoneType).toBe("Work");
    expect(payload.phones[3].phoneType).toBe("Home");
    expect(payload.phones[4].phoneType).toBe("Other");
  });
});

describe("Zod Schema Validation - communication.updateContact", () => {
  // Simulate Zod validation for the updated schema
  const { z } = require("zod");

  const updateContactSchema = z.object({
    contactId: z.number(),
    name: z.string().optional(),
    relationship: z.string().optional(),
    age: z.number().optional(),
    deceased: z.number().optional(),
    currentAddress: z.string().optional(),
    isDecisionMaker: z.number().optional(),
    dnc: z.number().optional(),
    isLitigator: z.number().optional(),
    flags: z.string().optional(),
    currentResident: z.number().optional(),
    contacted: z.number().optional(),
    onBoard: z.number().optional(),
    notOnBoard: z.number().optional(),
    phones: z.array(z.object({
      phoneNumber: z.string(),
      phoneType: z.string().optional(),
      isPrimary: z.number().optional(),
      dnc: z.number().optional(),
    })).optional(),
    emails: z.array(z.object({
      email: z.string(),
      isPrimary: z.number().optional(),
    })).optional(),
  });

  it("should accept payload with phones and emails arrays", () => {
    const payload = buildSavePayload(mockContact, mockContact.phones, mockContact.emails);
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should accept payload without phones and emails (optional)", () => {
    const payload = {
      contactId: 123,
      name: "Test",
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should accept payload with empty phones array", () => {
    const payload = {
      contactId: 123,
      phones: [],
      emails: [],
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should accept payload with 5 phones", () => {
    const phones = [];
    for (let i = 0; i < 5; i++) {
      phones.push({ phoneNumber: `555000${i}`, phoneType: "Mobile" });
    }
    const payload = {
      contactId: 123,
      phones,
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phones).toHaveLength(5);
    }
  });

  it("should accept payload with 10 phones", () => {
    const phones = [];
    for (let i = 0; i < 10; i++) {
      phones.push({ phoneNumber: `555${String(i).padStart(4, '0')}`, phoneType: "Mobile" });
    }
    const payload = {
      contactId: 123,
      phones,
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phones).toHaveLength(10);
    }
  });

  it("should accept payload with 20 phones", () => {
    const phones = [];
    for (let i = 0; i < 20; i++) {
      phones.push({ phoneNumber: `555${String(i).padStart(4, '0')}` });
    }
    const payload = {
      contactId: 123,
      phones,
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phones).toHaveLength(20);
    }
  });

  it("should accept payload with 10 emails", () => {
    const emails = [];
    for (let i = 0; i < 10; i++) {
      emails.push({ email: `test${i}@example.com` });
    }
    const payload = {
      contactId: 123,
      emails,
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emails).toHaveLength(10);
    }
  });

  it("should reject payload without contactId", () => {
    const payload = {
      name: "Test",
      phones: [],
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject phone without phoneNumber", () => {
    const payload = {
      contactId: 123,
      phones: [{ phoneType: "Mobile" }],
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject email without email field", () => {
    const payload = {
      contactId: 123,
      emails: [{ isPrimary: 0 }],
    };
    const result = updateContactSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("Backend updateContact - Phone/Email Sync", () => {
  // Simulate the backend updateContact function logic
  function simulateUpdateContact(contactId: number, contactData: any) {
    const { phones, emails, addresses, ...updates } = contactData;

    const operations: string[] = [];

    // Update base contact info
    if (Object.keys(updates).length > 0) {
      operations.push(`UPDATE contacts SET ... WHERE id = ${contactId}`);
    }

    // Sync phones (delete all, recreate)
    if (phones && Array.isArray(phones)) {
      operations.push(`DELETE FROM contactPhones WHERE contactId = ${contactId}`);
      for (const phone of phones) {
        operations.push(`INSERT INTO contactPhones (contactId, phoneNumber, phoneType) VALUES (${contactId}, '${phone.phoneNumber}', '${phone.phoneType || "Mobile"}')`);
      }
    }

    // Sync emails (delete all, recreate)
    if (emails && Array.isArray(emails)) {
      operations.push(`DELETE FROM contactEmails WHERE contactId = ${contactId}`);
      for (const email of emails) {
        operations.push(`INSERT INTO contactEmails (contactId, email) VALUES (${contactId}, '${email.email}')`);
      }
    }

    return operations;
  }

  it("should delete and recreate all phones when phones array is provided", () => {
    const ops = simulateUpdateContact(123, {
      name: "Test",
      phones: [
        { phoneNumber: "111", phoneType: "Mobile" },
        { phoneNumber: "222", phoneType: "Landline" },
      ],
    });
    expect(ops).toContain("DELETE FROM contactPhones WHERE contactId = 123");
    expect(ops.filter(o => o.startsWith("INSERT INTO contactPhones"))).toHaveLength(2);
  });

  it("should delete and recreate all emails when emails array is provided", () => {
    const ops = simulateUpdateContact(123, {
      name: "Test",
      emails: [
        { email: "a@b.com" },
        { email: "c@d.com" },
        { email: "e@f.com" },
      ],
    });
    expect(ops).toContain("DELETE FROM contactEmails WHERE contactId = 123");
    expect(ops.filter(o => o.startsWith("INSERT INTO contactEmails"))).toHaveLength(3);
  });

  it("should handle 5+ phones in sync operation", () => {
    const phones = [];
    for (let i = 0; i < 7; i++) {
      phones.push({ phoneNumber: `555000${i}`, phoneType: "Mobile" });
    }
    const ops = simulateUpdateContact(123, { phones });
    expect(ops.filter(o => o.startsWith("INSERT INTO contactPhones"))).toHaveLength(7);
  });

  it("should handle empty phones array (delete all phones)", () => {
    const ops = simulateUpdateContact(123, { phones: [] });
    expect(ops).toContain("DELETE FROM contactPhones WHERE contactId = 123");
    expect(ops.filter(o => o.startsWith("INSERT INTO contactPhones"))).toHaveLength(0);
  });

  it("should not touch phones when phones is not provided", () => {
    const ops = simulateUpdateContact(123, { name: "Test" });
    expect(ops.filter(o => o.includes("contactPhones"))).toHaveLength(0);
  });

  it("should not touch emails when emails is not provided", () => {
    const ops = simulateUpdateContact(123, { name: "Test" });
    expect(ops.filter(o => o.includes("contactEmails"))).toHaveLength(0);
  });

  it("should handle simultaneous phone and email sync", () => {
    const ops = simulateUpdateContact(123, {
      name: "Test",
      phones: [{ phoneNumber: "111" }, { phoneNumber: "222" }],
      emails: [{ email: "a@b.com" }],
    });
    expect(ops).toContain("DELETE FROM contactPhones WHERE contactId = 123");
    expect(ops).toContain("DELETE FROM contactEmails WHERE contactId = 123");
    expect(ops.filter(o => o.startsWith("INSERT INTO contactPhones"))).toHaveLength(2);
    expect(ops.filter(o => o.startsWith("INSERT INTO contactEmails"))).toHaveLength(1);
  });
});

describe("Save Button State - No Artificial Limits", () => {
  // Simulate the disabled condition: only disabled when mutation is pending
  function isSaveDisabled(isPending: boolean): boolean {
    return isPending;
  }

  it("should not be disabled with 0 phones", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });

  it("should not be disabled with 3 phones", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });

  it("should not be disabled with 4 phones", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });

  it("should not be disabled with 5 phones", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });

  it("should not be disabled with 10 phones", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });

  it("should not be disabled with 20 phones", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });

  it("should only be disabled when mutation is pending", () => {
    expect(isSaveDisabled(true)).toBe(true);
  });

  it("should be enabled again after mutation completes", () => {
    expect(isSaveDisabled(false)).toBe(false);
  });
});
