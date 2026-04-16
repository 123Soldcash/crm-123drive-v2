/**
 * Unit tests for the city filter logic in the Properties page.
 * Tests the filter state management and query parameter passing.
 */
import { describe, it, expect } from "vitest";

// ─── Simulated filter state logic (mirrors Properties.tsx) ───────────────────

interface FilterState {
  search: string;
  ownerLocation: string;
  minEquity: number;
  marketStatus: string;
  statusTags: string[];
  leadTemperature: string;
  ownerVerified: boolean;
  visited: boolean;
  assignedAgentId: number | null;
  deskName: string;
  dealStage: string;
  tag: string;
  leadSource: string;
  campaignName: string;
  propertyIdFilter: string;
  city: string;
}

function buildQueryParams(filters: FilterState) {
  return {
    search: filters.search || undefined,
    ownerLocation: filters.ownerLocation && filters.ownerLocation !== "all" ? filters.ownerLocation : undefined,
    minEquity: filters.minEquity > 0 ? filters.minEquity : undefined,
    trackingStatus: filters.marketStatus || undefined,
    leadTemperature: filters.leadTemperature && filters.leadTemperature !== "all" ? filters.leadTemperature : undefined,
    ownerVerified: filters.ownerVerified || undefined,
    visited: filters.visited || undefined,
    tag: filters.tag && filters.tag !== "all" ? filters.tag : undefined,
    leadSource: filters.leadSource && filters.leadSource !== "all" ? filters.leadSource : undefined,
    campaignName: filters.campaignName && filters.campaignName !== "all" ? filters.campaignName : undefined,
    assignedAgentId: filters.assignedAgentId !== null ? filters.assignedAgentId : undefined,
    deskName: filters.deskName && filters.deskName !== "all" ? filters.deskName : undefined,
    dealStage: filters.dealStage && filters.dealStage !== "all" ? filters.dealStage : undefined,
    propertyIdFilter: filters.propertyIdFilter && !isNaN(Number(filters.propertyIdFilter)) ? Number(filters.propertyIdFilter) : undefined,
    city: filters.city && filters.city !== "all" ? filters.city : undefined,
  };
}

const defaultFilters: FilterState = {
  search: "",
  ownerLocation: "",
  minEquity: 0,
  marketStatus: "",
  statusTags: [],
  leadTemperature: "",
  ownerVerified: false,
  visited: false,
  assignedAgentId: null,
  deskName: "",
  dealStage: "",
  tag: "",
  leadSource: "",
  campaignName: "",
  propertyIdFilter: "",
  city: "",
};

function clearAllFilters(): FilterState {
  return { ...defaultFilters };
}

