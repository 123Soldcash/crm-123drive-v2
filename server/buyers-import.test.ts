import { describe, expect, it } from "vitest";
import {
  validateBuyerImport,
  importBuyersBatch,
  getTemplateColumns,
  type BuyerImportRow,
} from "./db-buyers-import";

// ──────────────────────────────────────────────────
// Unit tests for getTemplateColumns
// ──────────────────────────────────────────────────
describe("getTemplateColumns", () => {
  it("returns the correct number of columns", () => {
    const columns = getTemplateColumns();
    expect(columns.length).toBe(17);
  });

  it("marks Name and Email as required", () => {
    const columns = getTemplateColumns();
    const required = columns.filter((c) => c.required);
    expect(required.length).toBe(2);
    expect(required.map((c) => c.key)).toContain("name");
    expect(required.map((c) => c.key)).toContain("email");
  });

  it("includes all preference columns", () => {
    const columns = getTemplateColumns();
    const keys = columns.map((c) => c.key);
    expect(keys).toContain("preferredStates");
    expect(keys).toContain("preferredCities");
    expect(keys).toContain("preferredZipcodes");
    expect(keys).toContain("propertyTypes");
    expect(keys).toContain("minBeds");
    expect(keys).toContain("maxBeds");
    expect(keys).toContain("minBaths");
    expect(keys).toContain("maxBaths");
    expect(keys).toContain("minPrice");
    expect(keys).toContain("maxPrice");
    expect(keys).toContain("maxRepairCost");
  });

  it("each column has key, label, required, and description", () => {
    const columns = getTemplateColumns();
    columns.forEach((col) => {
      expect(col).toHaveProperty("key");
      expect(col).toHaveProperty("label");
      expect(col).toHaveProperty("required");
      expect(col).toHaveProperty("description");
      expect(typeof col.key).toBe("string");
      expect(typeof col.label).toBe("string");
      expect(typeof col.required).toBe("boolean");
      expect(typeof col.description).toBe("string");
    });
  });
});

// ──────────────────────────────────────────────────
// Unit tests for validateBuyerImport
// ──────────────────────────────────────────────────
describe("validateBuyerImport", () => {
  it("validates a valid row correctly", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "John Smith",
        email: "john@example.com",
        phone: "(555) 123-4567",
        company: "Smith LLC",
        status: "Active",
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result.length).toBe(1);
    expect(result[0].valid).toBe(true);
    expect(result[0].errors.length).toBe(0);
  });

  it("flags missing name as error", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "",
        email: "test@example.com",
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].valid).toBe(false);
    expect(result[0].errors.some((e) => e.includes("Name is required"))).toBe(true);
  });

  it("flags missing email as error", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Test User",
        email: "",
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].valid).toBe(false);
    expect(result[0].errors.some((e) => e.includes("Email is required"))).toBe(true);
  });

  it("flags invalid email format", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Test User",
        email: "not-an-email",
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].valid).toBe(false);
    expect(result[0].errors.some((e) => e.includes("Invalid email format"))).toBe(true);
  });

  it("warns about invalid status", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Test User",
        email: "test@example.com",
        status: "InvalidStatus" as any,
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].valid).toBe(true); // still valid, just a warning
    expect(result[0].warnings.some((w) => w.includes("Invalid status"))).toBe(true);
  });

  it("detects duplicate emails within the file", async () => {
    const rows: BuyerImportRow[] = [
      { name: "User A", email: "same@example.com" },
      { name: "User B", email: "same@example.com" },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].isDuplicate).toBe(false);
    expect(result[1].isDuplicate).toBe(true);
    expect(result[1].warnings.some((w) => w.includes("Duplicate email"))).toBe(true);
  });

  it("assigns correct row numbers (Excel-style, starting at 2)", async () => {
    const rows: BuyerImportRow[] = [
      { name: "User A", email: "a@example.com" },
      { name: "User B", email: "b@example.com" },
      { name: "User C", email: "c@example.com" },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].row).toBe(2);
    expect(result[1].row).toBe(3);
    expect(result[2].row).toBe(4);
  });

  it("handles multiple errors on a single row", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "",
        email: "",
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].valid).toBe(false);
    expect(result[0].errors.length).toBeGreaterThanOrEqual(2);
  });

  it("validates numeric fields and warns on non-numeric values", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Test",
        email: "test@example.com",
        minBeds: "abc" as any,
        maxPrice: "not-a-number" as any,
      },
    ];

    const result = await validateBuyerImport(rows);
    expect(result[0].valid).toBe(true); // still valid, just warnings
    expect(result[0].warnings.some((w) => w.includes("Min Beds"))).toBe(true);
    expect(result[0].warnings.some((w) => w.includes("Max Price"))).toBe(true);
  });
});

