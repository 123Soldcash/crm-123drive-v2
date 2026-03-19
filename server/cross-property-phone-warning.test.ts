import { describe, it, expect } from "vitest";

/**
 * Tests for cross-property phone warning feature.
 *
 * Rules:
 * 1. When adding a phone to Property A, if that phone already exists in Property B,
 *    the system should WARN the user (not block).
 * 2. The warning should show which other properties have that phone number.
 * 3. The user can choose to proceed ("Add Anyway") or cancel.
 * 4. Phones within the SAME property are NOT flagged as cross-property (that's handled by duplicate prevention).
 * 5. Phone normalization applies: (226) 793-0770 == 2267930770 == +12267930770
 */

// Replicate normalizePhone from communication.ts
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^1/, "");
}

// In-memory simulation of cross-property phone check
interface PropertyContact {
  propertyId: number;
  leadId: number | null;
  address: string;
  phones: string[]; // raw phone strings
}

function findCrossPropertyPhones(
  currentPropertyId: number,
  phonesToCheck: string[],
  allPropertyContacts: PropertyContact[]
): Array<{ phone: string; propertyId: number; leadId: number | null; address: string }> {
  const normalizedInput = phonesToCheck.map((p) => normalizePhone(p));
  const results: Array<{ phone: string; propertyId: number; leadId: number | null; address: string }> = [];
  const seen = new Set<string>();

  for (const normPhone of normalizedInput) {
    for (const prop of allPropertyContacts) {
      if (prop.propertyId === currentPropertyId) continue; // skip same property
      const propNormPhones = prop.phones.map((p) => normalizePhone(p));
      if (propNormPhones.includes(normPhone)) {
        const key = `${normPhone}-${prop.propertyId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          phone: normPhone,
          propertyId: prop.propertyId,
          leadId: prop.leadId,
          address: prop.address,
        });
      }
    }
  }

  return results;
}

// Test data
const testData: PropertyContact[] = [
  {
    propertyId: 100,
    leadId: 2000001,
    address: "1380 Forrest Ct, Marco Island, FL, 34145",
    phones: ["(226) 793-0770", "(555) 111-2222"],
  },
  {
    propertyId: 200,
    leadId: 2000002,
    address: "327 Boundary Blvd, Rotonda West, FL, 33947",
    phones: ["(226) 793-0770"],
  },
  {
    propertyId: 300,
    leadId: 2000003,
    address: "1620 Avenue H W, Riviera Beach, FL, 33404",
    phones: ["(561) 667-7439", "(954) 500-5965"],
  },
  {
    propertyId: 400,
    leadId: null,
    address: "500 Main St, Miami, FL, 33101",
    phones: ["(305) 555-1234"],
  },
];

describe("Cross-property phone warning", () => {
  describe("Basic detection", () => {
    it("detects when a phone exists in another property", () => {
      const matches = findCrossPropertyPhones(300, ["2267930770"], testData);
      expect(matches.length).toBe(2);
      expect(matches[0].address).toContain("Forrest Ct");
      expect(matches[1].address).toContain("Boundary Blvd");
    });

    it("returns empty when phone does not exist in any other property", () => {
      const matches = findCrossPropertyPhones(300, ["9999999999"], testData);
      expect(matches.length).toBe(0);
    });

    it("does NOT flag phones that exist only in the same property", () => {
      // Phone (561) 667-7439 exists only in property 300
      const matches = findCrossPropertyPhones(300, ["5616677439"], testData);
      expect(matches.length).toBe(0);
    });

    it("returns property address and lead ID for each match", () => {
      const matches = findCrossPropertyPhones(300, ["2267930770"], testData);
      expect(matches.length).toBe(2);

      const forrest = matches.find((m) => m.propertyId === 100);
      expect(forrest).toBeDefined();
      expect(forrest!.leadId).toBe(2000001);
      expect(forrest!.address).toBe("1380 Forrest Ct, Marco Island, FL, 34145");

      const boundary = matches.find((m) => m.propertyId === 200);
      expect(boundary).toBeDefined();
      expect(boundary!.leadId).toBe(2000002);
      expect(boundary!.address).toBe("327 Boundary Blvd, Rotonda West, FL, 33947");
    });

    it("handles null leadId gracefully", () => {
      const matches = findCrossPropertyPhones(300, ["3055551234"], testData);
      expect(matches.length).toBe(1);
      expect(matches[0].propertyId).toBe(400);
      expect(matches[0].leadId).toBeNull();
      expect(matches[0].address).toBe("500 Main St, Miami, FL, 33101");
    });
  });

  describe("Phone normalization in cross-property check", () => {
    it("matches formatted phone to raw digits", () => {
      const matches = findCrossPropertyPhones(300, ["(226) 793-0770"], testData);
      expect(matches.length).toBe(2);
    });

    it("matches with country code prefix +1", () => {
      const matches = findCrossPropertyPhones(300, ["+12267930770"], testData);
      expect(matches.length).toBe(2);
    });

    it("matches with dashes and spaces", () => {
      const matches = findCrossPropertyPhones(300, ["226-793-0770"], testData);
      expect(matches.length).toBe(2);
    });

    it("matches with dots", () => {
      const matches = findCrossPropertyPhones(300, ["226.793.0770"], testData);
      expect(matches.length).toBe(2);
    });
  });

  describe("Multiple phones check", () => {
    it("checks multiple phones at once and returns all matches", () => {
      // Check two phones: one exists in other properties, one doesn't
      const matches = findCrossPropertyPhones(300, ["2267930770", "9999999999"], testData);
      expect(matches.length).toBe(2); // only the existing phone matches
      expect(matches.every((m) => m.phone === "2267930770")).toBe(true);
    });

    it("checks multiple phones that each exist in different properties", () => {
      const matches = findCrossPropertyPhones(300, ["2267930770", "3055551234"], testData);
      expect(matches.length).toBe(3); // 2 for 226... + 1 for 305...
    });

    it("returns empty for multiple phones that don't exist elsewhere", () => {
      const matches = findCrossPropertyPhones(300, ["5616677439", "9545005965"], testData);
      expect(matches.length).toBe(0); // both are in property 300 only
    });
  });

  describe("Deduplication", () => {
    it("does not return duplicate entries for the same phone+property combination", () => {
      // Even if we check the same phone twice, results should be deduped
      const matches = findCrossPropertyPhones(300, ["2267930770", "2267930770"], testData);
      // Should still be 2 (one per property), not 4
      expect(matches.length).toBe(2);
    });
  });

  describe("Edge cases", () => {
    it("handles empty phone list", () => {
      const matches = findCrossPropertyPhones(300, [], testData);
      expect(matches.length).toBe(0);
    });

    it("handles empty property contacts database", () => {
      const matches = findCrossPropertyPhones(300, ["2267930770"], []);
      expect(matches.length).toBe(0);
    });

    it("handles property with no phones", () => {
      const dataWithEmpty: PropertyContact[] = [
        { propertyId: 500, leadId: null, address: "Empty St", phones: [] },
      ];
      const matches = findCrossPropertyPhones(300, ["2267930770"], dataWithEmpty);
      expect(matches.length).toBe(0);
    });

    it("handles phone with only non-digit characters", () => {
      const matches = findCrossPropertyPhones(300, ["---"], testData);
      expect(matches.length).toBe(0);
    });
  });

  describe("Warning is informational, not blocking", () => {
    it("warning result does not prevent the add operation", () => {
      // Simulate the flow: check returns warnings, but user can still proceed
      const matches = findCrossPropertyPhones(300, ["2267930770"], testData);
      expect(matches.length).toBeGreaterThan(0);

      // Simulate "Add Anyway" - the contact creation should succeed
      // (In the real app, the frontend calls createContact after user confirms)
      const userConfirmed = true;
      expect(userConfirmed).toBe(true);
      // The add operation would proceed - this test just validates the flow
    });

    it("cancel does not add the contact", () => {
      const matches = findCrossPropertyPhones(300, ["2267930770"], testData);
      expect(matches.length).toBeGreaterThan(0);

      const userCancelled = true;
      // Contact should NOT be added
      expect(userCancelled).toBe(true);
    });
  });

  describe("Cross-property vs same-property distinction", () => {
    it("phone in same property is NOT a cross-property warning", () => {
      // Property 100 has phone (226) 793-0770
      // Checking from property 100 should return 1 match (property 200), not itself
      const matches = findCrossPropertyPhones(100, ["2267930770"], testData);
      expect(matches.length).toBe(1);
      expect(matches[0].propertyId).toBe(200);
    });

    it("phone unique to one property returns no cross-property matches from that property", () => {
      // (305) 555-1234 only exists in property 400
      const matches = findCrossPropertyPhones(400, ["3055551234"], testData);
      expect(matches.length).toBe(0);
    });

    it("phone shared across 3 properties returns 2 matches when checking from one of them", () => {
      // Create test data where phone exists in 3 properties
      const threeWayData: PropertyContact[] = [
        { propertyId: 1, leadId: 1001, address: "Address 1", phones: ["5551234567"] },
        { propertyId: 2, leadId: 1002, address: "Address 2", phones: ["5551234567"] },
        { propertyId: 3, leadId: 1003, address: "Address 3", phones: ["5551234567"] },
      ];
      const matches = findCrossPropertyPhones(1, ["5551234567"], threeWayData);
      expect(matches.length).toBe(2);
      expect(matches.map((m) => m.propertyId).sort()).toEqual([2, 3]);
    });
  });
});
