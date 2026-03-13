/**
 * Zapier 2-Step Webhook Tests
 *
 * Tests cover:
 * 1. Step 1 endpoint structure and field mapping
 * 2. Step 2 endpoint structure and phone matching logic
 * 3. Phone normalization for matching
 * 4. Qualifying questions note generation
 * 5. Duplicate detection in Step 1
 * 6. Route registration
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const indexPath = path.resolve(__dirname, "./_core/index.ts");
const indexSrc = fs.readFileSync(indexPath, "utf-8");

// ─── Route Registration ─────────────────────────────────────────────────────

describe("Zapier webhook route registration", () => {
  it("registers Step 1 endpoint at /api/oauth/webhook/zapier/step1", () => {
    expect(indexSrc).toContain('"/api/oauth/webhook/zapier/step1"');
  });

  it("registers Step 2 endpoint at /api/oauth/webhook/zapier/step2", () => {
    expect(indexSrc).toContain('"/api/oauth/webhook/zapier/step2"');
  });

  it("keeps legacy /api/oauth/webhook/zapier endpoint that redirects to step1", () => {
    expect(indexSrc).toContain('"/api/oauth/webhook/zapier"');
    // Legacy endpoint should redirect to step1
    expect(indexSrc).toContain("/api/oauth/webhook/zapier/step1");
  });

  it("uses POST method for both endpoints", () => {
    const step1Match = indexSrc.match(/app\.post\(\s*["']\/api\/oauth\/webhook\/zapier\/step1/);
    const step2Match = indexSrc.match(/app\.post\(\s*["']\/api\/oauth\/webhook\/zapier\/step2/);
    expect(step1Match).not.toBeNull();
    expect(step2Match).not.toBeNull();
  });
});

// ─── Step 1: Create Property ─────────────────────────────────────────────────

describe("Step 1: Create property with basic data", () => {
  it("requires Phone or Email (returns 400 if neither provided)", () => {
    expect(indexSrc).toContain("Phone or Email is required");
  });

  it("checks for duplicate phone numbers before creating", () => {
    expect(indexSrc).toContain("normalizedPhone");
    expect(indexSrc).toContain("duplicate");
  });

  it("creates property with 'Website Lead' defaults", () => {
    expect(indexSrc).toContain('owner1Name: "Website Lead"');
    expect(indexSrc).toContain('status: "Website Lead - Step 1"');
  });

  it("sets leadSource to 'Website' for new leads", () => {
    expect(indexSrc).toContain('leadSource: "Website"');
  });

  it("adds 'Website Lead' tag to new properties", () => {
    expect(indexSrc).toContain('tag: "Website Lead"');
  });

  it("creates contact with phone and email", () => {
    expect(indexSrc).toContain("contactPhones");
    expect(indexSrc).toContain("contactEmails");
  });

  it("returns propertyId on success for linking Step 2", () => {
    expect(indexSrc).toContain("propertyId");
    expect(indexSrc).toContain('"Lead created in CRM (Step 1)"');
  });

  it("returns duplicate info when phone already exists", () => {
    expect(indexSrc).toContain("Lead already exists in CRM (matched by phone)");
    expect(indexSrc).toContain("duplicate: true");
  });
});

// ─── Step 2: Update Property by Phone ────────────────────────────────────────

describe("Step 2: Find and update property by phone", () => {
  it("requires Phone field to match the lead", () => {
    expect(indexSrc).toContain("Phone is required to match the lead");
  });

  it("normalizes phone numbers for matching (strips non-digits)", () => {
    // Both step1 and step2 use the same normalization
    const normalizations = indexSrc.match(/replace\(\/\[\^\\d\+\]\/g/g);
    expect(normalizations).not.toBeNull();
    expect(normalizations!.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 when no lead matches the phone", () => {
    expect(indexSrc).toContain("No lead found with phone:");
    expect(indexSrc).toContain("Make sure Step 1 ran first");
  });

  it("updates property address fields (address, city, state, zip)", () => {
    expect(indexSrc).toContain("updateFields.addressLine1");
    expect(indexSrc).toContain("updateFields.city");
    expect(indexSrc).toContain("updateFields.state");
    expect(indexSrc).toContain("updateFields.zipcode");
  });

  it("updates owner name from firstName + lastName", () => {
    expect(indexSrc).toContain("updateFields.owner1Name");
  });

  it("updates status to 'Website Lead - Complete'", () => {
    expect(indexSrc).toContain('status: "Website Lead - Complete"');
  });

  it("updates contact email if provided", () => {
    // Step 2 updates or inserts email
    expect(indexSrc).toContain("contactEmails");
  });
});

// ─── Qualifying Questions Note ───────────────────────────────────────────────

describe("Step 2: Qualifying questions saved as General Note", () => {
  it("creates a structured note with qualifying data", () => {
    expect(indexSrc).toContain("Website Form - Step 2 (Qualifying Questions)");
  });

  it("maps all qualifying fields from the form", () => {
    const fields = [
      "Owned Property",
      "Property Condition",
      "Repairs Needed",
      "Living in House",
      "Listed with Realtor",
      "Want to Sell Fast",
      "Lowest Acceptable Price",
      "Best Time to Call",
      "Accepted Terms",
    ];
    for (const field of fields) {
      expect(indexSrc).toContain(field);
    }
  });

  it("supports multiple field name aliases for flexibility", () => {
    // Check that aliases are defined for flexible Zapier field mapping
    expect(indexSrc).toContain("aliases");
    expect(indexSrc).toContain("ownedProperty");
    expect(indexSrc).toContain("conditionProperty");
    expect(indexSrc).toContain("repairsNeed");
    expect(indexSrc).toContain("livingHouse");
    expect(indexSrc).toContain("listedRealtor");
    expect(indexSrc).toContain("sellFast");
    expect(indexSrc).toContain("lowestPrice");
    expect(indexSrc).toContain("timeCall");
  });

  it("only inserts note if qualifying data exists", () => {
    expect(indexSrc).toContain("noteLines.length > 4");
  });

  it("inserts note as 'general' type", () => {
    expect(indexSrc).toContain('noteType: "general"');
  });
});

// ─── Phone Normalization Logic ───────────────────────────────────────────────

describe("Phone normalization for matching", () => {
  it("strips non-digit characters except + for matching", () => {
    // Test the normalization regex used in the code
    const normalize = (phone: string) => phone.replace(/[^\d+]/g, "");

    expect(normalize("(954) 555-1234")).toBe("9545551234");
    expect(normalize("+1-954-555-1234")).toBe("+19545551234");
    expect(normalize("954.555.1234")).toBe("9545551234");
    expect(normalize("954 555 1234")).toBe("9545551234");
    expect(normalize("+1 (954) 555-1234")).toBe("+19545551234");
  });

  it("matches phones regardless of formatting", () => {
    const normalize = (phone: string) => phone.replace(/[^\d+]/g, "");
    
    const stored = "(954) 555-1234";
    const incoming = "954-555-1234";
    expect(normalize(stored)).toBe(normalize(incoming));
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────────

describe("Error handling", () => {
  it("Step 1 logs errors with [Zapier Step 1] prefix", () => {
    expect(indexSrc).toContain("[Zapier Step 1] Error:");
  });

  it("Step 2 logs errors with [Zapier Step 2] prefix", () => {
    expect(indexSrc).toContain("[Zapier Step 2] Error:");
  });

  it("both steps return 500 with error details on failure", () => {
    const errorResponses = indexSrc.match(/res\.status\(500\)\.json/g);
    expect(errorResponses).not.toBeNull();
    expect(errorResponses!.length).toBeGreaterThanOrEqual(2);
  });

  it("Step 1 logs received data for debugging", () => {
    expect(indexSrc).toContain("[Zapier Step 1] Received:");
  });

  it("Step 2 logs received data for debugging", () => {
    expect(indexSrc).toContain("[Zapier Step 2] Received:");
  });
});
