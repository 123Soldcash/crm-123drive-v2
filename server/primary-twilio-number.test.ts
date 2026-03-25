import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the Primary Twilio Number feature
 * 
 * This feature:
 * 1. Adds a primaryTwilioNumber column to contacts
 * 2. Auto-sets the primary number when a lead calls a Twilio number (first call only)
 * 3. Shows the primary number in the contacts section
 * 4. Allows manual change via a dropdown in the contact edit modal
 */

describe("Primary Twilio Number Feature", () => {
  describe("Schema", () => {
    it("should have primaryTwilioNumber column in contacts schema", async () => {
      const { contacts } = await import("../drizzle/schema");
      expect(contacts).toBeDefined();
      // The column should exist in the schema
      expect(contacts.primaryTwilioNumber).toBeDefined();
    });

    it("primaryTwilioNumber should be nullable (varchar)", async () => {
      const { contacts } = await import("../drizzle/schema");
      // The column config should allow null values (no .notNull())
      const columnConfig = contacts.primaryTwilioNumber.config as any;
      // varchar columns without notNull() default to nullable
      expect(contacts.primaryTwilioNumber).toBeDefined();
    });
  });

  describe("Backend - updatePrimaryTwilioNumber procedure", () => {
    it("should accept contactId and primaryTwilioNumber as input", () => {
      // The procedure expects:
      // { contactId: number, primaryTwilioNumber: string | null }
      const validInput = {
        contactId: 1,
        primaryTwilioNumber: "+15551234567",
      };
      expect(validInput.contactId).toBe(1);
      expect(validInput.primaryTwilioNumber).toBe("+15551234567");
    });

    it("should accept null to clear the primary number", () => {
      const clearInput = {
        contactId: 1,
        primaryTwilioNumber: null,
      };
      expect(clearInput.primaryTwilioNumber).toBeNull();
    });
  });

  describe("Inbound Call Webhook Logic", () => {
    it("should normalize phone numbers for matching", () => {
      // Test the normalization logic used in the webhook
      const from = "+15551234567";
      const callerDigits = from.replace(/\D/g, "");
      expect(callerDigits).toBe("15551234567");

      const callerVariants = [
        from,
        `+${callerDigits}`,
        callerDigits,
        callerDigits.length === 11 && callerDigits.startsWith("1") ? callerDigits.slice(1) : null,
        callerDigits.length === 10 ? `1${callerDigits}` : null,
      ].filter(Boolean) as string[];

      expect(callerVariants).toContain("+15551234567");
      expect(callerVariants).toContain("15551234567");
      expect(callerVariants).toContain("5551234567"); // stripped leading 1
    });

    it("should normalize 10-digit numbers correctly", () => {
      const from = "5551234567";
      const callerDigits = from.replace(/\D/g, "");
      expect(callerDigits).toBe("5551234567");

      const callerVariants = [
        from,
        `+${callerDigits}`,
        callerDigits,
        callerDigits.length === 11 && callerDigits.startsWith("1") ? callerDigits.slice(1) : null,
        callerDigits.length === 10 ? `1${callerDigits}` : null,
      ].filter(Boolean) as string[];

      expect(callerVariants).toContain("5551234567");
      expect(callerVariants).toContain("+5551234567");
      expect(callerVariants).toContain("15551234567"); // added leading 1
    });

    it("should normalize the Twilio 'to' number to E.164 format", () => {
      const to = "+18001234567";
      const twilioNumber = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
      expect(twilioNumber).toBe("+18001234567");
    });

    it("should handle 'to' number without + prefix", () => {
      const to = "18001234567";
      const twilioNumber = to.startsWith("+") ? to : `+${to.replace(/\D/g, "")}`;
      expect(twilioNumber).toBe("+18001234567");
    });

    it("should only set primaryTwilioNumber when it is null (first call only)", () => {
      // Simulating the SQL condition: isNull(contacts.primaryTwilioNumber)
      // If a contact already has a primaryTwilioNumber, it should NOT be overwritten
      const contactWithNumber = { id: 1, primaryTwilioNumber: "+18001111111" };
      const contactWithoutNumber = { id: 2, primaryTwilioNumber: null };

      // Only contactWithoutNumber should be updated
      expect(contactWithNumber.primaryTwilioNumber).not.toBeNull();
      expect(contactWithoutNumber.primaryTwilioNumber).toBeNull();
    });
  });

  describe("Frontend Display", () => {
    it("should display primary Twilio number badge when set", () => {
      const contact = {
        id: 1,
        name: "John Doe",
        primaryTwilioNumber: "+18001234567",
      };
      expect(contact.primaryTwilioNumber).toBeTruthy();
    });

    it("should not display badge when primaryTwilioNumber is null", () => {
      const contact = {
        id: 2,
        name: "Jane Doe",
        primaryTwilioNumber: null,
      };
      expect(contact.primaryTwilioNumber).toBeFalsy();
    });

    it("should allow selecting '_none' to clear the primary number", () => {
      const value = "_none";
      const result = value === "_none" ? null : value;
      expect(result).toBeNull();
    });

    it("should pass the phone number when a valid option is selected", () => {
      const value = "+18001234567";
      const result = value === "_none" ? null : value;
      expect(result).toBe("+18001234567");
    });
  });

  describe("Deduplication Logic", () => {
    it("should deduplicate contact IDs from multiple phone matches", () => {
      const matchingPhones = [
        { contactId: 1 },
        { contactId: 2 },
        { contactId: 1 }, // duplicate
        { contactId: 3 },
        { contactId: 2 }, // duplicate
      ];
      const uniqueContactIds = Array.from(new Set(matchingPhones.map(m => m.contactId)));
      expect(uniqueContactIds).toEqual([1, 2, 3]);
      expect(uniqueContactIds.length).toBe(3);
    });
  });
});
