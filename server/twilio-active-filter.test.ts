import { describe, it, expect } from "vitest";

/**
 * Tests for Twilio number active filtering.
 *
 * Rules:
 * 1. Call/SMS widgets should only show active Twilio numbers (isActive = 1).
 * 2. The Twilio Numbers management page (admin) should show ALL numbers.
 * 3. Non-admin users always see only active numbers regardless of the activeOnly flag.
 * 4. The listNumbers endpoint accepts an optional { activeOnly: boolean } parameter.
 */

interface TwilioNumber {
  id: number;
  phoneNumber: string;
  label: string;
  isActive: number; // 1 = active, 0 = disabled
  sortOrder: number;
}

// Simulate the backend listNumbers logic
function listNumbers(
  allNumbers: TwilioNumber[],
  userRole: "admin" | "user",
  activeOnly?: boolean
): TwilioNumber[] {
  // Admins see all numbers unless activeOnly is explicitly true
  if (userRole === "admin" && !activeOnly) {
    return [...allNumbers].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  // Non-admins or activeOnly=true: filter to active only
  return allNumbers
    .filter((n) => n.isActive === 1)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// Test data matching real database
const testNumbers: TwilioNumber[] = [
  { id: 1, phoneNumber: "+15617781156", label: "Teste", isActive: 0, sortOrder: 0 },
  { id: 2, phoneNumber: "+19543291622", label: "Teste", isActive: 0, sortOrder: 0 },
  { id: 3, phoneNumber: "+19543355668", label: "Teste", isActive: 0, sortOrder: 0 },
  { id: 6, phoneNumber: "+19542093000", label: "Chris", isActive: 1, sortOrder: 0 },
  { id: 7, phoneNumber: "+15617657653", label: "Vendor", isActive: 1, sortOrder: 0 },
  { id: 8, phoneNumber: "+19542193000", label: "219-3000", isActive: 1, sortOrder: 0 },
  { id: 9, phoneNumber: "+17868093700", label: "Teste", isActive: 0, sortOrder: 0 },
  { id: 15, phoneNumber: "+19544193000", label: "419-3000", isActive: 1, sortOrder: 0 },
  { id: 17, phoneNumber: "+17869041444", label: "Web", isActive: 1, sortOrder: 0 },
  { id: 19, phoneNumber: "+19544093000", label: "409-3000", isActive: 1, sortOrder: 0 },
  { id: 20, phoneNumber: "+19542153000", label: "215-3000", isActive: 1, sortOrder: 0 },
];

const activeCount = testNumbers.filter((n) => n.isActive === 1).length; // 7
const totalCount = testNumbers.length; // 11

describe("Twilio number active filtering", () => {
  describe("Admin user without activeOnly flag (management page)", () => {
    it("returns ALL numbers including inactive", () => {
      const result = listNumbers(testNumbers, "admin");
      expect(result.length).toBe(totalCount);
    });

    it("includes inactive numbers", () => {
      const result = listNumbers(testNumbers, "admin");
      const inactive = result.filter((n) => n.isActive === 0);
      expect(inactive.length).toBeGreaterThan(0);
    });

    it("includes active numbers", () => {
      const result = listNumbers(testNumbers, "admin");
      const active = result.filter((n) => n.isActive === 1);
      expect(active.length).toBe(activeCount);
    });
  });

  describe("Admin user with activeOnly=true (call/SMS widget)", () => {
    it("returns ONLY active numbers", () => {
      const result = listNumbers(testNumbers, "admin", true);
      expect(result.length).toBe(activeCount);
    });

    it("does not include any inactive numbers", () => {
      const result = listNumbers(testNumbers, "admin", true);
      const inactive = result.filter((n) => n.isActive === 0);
      expect(inactive.length).toBe(0);
    });

    it("all returned numbers have isActive=1", () => {
      const result = listNumbers(testNumbers, "admin", true);
      expect(result.every((n) => n.isActive === 1)).toBe(true);
    });
  });

  describe("Admin user with activeOnly=false", () => {
    it("returns ALL numbers (same as no flag)", () => {
      const result = listNumbers(testNumbers, "admin", false);
      expect(result.length).toBe(totalCount);
    });
  });

  describe("Non-admin user (always filtered)", () => {
    it("returns only active numbers without any flag", () => {
      const result = listNumbers(testNumbers, "user");
      expect(result.length).toBe(activeCount);
      expect(result.every((n) => n.isActive === 1)).toBe(true);
    });

    it("returns only active numbers even with activeOnly=false", () => {
      const result = listNumbers(testNumbers, "user", false);
      expect(result.length).toBe(activeCount);
    });

    it("returns only active numbers with activeOnly=true", () => {
      const result = listNumbers(testNumbers, "user", true);
      expect(result.length).toBe(activeCount);
    });
  });

  describe("Edge cases", () => {
    it("returns empty array when no numbers exist", () => {
      const result = listNumbers([], "admin", true);
      expect(result.length).toBe(0);
    });

    it("returns empty array when all numbers are inactive and activeOnly=true", () => {
      const allInactive = testNumbers.map((n) => ({ ...n, isActive: 0 }));
      const result = listNumbers(allInactive, "admin", true);
      expect(result.length).toBe(0);
    });

    it("returns all numbers when all are active and activeOnly=true", () => {
      const allActive = testNumbers.map((n) => ({ ...n, isActive: 1 }));
      const result = listNumbers(allActive, "admin", true);
      expect(result.length).toBe(testNumbers.length);
    });

    it("results are sorted by sortOrder", () => {
      const withOrder: TwilioNumber[] = [
        { id: 1, phoneNumber: "+1111", label: "Third", isActive: 1, sortOrder: 3 },
        { id: 2, phoneNumber: "+2222", label: "First", isActive: 1, sortOrder: 1 },
        { id: 3, phoneNumber: "+3333", label: "Second", isActive: 1, sortOrder: 2 },
      ];
      const result = listNumbers(withOrder, "admin", true);
      expect(result[0].label).toBe("First");
      expect(result[1].label).toBe("Second");
      expect(result[2].label).toBe("Third");
    });
  });

  describe("Specific active numbers verification", () => {
    it("Chris number is active and appears in filtered list", () => {
      const result = listNumbers(testNumbers, "admin", true);
      expect(result.find((n) => n.label === "Chris")).toBeDefined();
    });

    it("Vendor number is active and appears in filtered list", () => {
      const result = listNumbers(testNumbers, "admin", true);
      expect(result.find((n) => n.label === "Vendor")).toBeDefined();
    });

    it("Teste numbers are inactive and do NOT appear in filtered list", () => {
      const result = listNumbers(testNumbers, "admin", true);
      expect(result.find((n) => n.label === "Teste")).toBeUndefined();
    });
  });
});
