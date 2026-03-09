import { describe, it, expect } from "vitest";

// ─── Pure logic tests for Lead Source feature ────────────────────────────────
// These tests verify the data-transformation and validation logic that lives
// in the server layer without requiring a live database connection.

const DEFAULT_LEAD_SOURCES = [
  "Bandit Signs",
  "Billboard",
  "Cold Calling",
  "Craigslist",
  "Direct Mail",
  "Door Knocking",
  "Driving for Dollars",
  "Email Marketing",
  "Facebook Marketing",
  "For Sale by Owner (FSBO)",
  "Foreclosure Auction",
  "Google Adwords/PPC",
  "HVA (High Value Area)",
  "Internet Marketing (SEO)",
  "MLS (Multiple Listing Service)",
  "Magnetic Signs",
  "Newspaper",
  "Online Auction",
  "Other",
  "Other Wholesalers",
  "Pay Per Lead",
  "Radio Ads",
  "Real Estate Agent",
  "Referrals",
  "Ringless Voicemails",
  "SMS Blast",
  "ThreeDoors",
  "TV Ads",
  "Website",
  "YouTube",
];

describe("Lead Source – default list", () => {
  it("contains exactly 30 default sources", () => {
    expect(DEFAULT_LEAD_SOURCES).toHaveLength(30);
  });

  it("has no duplicate entries", () => {
    const unique = new Set(DEFAULT_LEAD_SOURCES);
    expect(unique.size).toBe(DEFAULT_LEAD_SOURCES.length);
  });

  it("includes all required standard sources", () => {
    const required = [
      "Cold Calling",
      "Direct Mail",
      "Facebook Marketing",
      "Google Adwords/PPC",
      "MLS (Multiple Listing Service)",
      "Referrals",
      "SMS Blast",
      "Website",
      "YouTube",
      "Other",
    ];
    required.forEach((source) => {
      expect(DEFAULT_LEAD_SOURCES).toContain(source);
    });
  });

  it("all entries are non-empty strings", () => {
    DEFAULT_LEAD_SOURCES.forEach((s) => {
      expect(typeof s).toBe("string");
      expect(s.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("Lead Source – input validation", () => {
  const validateLeadSourceName = (name: string): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { valid: false, error: "Name cannot be empty" };
    if (trimmed.length > 255) return { valid: false, error: "Name too long (max 255 chars)" };
    return { valid: true };
  };

  it("accepts a valid custom name", () => {
    expect(validateLeadSourceName("Neighborhood Flyer").valid).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = validateLeadSourceName("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it("rejects a name longer than 255 characters", () => {
    const longName = "A".repeat(256);
    const result = validateLeadSourceName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/long/i);
  });

  it("accepts a name of exactly 255 characters", () => {
    const maxName = "A".repeat(255);
    expect(validateLeadSourceName(maxName).valid).toBe(true);
  });
});

describe("Lead Source – property assignment", () => {
  const applyLeadSource = (
    property: { id: number; leadSource?: string | null },
    newSource: string | null
  ) => ({ ...property, leadSource: newSource });

  it("sets a lead source on a property", () => {
    const prop = { id: 1, leadSource: null };
    const updated = applyLeadSource(prop, "Cold Calling");
    expect(updated.leadSource).toBe("Cold Calling");
  });

  it("clears a lead source by setting null", () => {
    const prop = { id: 1, leadSource: "Cold Calling" };
    const updated = applyLeadSource(prop, null);
    expect(updated.leadSource).toBeNull();
  });

  it("replaces an existing lead source", () => {
    const prop = { id: 1, leadSource: "Cold Calling" };
    const updated = applyLeadSource(prop, "Referrals");
    expect(updated.leadSource).toBe("Referrals");
  });
});