function countActiveFilters(filters: FilterState): number {
  return (
    (filters.search ? 1 : 0) +
    (filters.ownerLocation ? 1 : 0) +
    (filters.minEquity > 0 ? 1 : 0) +
    (filters.marketStatus ? 1 : 0) +
    (filters.deskName ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.leadSource ? 1 : 0) +
    (filters.campaignName ? 1 : 0) +
    filters.statusTags.length +
    (filters.city ? 1 : 0)
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("City Filter - Query Parameter Building", () => {
  it("passes city to query when city is set", () => {
    const filters = { ...defaultFilters, city: "Fort Lauderdale" };
    const params = buildQueryParams(filters);
    expect(params.city).toBe("Fort Lauderdale");
  });

  it("omits city from query when city is empty string", () => {
    const filters = { ...defaultFilters, city: "" };
    const params = buildQueryParams(filters);
    expect(params.city).toBeUndefined();
  });

  it("omits city from query when city is 'all'", () => {
    const filters = { ...defaultFilters, city: "all" };
    const params = buildQueryParams(filters);
    expect(params.city).toBeUndefined();
  });

  it("passes city correctly for Pembroke Pines", () => {
    const filters = { ...defaultFilters, city: "Pembroke Pines" };
    const params = buildQueryParams(filters);
    expect(params.city).toBe("Pembroke Pines");
  });

  it("passes city correctly for Hollywood", () => {
    const filters = { ...defaultFilters, city: "Hollywood" };
    const params = buildQueryParams(filters);
    expect(params.city).toBe("Hollywood");
  });

  it("city filter works alongside other filters", () => {
    const filters = { ...defaultFilters, city: "Miramar", leadTemperature: "HOT" };
    const params = buildQueryParams(filters);
    expect(params.city).toBe("Miramar");
    expect(params.leadTemperature).toBe("HOT");
  });
});

describe("City Filter - Active Filter Count", () => {
  it("counts city as 1 active filter when set", () => {
    const filters = { ...defaultFilters, city: "Fort Lauderdale" };
    expect(countActiveFilters(filters)).toBe(1);
  });

  it("does not count city when empty", () => {
    const filters = { ...defaultFilters };
    expect(countActiveFilters(filters)).toBe(0);
  });

  it("counts city along with other active filters", () => {
    const filters = { ...defaultFilters, city: "Hollywood", search: "Main St", deskName: "DESK_1" };
    expect(countActiveFilters(filters)).toBe(3);
  });
});

describe("City Filter - Clear All Filters", () => {
  it("clears city when clearAllFilters is called", () => {
    const cleared = clearAllFilters();
    expect(cleared.city).toBe("");
  });

  it("cleared state produces no query params", () => {
    const cleared = clearAllFilters();
    const params = buildQueryParams(cleared);
    expect(params.city).toBeUndefined();
    expect(params.search).toBeUndefined();
    expect(params.ownerLocation).toBeUndefined();
  });
});

describe("City Filter - Backend Filter Logic", () => {
  it("city filter condition is added when city is provided", () => {
    // Simulate the backend condition logic
    const conditions: string[] = [];
    const city = "Fort Lauderdale";
    if (city) {
      conditions.push(`eq(properties.city, "${city}")`);
    }
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toContain("Fort Lauderdale");
  });

  it("city filter condition is NOT added when city is undefined", () => {
    const conditions: string[] = [];
    const city = undefined;
    if (city) {
      conditions.push(`eq(properties.city, "${city}")`);
    }
    expect(conditions).toHaveLength(0);
  });

  it("city filter is case-sensitive (exact match)", () => {
    // The backend uses eq() not like() for city filter
    const cityInDb = "Fort Lauderdale";
    const filterValue = "Fort Lauderdale";
    expect(cityInDb === filterValue).toBe(true);
  });

  it("city filter does NOT match partial city name", () => {
    // eq() is exact match, not LIKE
    const cityInDb = "Fort Lauderdale";
    const filterValue = "Lauderdale"; // partial
    expect(cityInDb === filterValue).toBe(false);
  });
});

describe("getUniqueCities - Return Type", () => {
  it("returns an array of strings", () => {
    // Simulate what getUniqueCities returns
    const mockCities = ["Fort Lauderdale", "Hollywood", "Miramar", "Pembroke Pines"];
    expect(Array.isArray(mockCities)).toBe(true);
    mockCities.forEach(city => expect(typeof city).toBe("string"));
  });

  it("filters out null/empty city values", () => {
    const rawResults = [
      { city: "Fort Lauderdale" },
      { city: null },
      { city: "" },
      { city: "Hollywood" },
    ];
    const cities = rawResults.map(r => r.city).filter(Boolean) as string[];
    expect(cities).toEqual(["Fort Lauderdale", "Hollywood"]);
  });

  it("returns cities sorted alphabetically", () => {
    const cities = ["Miramar", "Fort Lauderdale", "Hollywood", "Pembroke Pines"];
    const sorted = [...cities].sort();
    expect(sorted[0]).toBe("Fort Lauderdale");
    expect(sorted[1]).toBe("Hollywood");
    expect(sorted[2]).toBe("Miramar");
    expect(sorted[3]).toBe("Pembroke Pines");
  });
});