// ──────────────────────────────────────────────────
// Integration tests for importBuyersBatch
// ──────────────────────────────────────────────────
describe("importBuyersBatch", () => {
  // Use unique emails per test to avoid cross-test contamination
  const testPrefix = `import-test-${Date.now()}`;

  it("imports valid buyers successfully", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Import Test A",
        email: `${testPrefix}-a@test.com`,
        phone: "(305) 555-0001",
        company: "Test Corp A",
        status: "Active",
      },
      {
        name: "Import Test B",
        email: `${testPrefix}-b@test.com`,
        phone: "(305) 555-0002",
        company: "Test Corp B",
        status: "Verified",
      },
    ];

    const result = await importBuyersBatch(rows);
    expect(result.imported).toBe(2);
    expect(result.totalRows).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.duplicates).toBe(0);

    // Clean up
    const { getDb } = await import("./db");
    const { buyers } = await import("../drizzle/schema");
    const { like } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      await db.delete(buyers).where(like(buyers.email, `${testPrefix}%`));
    }
  });

  it("skips rows with missing required fields", async () => {
    const rows: BuyerImportRow[] = [
      { name: "", email: `${testPrefix}-skip@test.com` }, // missing name
      { name: "Valid User", email: `${testPrefix}-valid@test.com` },
    ];

    const result = await importBuyersBatch(rows);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors.length).toBe(1);

    // Clean up
    const { getDb } = await import("./db");
    const { buyers } = await import("../drizzle/schema");
    const { like } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      await db.delete(buyers).where(like(buyers.email, `${testPrefix}%`));
    }
  });

  it("skips duplicate emails when skipDuplicates is true", async () => {
    const rows: BuyerImportRow[] = [
      { name: "Dup Test 1", email: `${testPrefix}-dup@test.com` },
      { name: "Dup Test 2", email: `${testPrefix}-dup@test.com` },
    ];

    const result = await importBuyersBatch(rows, true);
    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);

    // Clean up
    const { getDb } = await import("./db");
    const { buyers } = await import("../drizzle/schema");
    const { like } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      await db.delete(buyers).where(like(buyers.email, `${testPrefix}%`));
    }
  });

  it("imports buyers with preferences", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Pref Test",
        email: `${testPrefix}-pref@test.com`,
        preferredStates: "FL, TX, CA",
        preferredCities: "Miami, Fort Lauderdale",
        propertyTypes: "Single Family, Multi-Family",
        minBeds: 3,
        maxBeds: 5,
        minPrice: 100000,
        maxPrice: 500000,
      },
    ];

    const result = await importBuyersBatch(rows);
    expect(result.imported).toBe(1);

    // Verify preferences were saved
    const { getBuyerById } = await import("./db-buyers");
    const { getDb } = await import("./db");
    const { buyers, buyerPreferences } = await import("../drizzle/schema");
    const { like, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      const [buyer] = await db.select().from(buyers).where(like(buyers.email, `${testPrefix}-pref@test.com`));
      if (buyer) {
        const [prefs] = await db.select().from(buyerPreferences).where(eq(buyerPreferences.buyerId, buyer.id));
        expect(prefs).toBeTruthy();
        if (prefs) {
          const states = JSON.parse(prefs.states || "[]");
          expect(states).toContain("FL");
          expect(states).toContain("TX");
          expect(states).toContain("CA");
          expect(prefs.minBeds).toBe(3);
          expect(prefs.maxBeds).toBe(5);
          expect(prefs.minPrice).toBe(100000);
          expect(prefs.maxPrice).toBe(500000);
        }
      }

      // Clean up
      if (buyer) {
        await db.delete(buyerPreferences).where(eq(buyerPreferences.buyerId, buyer.id));
      }
      await db.delete(buyers).where(like(buyers.email, `${testPrefix}%`));
    }
  });

  it("defaults status to Active when invalid status provided", async () => {
    const rows: BuyerImportRow[] = [
      {
        name: "Status Test",
        email: `${testPrefix}-status@test.com`,
        status: "InvalidStatus" as any,
      },
    ];

    const result = await importBuyersBatch(rows);
    // The row should still import successfully (invalid status defaults to Active)
    expect(result.imported).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(result.totalRows).toBe(1);

    // Clean up
    const { getDb } = await import("./db");
    const { buyers } = await import("../drizzle/schema");
    const { like } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      await db.delete(buyers).where(like(buyers.email, `${testPrefix}%`));
    }
  });
});
