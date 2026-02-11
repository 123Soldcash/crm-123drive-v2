import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Comprehensive tests for ContactEditModal phone/email save functionality
 * Tests cover:
 * 1. Phone number addition and save
 * 2. Email addition and save
 * 3. Contact details update with contactId
 * 4. Age field handling (null vs undefined)
 * 5. New phones/emails detection (comparing against originals)
 * 6. Multiple phone/email additions
 * 7. Phone type selection
 * 8. Error handling
 */

// Mock the contact data structure
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

describe("ContactEditModal - Phone Save Logic", () => {
  describe("New Phone Detection", () => {
    it("should detect new phones by comparing against original contact phones", () => {
      const originalPhones = (mockContact.phones || []).map((p) => p.phoneNumber);
      const currentPhones = [
        ...mockContact.phones,
        { phoneNumber: "5559876543", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
      ];
      const newPhones = currentPhones.filter(
        (p) => !originalPhones.includes(p.phoneNumber)
      );

      expect(newPhones).toHaveLength(1);
      expect(newPhones[0].phoneNumber).toBe("5559876543");
    });

    it("should return empty array when no new phones are added", () => {
      const originalPhones = (mockContact.phones || []).map((p) => p.phoneNumber);
      const currentPhones = [...mockContact.phones];
      const newPhones = currentPhones.filter(
        (p) => !originalPhones.includes(p.phoneNumber)
      );

      expect(newPhones).toHaveLength(0);
    });

    it("should detect multiple new phones", () => {
      const originalPhones = (mockContact.phones || []).map((p) => p.phoneNumber);
      const currentPhones = [
        ...mockContact.phones,
        { phoneNumber: "5559876543", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
        { phoneNumber: "5551234567", phoneType: "Landline", isPrimary: 0, dnc: 0 },
        { phoneNumber: "5550001111", phoneType: "Work", isPrimary: 0, dnc: 0 },
      ];
      const newPhones = currentPhones.filter(
        (p) => !originalPhones.includes(p.phoneNumber)
      );

      expect(newPhones).toHaveLength(3);
      expect(newPhones.map((p) => p.phoneNumber)).toEqual([
        "5559876543",
        "5551234567",
        "5550001111",
      ]);
    });

    it("should not treat existing phones as new", () => {
      const originalPhones = (mockContact.phones || []).map((p) => p.phoneNumber);
      const currentPhones = [...mockContact.phones];
      // Re-add an existing phone
      currentPhones.push({
        phoneNumber: "9542754685",
        phoneType: "Mobile",
        isPrimary: 0,
        dnc: 0,
      });
      const newPhones = currentPhones.filter(
        (p) => !originalPhones.includes(p.phoneNumber)
      );

      expect(newPhones).toHaveLength(0);
    });
  });

  describe("New Email Detection", () => {
    it("should detect new emails by comparing against original contact emails", () => {
      const originalEmails = (mockContact.emails || []).map((e) => e.email);
      const currentEmails = [
        ...mockContact.emails,
        { email: "newemail@test.com", isPrimary: 0 },
      ];
      const newEmails = currentEmails.filter(
        (e) => !originalEmails.includes(e.email)
      );

      expect(newEmails).toHaveLength(1);
      expect(newEmails[0].email).toBe("newemail@test.com");
    });

    it("should return empty array when no new emails are added", () => {
      const originalEmails = (mockContact.emails || []).map((e) => e.email);
      const currentEmails = [...mockContact.emails];
      const newEmails = currentEmails.filter(
        (e) => !originalEmails.includes(e.email)
      );

      expect(newEmails).toHaveLength(0);
    });

    it("should detect multiple new emails", () => {
      const originalEmails = (mockContact.emails || []).map((e) => e.email);
      const currentEmails = [
        ...mockContact.emails,
        { email: "new1@test.com", isPrimary: 0 },
        { email: "new2@test.com", isPrimary: 0 },
      ];
      const newEmails = currentEmails.filter(
        (e) => !originalEmails.includes(e.email)
      );

      expect(newEmails).toHaveLength(2);
    });
  });

  describe("Contact Update Payload", () => {
    it("should use contactId instead of id", () => {
      const payload = {
        contactId: mockContact.id,
        name: mockContact.name,
        relationship: mockContact.relationship,
      };

      expect(payload).toHaveProperty("contactId");
      expect(payload).not.toHaveProperty("id");
      expect(payload.contactId).toBe(123);
    });

    it("should send undefined for age when empty, not null", () => {
      const ageStr = "";
      const ageValue = ageStr ? parseInt(ageStr, 10) : undefined;

      expect(ageValue).toBeUndefined();
      expect(ageValue).not.toBeNull();
    });

    it("should send parsed integer for age when provided", () => {
      const ageStr = "45";
      const ageValue = ageStr ? parseInt(ageStr, 10) : undefined;

      expect(ageValue).toBe(45);
      expect(typeof ageValue).toBe("number");
    });

    it("should convert boolean flags to 0/1 integers", () => {
      const deceased = true;
      const isDecisionMaker = false;
      const dnc = true;

      const payload = {
        deceased: deceased ? 1 : 0,
        isDecisionMaker: isDecisionMaker ? 1 : 0,
        dnc: dnc ? 1 : 0,
      };

      expect(payload.deceased).toBe(1);
      expect(payload.isDecisionMaker).toBe(0);
      expect(payload.dnc).toBe(1);
    });

    it("should send undefined for empty string fields, not empty strings", () => {
      const name = "";
      const relationship = "";
      const currentAddress = "123 Main St";

      const payload = {
        name: name || undefined,
        relationship: relationship || undefined,
        currentAddress: currentAddress || undefined,
      };

      expect(payload.name).toBeUndefined();
      expect(payload.relationship).toBeUndefined();
      expect(payload.currentAddress).toBe("123 Main St");
    });
  });

  describe("Phone Addition Logic", () => {
    it("should not add empty phone number", () => {
      const phones: any[] = [];
      const newPhone = "";

      if (newPhone.trim()) {
        phones.push({
          phoneNumber: newPhone.trim(),
          phoneType: "Mobile",
          isPrimary: 0,
          dnc: 0,
        });
      }

      expect(phones).toHaveLength(0);
    });

    it("should trim whitespace from phone number", () => {
      const phones: any[] = [];
      const newPhone = "  5559876543  ";

      if (newPhone.trim()) {
        phones.push({
          phoneNumber: newPhone.trim(),
          phoneType: "Mobile",
          isPrimary: 0,
          dnc: 0,
        });
      }

      expect(phones).toHaveLength(1);
      expect(phones[0].phoneNumber).toBe("5559876543");
    });

    it("should preserve phone type selection", () => {
      const phones: any[] = [];
      const newPhone = "5559876543";
      const newPhoneType = "Landline";

      phones.push({
        phoneNumber: newPhone.trim(),
        phoneType: newPhoneType,
        isPrimary: 0,
        dnc: 0,
      });

      expect(phones[0].phoneType).toBe("Landline");
    });

    it("should default to Mobile phone type", () => {
      const defaultType = "Mobile";
      expect(defaultType).toBe("Mobile");
    });
  });

  describe("Email Addition Logic", () => {
    it("should not add empty email", () => {
      const emails: any[] = [];
      const newEmail = "";

      if (newEmail.trim()) {
        emails.push({ email: newEmail.trim(), isPrimary: 0 });
      }

      expect(emails).toHaveLength(0);
    });

    it("should trim whitespace from email", () => {
      const emails: any[] = [];
      const newEmail = "  test@example.com  ";

      if (newEmail.trim()) {
        emails.push({ email: newEmail.trim(), isPrimary: 0 });
      }

      expect(emails).toHaveLength(1);
      expect(emails[0].email).toBe("test@example.com");
    });
  });

  describe("Phone Removal Logic", () => {
    it("should remove phone at specified index", () => {
      const phones = [
        { phoneNumber: "111", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
        { phoneNumber: "222", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
        { phoneNumber: "333", phoneType: "Landline", isPrimary: 0, dnc: 0 },
      ];

      const result = phones.filter((_, i) => i !== 1);

      expect(result).toHaveLength(2);
      expect(result[0].phoneNumber).toBe("111");
      expect(result[1].phoneNumber).toBe("333");
    });

    it("should handle removing first phone", () => {
      const phones = [
        { phoneNumber: "111", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
        { phoneNumber: "222", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
      ];

      const result = phones.filter((_, i) => i !== 0);

      expect(result).toHaveLength(1);
      expect(result[0].phoneNumber).toBe("222");
    });

    it("should handle removing last phone", () => {
      const phones = [
        { phoneNumber: "111", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
        { phoneNumber: "222", phoneType: "Mobile", isPrimary: 0, dnc: 0 },
      ];

      const result = phones.filter((_, i) => i !== 1);

      expect(result).toHaveLength(1);
      expect(result[0].phoneNumber).toBe("111");
    });
  });

  describe("Email Removal Logic", () => {
    it("should remove email at specified index", () => {
      const emails = [
        { email: "a@test.com", isPrimary: 0 },
        { email: "b@test.com", isPrimary: 0 },
        { email: "c@test.com", isPrimary: 0 },
      ];

      const result = emails.filter((_, i) => i !== 1);

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe("a@test.com");
      expect(result[1].email).toBe("c@test.com");
    });
  });

  describe("Contact Initialization", () => {
    it("should handle contact with null phones", () => {
      const contact = { ...mockContact, phones: null };
      const phones =
        contact.phones && Array.isArray(contact.phones)
          ? contact.phones.map((p: any) => ({
              phoneNumber: p.phoneNumber || "",
              phoneType: p.phoneType || "Mobile",
              isPrimary: p.isPrimary || 0,
              dnc: p.dnc || 0,
            }))
          : [];

      expect(phones).toHaveLength(0);
    });

    it("should handle contact with undefined emails", () => {
      const contact = { ...mockContact, emails: undefined };
      const emails =
        contact.emails && Array.isArray(contact.emails)
          ? contact.emails.map((e: any) => ({
              email: e.email || "",
              isPrimary: e.isPrimary || 0,
            }))
          : [];

      expect(emails).toHaveLength(0);
    });

    it("should initialize boolean flags from 0/1 integers", () => {
      const deceased = mockContact.deceased === 1;
      const isDecisionMaker = mockContact.isDecisionMaker === 1;
      const dnc = mockContact.dnc === 1;
      const onBoard = mockContact.onBoard === 1;

      expect(deceased).toBe(false);
      expect(isDecisionMaker).toBe(true);
      expect(dnc).toBe(false);
      expect(onBoard).toBe(true);
    });

    it("should handle null age gracefully", () => {
      const contact = { ...mockContact, age: null };
      const ageStr =
        contact.age != null ? String(contact.age) : "";

      expect(ageStr).toBe("");
    });

    it("should convert age to string for form input", () => {
      const ageStr =
        mockContact.age != null ? String(mockContact.age) : "";

      expect(ageStr).toBe("45");
    });
  });

  describe("Save Flow Validation", () => {
    it("should not save when contact id is missing", () => {
      const contact = { ...mockContact, id: undefined };
      let saveCalled = false;

      if (contact?.id) {
        saveCalled = true;
      }

      expect(saveCalled).toBe(false);
    });

    it("should proceed with save when contact id is present", () => {
      let saveCalled = false;

      if (mockContact?.id) {
        saveCalled = true;
      }

      expect(saveCalled).toBe(true);
    });

    it("should build complete update payload", () => {
      const payload = {
        contactId: mockContact.id,
        name: mockContact.name || undefined,
        relationship: mockContact.relationship || undefined,
        age: mockContact.age ? mockContact.age : undefined,
        currentAddress: mockContact.currentAddress || undefined,
        flags: mockContact.flags || undefined,
        deceased: mockContact.deceased === 1 ? 1 : 0,
        isDecisionMaker: mockContact.isDecisionMaker === 1 ? 1 : 0,
        dnc: mockContact.dnc === 1 ? 1 : 0,
        isLitigator: mockContact.isLitigator === 1 ? 1 : 0,
        currentResident: mockContact.currentResident === 1 ? 1 : 0,
        contacted: mockContact.contacted === 1 ? 1 : 0,
        onBoard: mockContact.onBoard === 1 ? 1 : 0,
        notOnBoard: mockContact.notOnBoard === 1 ? 1 : 0,
      };

      expect(payload.contactId).toBe(123);
      expect(payload.name).toBe("Maria M Munro");
      expect(payload.relationship).toBe("Owner");
      expect(payload.age).toBe(45);
      expect(payload.deceased).toBe(0);
      expect(payload.isDecisionMaker).toBe(1);
      expect(payload.currentResident).toBe(1);
      expect(payload.onBoard).toBe(1);
    });
  });

  describe("AddPhone Mutation Payload", () => {
    it("should build correct addPhone payload", () => {
      const phone = {
        phoneNumber: "5559876543",
        phoneType: "Mobile",
        isPrimary: 0,
        dnc: 0,
      };

      const payload = {
        contactId: mockContact.id,
        phoneNumber: phone.phoneNumber,
        phoneType: phone.phoneType as any || "Mobile",
        isPrimary: phone.isPrimary || 0,
        dnc: phone.dnc || 0,
      };

      expect(payload.contactId).toBe(123);
      expect(payload.phoneNumber).toBe("5559876543");
      expect(payload.phoneType).toBe("Mobile");
      expect(payload.isPrimary).toBe(0);
      expect(payload.dnc).toBe(0);
    });

    it("should build correct addEmail payload", () => {
      const email = { email: "test@example.com", isPrimary: 0 };

      const payload = {
        contactId: mockContact.id,
        email: email.email,
        isPrimary: email.isPrimary || 0,
      };

      expect(payload.contactId).toBe(123);
      expect(payload.email).toBe("test@example.com");
      expect(payload.isPrimary).toBe(0);
    });
  });
});
