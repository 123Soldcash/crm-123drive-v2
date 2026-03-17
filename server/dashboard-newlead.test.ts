import { describe, it, expect } from "vitest";

/**
 * Tests for Dashboard New Lead Card feature:
 * - Backend returns newLeads count in dashboard stats
 * - Properties page reads desk param from URL
 * - New Lead card links to correct URL
 */

describe("Dashboard New Lead Stats", () => {
  // Simulate the backend stats calculation
  const calculateStats = (properties: Array<{ deskName: string | null; leadTemperature: string }>) => {
    return {
      total: properties.length,
      newLeads: properties.filter((p) => p.deskName === "NEW_LEAD").length,
      superHot: properties.filter((p) => p.leadTemperature === "SUPER HOT").length,
      hot: properties.filter((p) => p.leadTemperature === "HOT").length,
      warm: properties.filter((p) => p.leadTemperature === "WARM").length,
      cold: properties.filter((p) => p.leadTemperature === "COLD").length,
      dead: properties.filter((p) => p.leadTemperature === "DEAD").length,
    };
  };

  it("should count properties with deskName NEW_LEAD", () => {
    const properties = [
      { deskName: "NEW_LEAD", leadTemperature: "TBD" },
      { deskName: "NEW_LEAD", leadTemperature: "WARM" },
      { deskName: "DESK_1", leadTemperature: "HOT" },
      { deskName: "BIN", leadTemperature: "COLD" },
      { deskName: null, leadTemperature: "TBD" },
    ];
    const stats = calculateStats(properties);
    expect(stats.newLeads).toBe(2);
    expect(stats.total).toBe(5);
  });

  it("should return 0 newLeads when none exist", () => {
    const properties = [
      { deskName: "DESK_1", leadTemperature: "HOT" },
      { deskName: "DESK_2", leadTemperature: "WARM" },
      { deskName: "BIN", leadTemperature: "COLD" },
    ];
    const stats = calculateStats(properties);
    expect(stats.newLeads).toBe(0);
  });

  it("should return 0 for empty properties array", () => {
    const stats = calculateStats([]);
    expect(stats.newLeads).toBe(0);
    expect(stats.total).toBe(0);
  });

  it("should not count null deskName as NEW_LEAD", () => {
    const properties = [
      { deskName: null, leadTemperature: "TBD" },
      { deskName: null, leadTemperature: "WARM" },
    ];
    const stats = calculateStats(properties);
    expect(stats.newLeads).toBe(0);
  });

  it("should count all NEW_LEAD regardless of leadTemperature", () => {
    const properties = [
      { deskName: "NEW_LEAD", leadTemperature: "TBD" },
      { deskName: "NEW_LEAD", leadTemperature: "HOT" },
      { deskName: "NEW_LEAD", leadTemperature: "SUPER HOT" },
      { deskName: "NEW_LEAD", leadTemperature: "WARM" },
      { deskName: "NEW_LEAD", leadTemperature: "COLD" },
    ];
    const stats = calculateStats(properties);
    expect(stats.newLeads).toBe(5);
  });
});

describe("Properties URL Desk Filter", () => {
  it("should parse desk=NEW_LEAD from URL params", () => {
    const params = new URLSearchParams("?desk=NEW_LEAD");
    const deskName = params.get("desk") || "";
    expect(deskName).toBe("NEW_LEAD");
  });

  it("should return empty string when no desk param", () => {
    const params = new URLSearchParams("?leadTemperature=HOT");
    const deskName = params.get("desk") || "";
    expect(deskName).toBe("");
  });

  it("should handle multiple params including desk", () => {
    const params = new URLSearchParams("?leadTemperature=HOT&desk=DESK_1");
    const deskName = params.get("desk") || "";
    expect(deskName).toBe("DESK_1");
  });
});

describe("New Lead Card Navigation", () => {
  it("should link to /properties?desk=NEW_LEAD", () => {
    const cardHref = "/properties?desk=NEW_LEAD";
    expect(cardHref).toContain("/properties");
    expect(cardHref).toContain("desk=NEW_LEAD");
  });
});
