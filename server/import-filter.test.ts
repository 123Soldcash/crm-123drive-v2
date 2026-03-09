import { describe, it, expect } from "vitest";

/**
 * Tests for the REsimple import migration and tag/leadSource/campaignName filtering.
 * These test the data mapping logic and filter parameter validation.
 */

// Lead status mapping (same logic used in the import script)
function mapLeadStatus(status: string): { leadTemperature: string; trackingStatus: string } {
  const statusLower = (status || "").toLowerCase().trim();
  if (statusLower.includes("hot") && !statusLower.includes("super")) {
    return { leadTemperature: "HOT", trackingStatus: "Active" };
  }
  if (statusLower.includes("super hot")) {
    return { leadTemperature: "SUPER HOT", trackingStatus: "Active" };
  }
  if (statusLower.includes("warm")) {
    return { leadTemperature: "WARM", trackingStatus: "Active" };
  }
  if (statusLower.includes("cold")) {
    return { leadTemperature: "COLD", trackingStatus: "Off Market" };
  }
  if (statusLower.includes("dead")) {
    return { leadTemperature: "DEAD", trackingStatus: "Fail" };
  }
  if (statusLower.includes("new")) {
    return { leadTemperature: "WARM", trackingStatus: "New Prospect" };
  }
  return { leadTemperature: "WARM", trackingStatus: "Off Market" };
}

// State abbreviation mapping
function normalizeState(state: string): string {
  const stateMap: Record<string, string> = {
    "florida": "FL",
    "california": "CA",
    "texas": "TX",
    "new york": "NY",
    "georgia": "GA",
  };
  const trimmed = state.trim();
  if (trimmed.length <= 2) return trimmed.toUpperCase();
  return stateMap[trimmed.toLowerCase()] || trimmed.substring(0, 2).toUpperCase();
}

// Phone normalization
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

// Filter validation
function validateFilterParams(params: {
  tag?: string;
  leadSource?: string;
  campaignName?: string;
}): { tag?: string; leadSource?: string; campaignName?: string } {
  return {
    tag: params.tag && params.tag !== "all" ? params.tag : undefined,
    leadSource: params.leadSource && params.leadSource !== "all" ? params.leadSource : undefined,
    campaignName: params.campaignName && params.campaignName !== "all" ? params.campaignName : undefined,
  };
}

describe("REsimple Import - Lead Status Mapping", () => {
  it("maps HOT status correctly", () => {
    const result = mapLeadStatus("Hot");
    expect(result.leadTemperature).toBe("HOT");
    expect(result.trackingStatus).toBe("Active");
  });

  it("maps WARM status correctly", () => {
    const result = mapLeadStatus("Warm");
    expect(result.leadTemperature).toBe("WARM");
    expect(result.trackingStatus).toBe("Active");
  });

  it("maps COLD status correctly", () => {
    const result = mapLeadStatus("Cold");
    expect(result.leadTemperature).toBe("COLD");
    expect(result.trackingStatus).toBe("Off Market");
  });

  it("maps DEAD status correctly", () => {
    const result = mapLeadStatus("Dead");
    expect(result.leadTemperature).toBe("DEAD");
    expect(result.trackingStatus).toBe("Fail");
  });

  it("maps New Lead status correctly", () => {
    const result = mapLeadStatus("New Lead");
    expect(result.leadTemperature).toBe("WARM");
    expect(result.trackingStatus).toBe("New Prospect");
  });

  it("handles empty status", () => {
    const result = mapLeadStatus("");
    expect(result.leadTemperature).toBe("WARM");
    expect(result.trackingStatus).toBe("Off Market");
  });
});

describe("REsimple Import - State Normalization", () => {
  it("keeps 2-letter abbreviations", () => {
    expect(normalizeState("FL")).toBe("FL");
    expect(normalizeState("fl")).toBe("FL");
  });

  it("converts full state names to abbreviations", () => {
    expect(normalizeState("Florida")).toBe("FL");
    expect(normalizeState("california")).toBe("CA");
  });

  it("truncates unknown long state values", () => {
    expect(normalizeState("Unknown State")).toBe("UN");
  });

  it("handles whitespace", () => {
    expect(normalizeState("  FL  ")).toBe("FL");
  });
});

describe("REsimple Import - Phone Normalization", () => {
  it("normalizes 10-digit phone", () => {
    expect(normalizePhone("7542445575")).toBe("+17542445575");
  });

  it("normalizes formatted phone", () => {
    expect(normalizePhone("(754) 244-5575")).toBe("+17542445575");
  });

  it("normalizes 11-digit phone with leading 1", () => {
    expect(normalizePhone("17542445575")).toBe("+17542445575");
  });

  it("handles empty phone", () => {
    expect(normalizePhone("")).toBe("");
  });
});

describe("Property Filter Validation", () => {
  it("passes through valid tag filter", () => {
    const result = validateFilterParams({ tag: "Recimple" });
    expect(result.tag).toBe("Recimple");
  });

  it("clears 'all' tag filter", () => {
    const result = validateFilterParams({ tag: "all" });
    expect(result.tag).toBeUndefined();
  });

  it("passes through valid leadSource filter", () => {
    const result = validateFilterParams({ leadSource: "Cold Calling" });
    expect(result.leadSource).toBe("Cold Calling");
  });

  it("clears 'all' leadSource filter", () => {
    const result = validateFilterParams({ leadSource: "all" });
    expect(result.leadSource).toBeUndefined();
  });

  it("passes through valid campaignName filter", () => {
    const result = validateFilterParams({ campaignName: "Company Data" });
    expect(result.campaignName).toBe("Company Data");
  });

  it("clears 'all' campaignName filter", () => {
    const result = validateFilterParams({ campaignName: "all" });
    expect(result.campaignName).toBeUndefined();
  });

  it("handles all filters at once", () => {
    const result = validateFilterParams({
      tag: "Recimple",
      leadSource: "Direct Mail",
      campaignName: "AVA",
    });
    expect(result.tag).toBe("Recimple");
    expect(result.leadSource).toBe("Direct Mail");
    expect(result.campaignName).toBe("AVA");
  });

  it("handles empty string filters", () => {
    const result = validateFilterParams({
      tag: "",
      leadSource: "",
      campaignName: "",
    });
    expect(result.tag).toBeUndefined();
    expect(result.leadSource).toBeUndefined();
    expect(result.campaignName).toBeUndefined();
  });
});
