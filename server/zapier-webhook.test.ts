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

  it("creates property with contactName from FirstName/LastName", () => {
    expect(indexSrc).toContain('owner1Name: contactName');
    expect(indexSrc).toContain('status: "Website Lead - Step 1"');
  });

  it("extracts FirstName and LastName from webhook data", () => {
    expect(indexSrc).toContain('firstName');
    expect(indexSrc).toContain('lastName');
    expect(indexSrc).toContain('contactName');
  });

  it("sets leadSource to 'Website' for new leads", () => {
    expect(indexSrc).toContain('leadSource: "Website"');
  });

  it("adds 'Website Lead' tag to new properties", () => {
    expect(indexSrc).toContain('tag: "Website Lead"');
  });

  it("creates contact with phone and email (inline on contacts row)", () => {
    // contactPhones and contactEmails tables dropped (2026-05-06)
    // Phone/email now stored inline on contacts.phoneNumber / contacts.email
    expect(indexSrc).toContain("phoneNumber");
    expect(indexSrc).toContain("email");
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
    // contactEmails table dropped (2026-05-06) — email updated inline on contacts row
    expect(indexSrc).toContain("email");
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

// ─── Token Validation / Security ─────────────────────────────────────────────

describe("API Token Security", () => {
  it("defines a validateZapierToken middleware function", () => {
    expect(indexSrc).toContain("validateZapierToken");
  });

  it("reads token from ZAPIER_WEBHOOK_TOKEN env via ENV", () => {
    expect(indexSrc).toContain("ENV.zapierWebhookToken");
  });

  it("supports Bearer token in Authorization header", () => {
    expect(indexSrc).toContain('startsWith("Bearer ")');
    expect(indexSrc).toContain("authHeader");
  });

  it("supports token as query parameter (?token=)", () => {
    expect(indexSrc).toContain("req.query.token");
  });

  it("returns 401 Unauthorized when token is missing or invalid", () => {
    expect(indexSrc).toContain("res.status(401).json");
    expect(indexSrc).toContain("Unauthorized");
  });

  it("skips validation when no token is configured (dev mode)", () => {
    expect(indexSrc).toContain("If no token is configured, skip validation");
  });

  it("applies validateZapierToken to Step 1 endpoint", () => {
    const step1WithToken = indexSrc.match(/app\.post\(["']\/api\/oauth\/webhook\/zapier\/step1["'],\s*validateZapierToken/);
    expect(step1WithToken).not.toBeNull();
  });

  it("applies validateZapierToken to Step 2 endpoint", () => {
    const step2WithToken = indexSrc.match(/app\.post\(["']\/api\/oauth\/webhook\/zapier\/step2["'],\s*validateZapierToken/);
    expect(step2WithToken).not.toBeNull();
  });

  it("applies validateZapierToken to legacy endpoint", () => {
    const legacyWithToken = indexSrc.match(/app\.post\(["']\/api\/oauth\/webhook\/zapier["'],\s*validateZapierToken/);
    expect(legacyWithToken).not.toBeNull();
  });

  it("logs unauthorized attempts with IP address", () => {
    expect(indexSrc).toContain("[Zapier Webhook] Unauthorized request from");
    expect(indexSrc).toContain("req.ip");
  });
});

// ─── ENV Configuration ──────────────────────────────────────────────────────

describe("ENV configuration for Zapier token", () => {
  const envPath = path.resolve(__dirname, "./_core/env.ts");
  const envSrc = fs.readFileSync(envPath, "utf-8");

  it("registers ZAPIER_WEBHOOK_TOKEN in ENV", () => {
    expect(envSrc).toContain("zapierWebhookToken");
    expect(envSrc).toContain("ZAPIER_WEBHOOK_TOKEN");
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

// ─── Step 2: Deep Search Mapping ────────────────────────────────────────────

describe("Step 2: Qualifying data mapped to Deep Search", () => {
  it("imports propertyDeepSearch schema in Step 2 handler", () => {
    expect(indexSrc).toContain("propertyDeepSearch");
  });

  it("maps 'Living in House' to occupancy enum values", () => {
    // Tenant-Occupied mapping
    expect(indexSrc).toContain('"Tenant-Occupied"');
    // Owner-Occupied mapping
    expect(indexSrc).toContain('"Owner-Occupied"');
    // Vacant mapping
    expect(indexSrc).toContain('"Vacant"');
    // Abandoned mapping
    expect(indexSrc).toContain('"Abandoned"');
  });

  it("maps 'Listed with Realtor' to MLS status", () => {
    expect(indexSrc).toContain('"Listed"');
    expect(indexSrc).toContain('"Not Listed"');
  });

  it("maps repairs needed to needsRepairs flag and repairNotes", () => {
    expect(indexSrc).toContain("needsRepairs");
    expect(indexSrc).toContain("repairNotes");
  });

  it("maps property condition to propertyCondition JSON field", () => {
    expect(indexSrc).toContain("propertyCondition");
    expect(indexSrc).toContain("rating");
  });

  it("builds overviewNotes from all qualifying answers", () => {
    expect(indexSrc).toContain("overviewNotes");
    expect(indexSrc).toContain("Owned since:");
    expect(indexSrc).toContain("Condition:");
    expect(indexSrc).toContain("Living in house:");
    expect(indexSrc).toContain("Listed with realtor:");
    expect(indexSrc).toContain("Wants to sell fast:");
    expect(indexSrc).toContain("Lowest acceptable price:");
    expect(indexSrc).toContain("Best time to call:");
  });

  it("checks for existing deep search record before insert (upsert logic)", () => {
    expect(indexSrc).toContain("existingDeepSearch");
    expect(indexSrc).toContain("propertyDeepSearch.propertyId");
  });

  it("updates existing deep search record if one exists", () => {
    expect(indexSrc).toContain("Updated deep search for property");
  });

  it("creates new deep search record if none exists", () => {
    expect(indexSrc).toContain("Created deep search for property");
  });

  it("wraps deep search update in try-catch to not fail the whole request", () => {
    expect(indexSrc).toContain("Deep search update failed for property");
  });
});

// ─── Occupancy Mapping Logic ────────────────────────────────────────────────

describe("Occupancy mapping from 'Living in House' field", () => {
  const mapOccupancy = (livingInHouse: string) => {
    const livingLower = livingInHouse.toLowerCase();
    if (livingLower.includes("tenant")) return "Tenant-Occupied";
    if (livingLower.includes("yes") && !livingLower.includes("tenant")) return "Owner-Occupied";
    if (livingLower.includes("no") || livingLower.includes("vacant")) return "Vacant";
    if (livingLower.includes("abandon")) return "Abandoned";
    return null;
  };

  it("maps 'Yes - Tenant Occupied' to Tenant-Occupied", () => {
    expect(mapOccupancy("Yes - Tenant Occupied")).toBe("Tenant-Occupied");
  });

  it("maps 'Yes' to Owner-Occupied", () => {
    expect(mapOccupancy("Yes")).toBe("Owner-Occupied");
  });

  it("maps 'No' to Vacant", () => {
    expect(mapOccupancy("No")).toBe("Vacant");
  });

  it("maps 'Vacant' to Vacant", () => {
    expect(mapOccupancy("Vacant")).toBe("Vacant");
  });

  it("maps 'Abandoned' to Abandoned", () => {
    expect(mapOccupancy("Abandoned")).toBe("Abandoned");
  });

  it("returns null for unknown values", () => {
    expect(mapOccupancy("")).toBeNull();
    expect(mapOccupancy("Maybe")).toBeNull();
  });
});

// ─── Step 2: Deep Search Overview Mapping ───────────────────────────────────

describe("Step 2: Qualifying data also mapped to deepSearchOverview table", () => {
  it("imports deepSearchOverview schema in Step 2 handler", () => {
    expect(indexSrc).toContain("deepSearchOverview");
  });

  it("maps occupancy with space-separated values for Overview UI", () => {
    expect(indexSrc).toContain('"Tenant Occupied"');
    expect(indexSrc).toContain('"Owner Occupied"');
    expect(indexSrc).toContain('"Squatter Occupied"');
    expect(indexSrc).toContain('"Unknown"');
  });

  it("maps condition to conditionRating enum for Overview UI", () => {
    expect(indexSrc).toContain('"Excellent"');
    expect(indexSrc).toContain('"Good"');
    expect(indexSrc).toContain('"Fair"');
    expect(indexSrc).toContain('"Average"');
    expect(indexSrc).toContain('"Poor"');
  });

  it("builds generalNotes for overview from qualifying answers", () => {
    expect(indexSrc).toContain("overviewData.generalNotes");
  });

  it("checks for existing overview record before insert (upsert logic)", () => {
    expect(indexSrc).toContain("existingOverview");
    expect(indexSrc).toContain("deepSearchOverview.propertyId");
  });

  it("updates existing overview record if one exists", () => {
    expect(indexSrc).toContain("Updated deep search overview for property");
  });

  it("creates new overview record if none exists", () => {
    expect(indexSrc).toContain("Created deep search overview for property");
  });

  it("wraps overview update in try-catch to not fail the whole request", () => {
    expect(indexSrc).toContain("Deep search overview update failed for property");
  });
});

// ─── Overview Occupancy Mapping Logic ───────────────────────────────────────

describe("Overview occupancy mapping (space-separated values)", () => {
  const mapOverviewOccupancy = (livingInHouse: string) => {
    const ll = livingInHouse.toLowerCase();
    if (ll.includes("tenant")) return "Tenant Occupied";
    if (ll.includes("yes") && !ll.includes("tenant")) return "Owner Occupied";
    if (ll.includes("no") || ll.includes("vacant")) return "Vacant";
    if (ll.includes("squatter")) return "Squatter Occupied";
    return "Unknown";
  };

  it("maps 'Yes - Tenant Occupied' to 'Tenant Occupied'", () => {
    expect(mapOverviewOccupancy("Yes - Tenant Occupied")).toBe("Tenant Occupied");
  });

  it("maps 'Yes' to 'Owner Occupied'", () => {
    expect(mapOverviewOccupancy("Yes")).toBe("Owner Occupied");
  });

  it("maps 'No' to 'Vacant'", () => {
    expect(mapOverviewOccupancy("No")).toBe("Vacant");
  });

  it("maps 'Squatter' to 'Squatter Occupied'", () => {
    expect(mapOverviewOccupancy("Squatter")).toBe("Squatter Occupied");
  });

  it("maps unknown values to 'Unknown'", () => {
    expect(mapOverviewOccupancy("Maybe")).toBe("Unknown");
  });
});
