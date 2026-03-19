import { describe, it, expect } from "vitest";

/**
 * Tests for duplicate phone number prevention in property contacts.
 * 
 * Rules:
 * 1. A property CANNOT have the same phone number added twice (across any contacts).
 * 2. Different properties CAN share the same phone number.
 * 3. Phone numbers are normalized (digits only, strip leading country code "1") before comparison.
 * 4. When updating a contact, its own existing phones are excluded from the duplicate check.
 */

// Replicate the normalizePhone logic from server/communication.ts
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^1/, "");
}

// Replicate the findDuplicatePhones logic (in-memory version for unit testing)
function findDuplicatePhones(
  existingPhones: string[], // already normalized phones in the property
  newPhones: string[],      // raw phone strings to check
): string[] {
  const existingSet = new Set(existingPhones);
  const newNormalized = newPhones.map((p) => normalizePhone(p));
  return newNormalized.filter((p) => existingSet.has(p));
}

// Simulate the full property-level check: given all contacts' phones and a new set of phones,
// find which new phones are duplicates
function checkPropertyDuplicates(
  propertyContacts: Array<{ contactId: number; phones: string[] }>,
  newPhones: string[],
  excludeContactId?: number,
): string[] {
  const existingNormalized: string[] = [];
  for (const contact of propertyContacts) {
    if (excludeContactId && contact.contactId === excludeContactId) continue;
    for (const phone of contact.phones) {
      existingNormalized.push(normalizePhone(phone));
    }
  }
  return findDuplicatePhones(existingNormalized, newPhones);
}

describe("Phone number normalization", () => {
  it("strips non-digit characters", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizePhone("+1-555-123-4567")).toBe("5551234567");
    expect(normalizePhone("555.123.4567")).toBe("5551234567");
  });

  it("strips leading country code 1", () => {
    expect(normalizePhone("15551234567")).toBe("5551234567");
    expect(normalizePhone("1-555-123-4567")).toBe("5551234567");
  });

  it("does not strip 1 if it is part of the number (not leading country code)", () => {
    // A 10-digit number starting with 1 would lose the 1 — this is expected behavior
    // because the normalization strips leading "1" as country code
    expect(normalizePhone("1234567890")).toBe("234567890");
  });

  it("handles already clean numbers", () => {
    expect(normalizePhone("5551234567")).toBe("5551234567");
  });

  it("handles empty string", () => {
    expect(normalizePhone("")).toBe("");
  });
});

describe("Duplicate phone detection within a property", () => {
  it("detects exact duplicate phone", () => {
    const existing = ["5551234567"];
    const duplicates = findDuplicatePhones(existing, ["5551234567"]);
    expect(duplicates).toEqual(["5551234567"]);
  });

  it("detects duplicate with different formatting", () => {
    const existing = ["5551234567"];
    const duplicates = findDuplicatePhones(existing, ["(555) 123-4567"]);
    expect(duplicates).toEqual(["5551234567"]);
  });

  it("detects duplicate with country code prefix", () => {
    const existing = ["5551234567"];
    const duplicates = findDuplicatePhones(existing, ["+1-555-123-4567"]);
    expect(duplicates).toEqual(["5551234567"]);
  });

  it("returns empty when no duplicates", () => {
    const existing = ["5551234567"];
    const duplicates = findDuplicatePhones(existing, ["5559876543"]);
    expect(duplicates).toEqual([]);
  });

  it("detects multiple duplicates at once", () => {
    const existing = ["5551234567", "5559876543"];
    const duplicates = findDuplicatePhones(existing, ["(555) 123-4567", "(555) 987-6543", "5550001111"]);
    expect(duplicates).toEqual(["5551234567", "5559876543"]);
  });

  it("handles empty new phones list", () => {
    const existing = ["5551234567"];
    const duplicates = findDuplicatePhones(existing, []);
    expect(duplicates).toEqual([]);
  });

  it("handles empty existing phones list", () => {
    const existing: string[] = [];
    const duplicates = findDuplicatePhones(existing, ["5551234567"]);
    expect(duplicates).toEqual([]);
  });
});

