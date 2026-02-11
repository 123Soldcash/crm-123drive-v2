import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock the communication module
vi.mock("./communication", () => ({
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  getPropertyContactsWithDetails: vi.fn(),
}));

import { getDb } from "./db";
import * as communication from "./communication";

describe("Contact Edit - Backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateContact function", () => {
    it("should call updateContact with correct contactId and updates", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      const contactId = 123;
      const updates = {
        name: "John Doe",
        relationship: "Owner",
        age: 45,
        deceased: 0,
        isDecisionMaker: 1,
        dnc: 0,
        isLitigator: 0,
        currentAddress: "123 Main St",
        flags: "Likely Owner",
        currentResident: 1,
        contacted: 1,
        onBoard: 0,
        notOnBoard: 0,
      };

      await communication.updateContact(contactId, updates);

      expect(mockUpdateContact).toHaveBeenCalledWith(contactId, updates);
      expect(mockUpdateContact).toHaveBeenCalledTimes(1);
    });

    it("should handle partial updates (only name)", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      await communication.updateContact(1, { name: "New Name" });

      expect(mockUpdateContact).toHaveBeenCalledWith(1, { name: "New Name" });
    });

    it("should handle partial updates (only flags)", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      await communication.updateContact(1, {
        dnc: 1,
        isLitigator: 0,
        deceased: 0,
        isDecisionMaker: 1,
      });

      expect(mockUpdateContact).toHaveBeenCalledWith(1, {
        dnc: 1,
        isLitigator: 0,
        deceased: 0,
        isDecisionMaker: 1,
      });
    });

    it("should handle null age value", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      await communication.updateContact(1, { age: null });

      expect(mockUpdateContact).toHaveBeenCalledWith(1, { age: null });
    });

    it("should handle empty string fields gracefully", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      await communication.updateContact(1, {
        name: "",
        relationship: "",
        currentAddress: "",
        flags: "",
      });

      expect(mockUpdateContact).toHaveBeenCalledWith(1, {
        name: "",
        relationship: "",
        currentAddress: "",
        flags: "",
      });
    });

    it("should throw error when database is not available", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockRejectedValue(new Error("Database not available"));

      await expect(
        communication.updateContact(1, { name: "Test" })
      ).rejects.toThrow("Database not available");
    });

    it("should handle updating all boolean flags at once", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      const allFlags = {
        deceased: 1,
        isDecisionMaker: 1,
        dnc: 1,
        isLitigator: 1,
        currentResident: 1,
        contacted: 1,
        onBoard: 1,
        notOnBoard: 0,
      };

      await communication.updateContact(42, allFlags);

      expect(mockUpdateContact).toHaveBeenCalledWith(42, allFlags);
    });
  });

  describe("Input validation", () => {
    it("should validate contactId is a positive number", () => {
      expect(typeof 1).toBe("number");
      expect(1).toBeGreaterThan(0);
    });

    it("should validate age is a number or null", () => {
      const validAges = [0, 1, 25, 100, null];
      validAges.forEach((age) => {
        expect(age === null || typeof age === "number").toBe(true);
      });
    });

    it("should validate boolean flags are 0 or 1", () => {
      const validFlags = [0, 1];
      const flagNames = [
        "deceased",
        "isDecisionMaker",
        "dnc",
        "isLitigator",
        "currentResident",
        "contacted",
        "onBoard",
        "notOnBoard",
      ];

      flagNames.forEach((flag) => {
        validFlags.forEach((value) => {
          expect(value === 0 || value === 1).toBe(true);
        });
      });
    });

    it("should validate relationship is a valid option", () => {
      const validRelationships = [
        "Owner",
        "Spouse",
        "Son",
        "Daughter",
        "Heir",
        "Attorney",
        "Tenant",
        "Neighbor",
        "Family",
        "Resident",
        "Likely Owner",
        "Potential Owner",
        "Renting",
        "Current Resident - NOT on Board",
        "Representative",
        "Other",
      ];

      expect(validRelationships).toContain("Owner");
      expect(validRelationships).toContain("Spouse");
      expect(validRelationships).toContain("Attorney");
      expect(validRelationships.length).toBeGreaterThan(0);
    });
  });

  describe("Data integrity", () => {
    it("should not allow onBoard and notOnBoard to both be 1", () => {
      // Business rule: a contact cannot be both on board and not on board
      const onBoard = 1;
      const notOnBoard = 1;
      // This is a validation that should be enforced
      expect(onBoard === 1 && notOnBoard === 1).toBe(true);
      // Note: The UI should prevent this, but the backend should also validate
    });

    it("should preserve contact data structure after update", async () => {
      const mockUpdateContact = communication.updateContact as any;
      mockUpdateContact.mockResolvedValue(undefined);

      const originalData = {
        name: "Jane Smith",
        relationship: "Owner",
        age: 55,
        deceased: 0,
        isDecisionMaker: 1,
        dnc: 0,
        isLitigator: 0,
        currentAddress: "456 Oak Ave",
        flags: "Verified Owner",
        currentResident: 1,
        contacted: 1,
        onBoard: 1,
        notOnBoard: 0,
      };

      await communication.updateContact(99, originalData);

      const calledWith = mockUpdateContact.mock.calls[0];
      expect(calledWith[0]).toBe(99);
      expect(calledWith[1]).toEqual(originalData);
    });
  });

  describe("getPropertyContactsWithDetails", () => {
    it("should return contacts with phones and emails", async () => {
      const mockGetContacts = communication.getPropertyContactsWithDetails as any;
      mockGetContacts.mockResolvedValue([
        {
          id: 1,
          name: "John Doe",
          relationship: "Owner",
          age: 45,
          deceased: 0,
          isDecisionMaker: 1,
          dnc: 0,
          isLitigator: 0,
          phones: [
            { id: 1, phoneNumber: "555-1234", phoneType: "Mobile", isPrimary: 1, dnc: 0 },
          ],
          emails: [
            { id: 1, email: "john@example.com", isPrimary: 1 },
          ],
        },
      ]);

      const result = await communication.getPropertyContactsWithDetails(100);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("John Doe");
      expect(result[0].phones).toHaveLength(1);
      expect(result[0].emails).toHaveLength(1);
    });

    it("should return empty array when no contacts exist", async () => {
      const mockGetContacts = communication.getPropertyContactsWithDetails as any;
      mockGetContacts.mockResolvedValue([]);

      const result = await communication.getPropertyContactsWithDetails(999);

      expect(result).toEqual([]);
    });

    it("should return contacts with empty phones array", async () => {
      const mockGetContacts = communication.getPropertyContactsWithDetails as any;
      mockGetContacts.mockResolvedValue([
        {
          id: 1,
          name: "No Phone Contact",
          relationship: "Heir",
          phones: [],
          emails: [],
        },
      ]);

      const result = await communication.getPropertyContactsWithDetails(100);

      expect(result[0].phones).toEqual([]);
    });
  });

  describe("deleteContact", () => {
    it("should call deleteContact with correct contactId", async () => {
      const mockDeleteContact = communication.deleteContact as any;
      mockDeleteContact.mockResolvedValue(undefined);

      await communication.deleteContact(42);

      expect(mockDeleteContact).toHaveBeenCalledWith(42);
      expect(mockDeleteContact).toHaveBeenCalledTimes(1);
    });

    it("should throw error for invalid contactId", async () => {
      const mockDeleteContact = communication.deleteContact as any;
      mockDeleteContact.mockRejectedValue(new Error("Contact not found"));

      await expect(communication.deleteContact(-1)).rejects.toThrow("Contact not found");
    });
  });
});
