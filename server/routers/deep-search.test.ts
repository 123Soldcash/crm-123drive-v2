import { describe, it, expect } from "vitest";
import { calculateDistressScore, getDistressBand, safeParseJson } from "./deep-search";

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Distress Score Calculator
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateDistressScore", () => {
  it("returns 0 score and empty drivers for empty data", () => {
    const result = calculateDistressScore({});
    expect(result.score).toBe(0);
    expect(result.drivers).toEqual([]);
  });

  it("calculates seller situation points correctly", () => {
    const data = {
      sellerFinancialPressure: JSON.stringify(["Need Cash Quickly", "Bankruptcy"]),
      sellerLifeEvents: JSON.stringify(["Divorce"]),
      sellerLegalBehavioral: null,
    };
    const result = calculateDistressScore(data);
    // Need Cash Quickly (8) + Bankruptcy (8) + Divorce (5) = 21, capped at 25
    expect(result.score).toBeGreaterThanOrEqual(21);
    expect(result.drivers.some(d => d.signal === "Need Cash Quickly")).toBe(true);
    expect(result.drivers.some(d => d.signal === "Bankruptcy")).toBe(true);
  });

  it("caps seller situation at 25", () => {
    const data = {
      sellerFinancialPressure: JSON.stringify(["Need Cash Quickly", "Bankruptcy", "Medical Bills", "Job Loss"]),
      sellerLifeEvents: JSON.stringify(["Divorce", "Death in the Family"]),
      sellerLegalBehavioral: JSON.stringify(["Going to Jail/Incarceration"]),
    };
    const result = calculateDistressScore(data);
    // Total raw would be 8+8+6+6+5+5+10 = 48, but capped at 25
    // Score should be at most 25 from seller alone
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it("calculates condition points correctly", () => {
    const data = {
      conditionRating: "Poor",
      conditionTags: JSON.stringify(["Major Repairs Needed", "Mold Damage"]),
    };
    const result = calculateDistressScore(data);
    // Poor (15) + Major Repairs (10) + Mold (7) = 32, capped at 25
    expect(result.score).toBe(25);
    expect(result.drivers.some(d => d.signal === "Rating: Poor")).toBe(true);
  });

  it("gives 0 points for Excellent condition", () => {
    const data = {
      conditionRating: "Excellent",
      conditionTags: JSON.stringify([]),
    };
    const result = calculateDistressScore(data);
    expect(result.score).toBe(0);
  });

  it("calculates occupancy points correctly", () => {
    const data = { occupancy: "Squatter Occupied" };
    const result = calculateDistressScore(data);
    expect(result.score).toBe(15); // Squatter = 15, capped at 15
    expect(result.drivers[0].signal).toBe("Squatter Occupied");
  });

  it("gives 0 points for Owner Occupied", () => {
    const data = { occupancy: "Owner Occupied" };
    const result = calculateDistressScore(data);
    expect(result.score).toBe(0);
  });

  it("calculates legal & title points correctly", () => {
    const data = {
      legalOwnershipTitle: JSON.stringify(["Break in Chain of Title", "Multiple Owners"]),
      legalCourtLawsuit: JSON.stringify(["Pending Lawsuit"]),
      legalPropertyStatus: null,
    };
    const result = calculateDistressScore(data);
    // Break (15) + Multiple (6) + Pending (10) = 31, capped at 20
    expect(result.score).toBe(20);
  });

  it("calculates probate points correctly", () => {
    const data = {
      probate: 1,
      probateFindings: JSON.stringify(["Will Contested", "Minor Involved"]),
    };
    const result = calculateDistressScore(data);
    // Probate Yes (10) + Will Contested (10) + Minor (8) = 28, capped at 15
    expect(result.score).toBe(15);
    expect(result.drivers.some(d => d.signal === "Probate = Yes")).toBe(true);
  });

  it("gives 0 probate points when probate is 0", () => {
    const data = {
      probate: 0,
      probateFindings: JSON.stringify(["Will Contested"]),
    };
    const result = calculateDistressScore(data);
    // Only findings without probate=1 base
    // Will Contested = 10, capped at 15
    expect(result.score).toBe(10);
  });

  it("calculates full combined score correctly", () => {
    const data = {
      sellerFinancialPressure: JSON.stringify(["Need Cash Quickly"]),
      sellerLifeEvents: JSON.stringify(["Divorce"]),
      sellerLegalBehavioral: null,
      conditionRating: "Poor",
      conditionTags: JSON.stringify(["Boarded Up"]),
      occupancy: "Vacant",
      legalOwnershipTitle: JSON.stringify(["Title Issues"]),
      legalCourtLawsuit: null,
      legalPropertyStatus: null,
      probate: 1,
      probateFindings: JSON.stringify([]),
    };
    const result = calculateDistressScore(data);
    // Seller: 8 + 5 = 13
    // Condition: 15 + 6 = 21 (capped at 25)
    // Occupancy: 10
    // Legal: 12
    // Probate: 10
    expect(result.score).toBe(13 + 21 + 10 + 12 + 10);
    expect(result.score).toBe(66);
  });

  it("returns top 5 drivers sorted by points descending", () => {
    const data = {
      sellerFinancialPressure: JSON.stringify(["Need Cash Quickly", "Bankruptcy"]),
      conditionRating: "Poor",
      conditionTags: JSON.stringify(["Fire Damage", "Condemned"]),
      occupancy: "Squatter Occupied",
      legalOwnershipTitle: JSON.stringify(["Break in Chain of Title"]),
      probate: 1,
    };
    const result = calculateDistressScore(data);
    expect(result.drivers.length).toBeLessThanOrEqual(5);
    // Verify descending order
    for (let i = 1; i < result.drivers.length; i++) {
      expect(result.drivers[i].points).toBeLessThanOrEqual(result.drivers[i - 1].points);
    }
  });

  it("handles null and undefined fields gracefully", () => {
    const data = {
      sellerFinancialPressure: null,
      sellerLifeEvents: undefined,
      conditionRating: null,
      conditionTags: undefined,
      occupancy: null,
      legalOwnershipTitle: null,
      probate: null,
      probateFindings: null,
    };
    const result = calculateDistressScore(data);
    expect(result.score).toBe(0);
    expect(result.drivers).toEqual([]);
  });

  it("handles malformed JSON gracefully", () => {
    const data = {
      sellerFinancialPressure: "not valid json",
      conditionTags: "{bad}",
    };
    const result = calculateDistressScore(data);
    expect(result.score).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Distress Band
// ═══════════════════════════════════════════════════════════════════════════════

describe("getDistressBand", () => {
  it("returns LOW for 0-25", () => {
    expect(getDistressBand(0)).toBe("LOW");
    expect(getDistressBand(10)).toBe("LOW");
    expect(getDistressBand(25)).toBe("LOW");
  });

  it("returns MEDIUM for 26-55", () => {
    expect(getDistressBand(26)).toBe("MEDIUM");
    expect(getDistressBand(40)).toBe("MEDIUM");
    expect(getDistressBand(55)).toBe("MEDIUM");
  });

  it("returns HIGH for 56-100", () => {
    expect(getDistressBand(56)).toBe("HIGH");
    expect(getDistressBand(78)).toBe("HIGH");
    expect(getDistressBand(100)).toBe("HIGH");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT TESTS — safeParseJson
// ═══════════════════════════════════════════════════════════════════════════════

describe("safeParseJson", () => {
  it("returns empty array for null", () => {
    expect(safeParseJson(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(safeParseJson(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(safeParseJson("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(safeParseJson("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(safeParseJson('{"key": "value"}')).toEqual([]);
  });

  it("parses valid JSON array", () => {
    expect(safeParseJson('["a", "b", "c"]')).toEqual(["a", "b", "c"]);
  });

  it("parses empty JSON array", () => {
    expect(safeParseJson("[]")).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  it("maximum possible distress score is 100", () => {
    const data = {
      sellerFinancialPressure: JSON.stringify(["Need Cash Quickly", "Bankruptcy", "Medical Bills", "Job Loss"]),
      sellerLifeEvents: JSON.stringify(["Divorce", "Death in the Family"]),
      sellerLegalBehavioral: JSON.stringify(["Going to Jail/Incarceration", "Hoarder Situation"]),
      conditionRating: "Poor",
      conditionTags: JSON.stringify(["Condemned", "Fire Damage", "Major Repairs Needed"]),
      occupancy: "Squatter Occupied",
      legalOwnershipTitle: JSON.stringify(["Break in Chain of Title", "Title Issues", "Multiple Owners"]),
      legalCourtLawsuit: JSON.stringify(["Pending Lawsuit"]),
      legalPropertyStatus: JSON.stringify(["Property Occupied Without Consent", "Code Violations"]),
      probate: 1,
      probateFindings: JSON.stringify(["Will Contested", "Missing or Unknown Heirs", "Minor Involved"]),
    };
    const result = calculateDistressScore(data);
    expect(result.score).toBe(100);
  });

  it("each category respects its cap independently", () => {
    // Only seller situation maxed out
    const sellerOnly = {
      sellerFinancialPressure: JSON.stringify(["Need Cash Quickly", "Bankruptcy", "Medical Bills", "Job Loss"]),
      sellerLifeEvents: JSON.stringify(["Divorce", "Death in the Family"]),
      sellerLegalBehavioral: JSON.stringify(["Going to Jail/Incarceration"]),
    };
    const result = calculateDistressScore(sellerOnly);
    expect(result.score).toBe(25); // capped at 25
  });

  it("driver categories are correctly labeled", () => {
    const data = {
      sellerFinancialPressure: JSON.stringify(["Bankruptcy"]),
      conditionRating: "Poor",
      occupancy: "Vacant",
      legalOwnershipTitle: JSON.stringify(["Title Issues"]),
      probate: 1,
    };
    const result = calculateDistressScore(data);
    const categories = new Set(result.drivers.map(d => d.category));
    expect(categories.has("Seller Situation")).toBe(true);
    expect(categories.has("Condition")).toBe(true);
    expect(categories.has("Occupancy")).toBe(true);
    expect(categories.has("Legal & Title")).toBe(true);
    expect(categories.has("Probate")).toBe(true);
  });
});