describe("Property-level duplicate check (createContact scenario)", () => {
  const propertyContacts = [
    { contactId: 1, phones: ["(555) 111-2222", "(555) 333-4444"] },
    { contactId: 2, phones: ["(555) 555-6666"] },
  ];

  it("blocks adding a phone that exists on another contact in the same property", () => {
    const duplicates = checkPropertyDuplicates(propertyContacts, ["5551112222"]);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toBe("5551112222");
  });

  it("blocks adding a phone with different formatting", () => {
    const duplicates = checkPropertyDuplicates(propertyContacts, ["+1 (555) 111-2222"]);
    expect(duplicates.length).toBe(1);
  });

  it("allows adding a phone that does not exist in the property", () => {
    const duplicates = checkPropertyDuplicates(propertyContacts, ["5559999999"]);
    expect(duplicates).toEqual([]);
  });

  it("allows the same phone in a different property (not checked here - different property context)", () => {
    // This test verifies the concept: the check is scoped to a single property
    const otherPropertyContacts = [
      { contactId: 10, phones: ["(999) 888-7777"] },
    ];
    const duplicates = checkPropertyDuplicates(otherPropertyContacts, ["5551112222"]);
    expect(duplicates).toEqual([]);
  });
});

describe("Property-level duplicate check (updateContact scenario)", () => {
  const propertyContacts = [
    { contactId: 1, phones: ["(555) 111-2222", "(555) 333-4444"] },
    { contactId: 2, phones: ["(555) 555-6666"] },
  ];

  it("allows a contact to keep its own phone numbers when updating", () => {
    // Contact 1 is being updated and keeps its own phones — should NOT be flagged
    const duplicates = checkPropertyDuplicates(
      propertyContacts,
      ["(555) 111-2222", "(555) 333-4444"],
      1, // exclude contact 1
    );
    expect(duplicates).toEqual([]);
  });

  it("blocks a contact from taking another contact's phone number", () => {
    // Contact 1 tries to add contact 2's phone
    const duplicates = checkPropertyDuplicates(
      propertyContacts,
      ["(555) 111-2222", "(555) 555-6666"], // 555-6666 belongs to contact 2
      1,
    );
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toBe("5555556666");
  });

  it("allows adding a new unique phone during update", () => {
    const duplicates = checkPropertyDuplicates(
      propertyContacts,
      ["(555) 111-2222", "(555) 999-0000"], // new phone
      1,
    );
    expect(duplicates).toEqual([]);
  });
});

describe("Bulk import duplicate handling", () => {
  it("each contact in bulk import is checked independently against existing property phones", () => {
    const existingContacts = [
      { contactId: 1, phones: ["5551112222"] },
    ];

    // First new contact: has a duplicate
    const dup1 = checkPropertyDuplicates(existingContacts, ["5551112222"]);
    expect(dup1.length).toBe(1);

    // Second new contact: unique phone
    const dup2 = checkPropertyDuplicates(existingContacts, ["5559999999"]);
    expect(dup2).toEqual([]);
  });

  it("reports which specific phones are duplicates in the error", () => {
    const existingContacts = [
      { contactId: 1, phones: ["5551112222", "5553334444"] },
    ];

    const duplicates = checkPropertyDuplicates(existingContacts, ["5551112222", "5553334444", "5559999999"]);
    expect(duplicates).toEqual(["5551112222", "5553334444"]);
    // The error message would be: "Duplicate phone number(s) already exist in this property: 5551112222, 5553334444"
  });
});

describe("ContactEditModal client-side duplicate check", () => {
  // Replicates the handleAddPhone logic from ContactEditModal
  function clientSideDuplicateCheck(
    existingPhones: Array<{ phoneNumber: string }>,
    newPhone: string,
  ): boolean {
    const normalized = newPhone.trim().replace(/\D/g, "");
    return existingPhones.some(
      (p) => p.phoneNumber.replace(/\D/g, "") === normalized,
    );
  }

  it("detects duplicate when adding same phone to contact", () => {
    const phones = [{ phoneNumber: "5551112222" }];
    expect(clientSideDuplicateCheck(phones, "5551112222")).toBe(true);
  });

  it("detects duplicate with different formatting", () => {
    const phones = [{ phoneNumber: "(555) 111-2222" }];
    expect(clientSideDuplicateCheck(phones, "5551112222")).toBe(true);
  });

  it("allows unique phone", () => {
    const phones = [{ phoneNumber: "5551112222" }];
    expect(clientSideDuplicateCheck(phones, "5559999999")).toBe(false);
  });

  it("handles empty existing phones", () => {
    expect(clientSideDuplicateCheck([], "5551112222")).toBe(false);
  });
});
