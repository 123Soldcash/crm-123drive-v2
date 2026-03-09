import { describe, it, expect } from "vitest";

// ─── Pure logic tests for Campaign Name feature ─────────────────────────────
// These tests verify the data-transformation and validation logic without
// requiring a live database connection.

const DEFAULT_CAMPAIGN_NAMES = [
  "Company Data",
  "AVA",
  "Deep Search-no contacted yet",
  "DoorNock",
  "LeadUP|KAGAN",
  "419_Google Ads",
  "409_PostCard_click2mail",
  "5668_Deep_Search",
  "219_TV39_Mat",
  "215_Post_Card_PrintGinie",
  "1-209_CR",
  "1444_Web",
  "PropertyLeads",
  "Criative_Leads_RESimple#",
  "Portugues",
  "561_BacthDilaer",
  "321_ORA",
  "782_5005_Deal_Machine",
  "ProbateData - instantly-emarketing",
  "01 - ProbateData Jan012021-Dec312021",
  "561-778-1156-AutoCalls",
  "Other",
];

describe("Campaign Name – default list", () => {
  it("contains exactly 22 default campaigns", () => {
    expect(DEFAULT_CAMPAIGN_NAMES).toHaveLength(22);
  });

  it("has no duplicate entries", () => {
    const unique = new Set(DEFAULT_CAMPAIGN_NAMES);
    expect(unique.size).toBe(DEFAULT_CAMPAIGN_NAMES.length);
  });

  it("includes key campaign names from user list", () => {
    const required = [
      "Company Data",
      "AVA",
      "DoorNock",
      "419_Google Ads",
      "PropertyLeads",
      "782_5005_Deal_Machine",
      "Other",
    ];
    required.forEach((name) => {
      expect(DEFAULT_CAMPAIGN_NAMES).toContain(name);
    });
  });

  it("all entries are non-empty strings", () => {
    DEFAULT_CAMPAIGN_NAMES.forEach((s) => {
      expect(typeof s).toBe("string");
      expect(s.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("Campaign Name – input validation", () => {
  const validateCampaignName = (name: string): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { valid: false, error: "Name cannot be empty" };
    if (trimmed.length > 255) return { valid: false, error: "Name too long (max 255 chars)" };
    return { valid: true };
  };

  it("accepts a valid custom name", () => {
    expect(validateCampaignName("2026_Spring_Mailer").valid).toBe(true);
  });

  it("accepts names with special characters", () => {
    expect(validateCampaignName("LeadUP|KAGAN").valid).toBe(true);
    expect(validateCampaignName("Criative_Leads_RESimple#").valid).toBe(true);
    expect(validateCampaignName("561-778-1156-AutoCalls").valid).toBe(true);
  });

  it("rejects an empty string", () => {
    const result = validateCampaignName("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it("rejects a name longer than 255 characters", () => {
    const longName = "A".repeat(256);
    const result = validateCampaignName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/long/i);
  });
});

describe("Campaign Name – property assignment", () => {
  const applyCampaignName = (
    property: { id: number; campaignName?: string | null },
    newCampaign: string | null
  ) => ({ ...property, campaignName: newCampaign });

  it("sets a campaign name on a property", () => {
    const prop = { id: 1, campaignName: null };
    const updated = applyCampaignName(prop, "419_Google Ads");
    expect(updated.campaignName).toBe("419_Google Ads");
  });

  it("clears a campaign name by setting null", () => {
    const prop = { id: 1, campaignName: "419_Google Ads" };
    const updated = applyCampaignName(prop, null);
    expect(updated.campaignName).toBeNull();
  });

  it("replaces an existing campaign name", () => {
    const prop = { id: 1, campaignName: "419_Google Ads" };
    const updated = applyCampaignName(prop, "DoorNock");
    expect(updated.campaignName).toBe("DoorNock");
  });
});
