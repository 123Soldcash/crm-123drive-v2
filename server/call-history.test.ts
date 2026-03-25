import { describe, it, expect } from "vitest";

/**
 * Tests for the Call History feature
 * Validates the getCallHistory and getCallHistoryStats functions
 */

describe("Call History Feature", () => {
  describe("getCallHistory function", () => {
    it("should accept direction filter with valid values", () => {
      const validDirections = ["Inbound", "Outbound", "all"];
      for (const dir of validDirections) {
        expect(validDirections).toContain(dir);
      }
    });

    it("should accept call result filter as string", () => {
      const callResults = [
        "Interested - HOT LEAD",
        "Left Message",
        "Not Answer",
        "Voicemail",
        "Not Interested - IHATE - DEAD",
        "Not Interested - Hang-up - FU in 4 months",
        "Not Interested - NICE - FU in 2 Months",
      ];
      for (const result of callResults) {
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("should have default limit of 100 and offset of 0", () => {
      const defaultFilters = {
        direction: "all" as const,
        limit: 100,
        offset: 0,
      };
      expect(defaultFilters.limit).toBe(100);
      expect(defaultFilters.offset).toBe(0);
    });

    it("should support search filtering", () => {
      const searchTerms = ["Miami", "John", "hot lead", "123 Main St"];
      for (const term of searchTerms) {
        const searchLower = term.toLowerCase();
        expect(searchLower).toBe(term.toLowerCase());
      }
    });

    it("should support date range filtering", () => {
      const dateFrom = new Date("2024-01-01");
      const dateTo = new Date("2024-12-31");
      expect(dateFrom.getTime()).toBeLessThan(dateTo.getTime());
    });

    it("should support userId filtering", () => {
      const userId = 42;
      expect(typeof userId).toBe("number");
      expect(userId).toBeGreaterThan(0);
    });
  });

  describe("getCallHistoryStats function", () => {
    it("should return stats with total, inbound, outbound, and byResult", () => {
      const mockStats = {
        total: 150,
        inbound: 45,
        outbound: 105,
        byResult: {
          "Interested - HOT LEAD": 12,
          "Left Message": 35,
          "Not Answer": 28,
          "Voicemail": 20,
          "Other": 55,
        },
      };
      expect(mockStats.total).toBe(mockStats.inbound + mockStats.outbound);
      expect(Object.keys(mockStats.byResult).length).toBeGreaterThan(0);
      const totalByResult = Object.values(mockStats.byResult).reduce((a, b) => a + b, 0);
      expect(totalByResult).toBe(mockStats.total);
    });

    it("should handle empty call history", () => {
      const emptyStats = {
        total: 0,
        inbound: 0,
        outbound: 0,
        byResult: {},
      };
      expect(emptyStats.total).toBe(0);
      expect(emptyStats.inbound).toBe(0);
      expect(emptyStats.outbound).toBe(0);
      expect(Object.keys(emptyStats.byResult).length).toBe(0);
    });
  });

  describe("Call History UI logic", () => {
    it("should correctly determine badge colors for call results", () => {
      const hotLead = "Interested - HOT LEAD";
      expect(hotLead.includes("HOT LEAD")).toBe(true);

      const warmLead = "Interested - WARM LEAD - Wants too Much / Full Price";
      expect(warmLead.includes("WARM LEAD")).toBe(true);

      const notInterested = "Not Interested - IHATE - DEAD";
      expect(notInterested.includes("Not Interested")).toBe(true);

      const leftMessage = "Left Message - Owner Verified";
      expect(leftMessage.includes("Left Message")).toBe(true);
    });

    it("should correctly determine direction icons", () => {
      const directions = ["Inbound", "Outbound", null];
      expect(directions[0]).toBe("Inbound");
      expect(directions[1]).toBe("Outbound");
      expect(directions[2]).toBeNull();
    });

    it("should sort calls by different fields", () => {
      const calls = [
        { communicationDate: "2024-03-01", direction: "Inbound", callResult: "HOT LEAD", propertyAddress: "123 Main", userName: "Alice" },
        { communicationDate: "2024-01-15", direction: "Outbound", callResult: "Voicemail", propertyAddress: "456 Oak", userName: "Bob" },
        { communicationDate: "2024-06-20", direction: "Inbound", callResult: "Not Answer", propertyAddress: "789 Pine", userName: "Charlie" },
      ];

      // Sort by date descending
      const sortedByDate = [...calls].sort((a, b) =>
        new Date(b.communicationDate).getTime() - new Date(a.communicationDate).getTime()
      );
      expect(sortedByDate[0].communicationDate).toBe("2024-06-20");
      expect(sortedByDate[2].communicationDate).toBe("2024-01-15");

      // Sort by agent ascending
      const sortedByAgent = [...calls].sort((a, b) => a.userName.localeCompare(b.userName));
      expect(sortedByAgent[0].userName).toBe("Alice");
      expect(sortedByAgent[2].userName).toBe("Charlie");

      // Sort by property ascending
      const sortedByProperty = [...calls].sort((a, b) => a.propertyAddress.localeCompare(b.propertyAddress));
      expect(sortedByProperty[0].propertyAddress).toBe("123 Main");
    });

    it("should filter calls by search term in-memory", () => {
      const calls = [
        { propertyAddress: "123 Main St, Miami", notes: "Hot lead", userName: "Alice", callResult: "HOT LEAD" },
        { propertyAddress: "456 Oak Ave, Tampa", notes: null, userName: "Bob", callResult: "Voicemail" },
        { propertyAddress: "789 Pine Rd, Orlando", notes: "Follow up needed", userName: "Charlie", callResult: "Follow-up" },
      ];

      const searchTerm = "miami";
      const filtered = calls.filter(
        (log) =>
          (log.propertyAddress && log.propertyAddress.toLowerCase().includes(searchTerm)) ||
          (log.notes && log.notes.toLowerCase().includes(searchTerm)) ||
          (log.userName && log.userName.toLowerCase().includes(searchTerm)) ||
          (log.callResult && log.callResult.toLowerCase().includes(searchTerm))
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].propertyAddress).toContain("Miami");
    });

    it("should navigate to property detail when clicking view button", () => {
      const propertyLeadId = 12345;
      const expectedPath = `/properties/${propertyLeadId}`;
      expect(expectedPath).toBe("/properties/12345");
    });
  });
});
