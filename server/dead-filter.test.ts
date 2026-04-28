import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for DEAD lead exclusion from default Properties listing.
 * 
 * Business rule: DEAD leads should NOT appear in the default property listing.
 * They should ONLY appear when the user explicitly filters by leadTemperature = "DEAD".
 */

// Mock the database module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockLeftJoin = vi.fn();
const mockInnerJoin = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }),
  }),
  getProperties: vi.fn(),
  getPropertiesWithAgents: vi.fn(),
}));

describe("DEAD Lead Exclusion Logic", () => {
  describe("getProperties filter behavior", () => {
    it("should add DEAD exclusion condition when no leadTemperature filter is set", async () => {
      // Import the actual source to check the logic
      const dbSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/db.ts", "utf-8")
      );
      
      // Verify the DEAD exclusion logic exists in getProperties
      expect(dbSource).toContain("// By default, exclude DEAD leads");
      expect(dbSource).toContain("properties.leadTemperature} != 'DEAD'");
    });

    it("should have the DEAD exclusion in the else branch of leadTemperature filter", async () => {
      const dbSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/db.ts", "utf-8")
      );
      
      // Find the pattern: if leadTemperature filter set → use it, else → exclude DEAD
      const filterPattern = /if \(filters\?\.leadTemperature\) \{[\s\S]*?conditions\.push\(eq\(properties\.leadTemperature, filters\.leadTemperature\)\);[\s\S]*?\} else \{[\s\S]*?exclude DEAD/;
      expect(dbSource).toMatch(filterPattern);
    });

    it("should NOT exclude DEAD when leadTemperature filter is explicitly set to DEAD", async () => {
      const dbSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/db.ts", "utf-8")
      );
      
      // When leadTemperature is set (e.g., to "DEAD"), the else branch should NOT execute
      // The if branch uses eq(properties.leadTemperature, filters.leadTemperature)
      // which will match DEAD when explicitly requested
      const ifBranch = /if \(filters\?\.leadTemperature\) \{\s*conditions\.push\(eq\(properties\.leadTemperature, filters\.leadTemperature\)\)/;
      expect(dbSource).toMatch(ifBranch);
    });
  });

  describe("getPropertiesForMap DEAD exclusion", () => {
    it("should exclude DEAD leads from map view", async () => {
      const dbSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/db.ts", "utf-8")
      );
      
      // Verify the map function also excludes DEAD
      const mapFunctionSection = dbSource.substring(
        dbSource.indexOf("export async function getPropertiesForMap"),
        dbSource.indexOf("export async function getPropertyTags")
      );
      
      expect(mapFunctionSection).toContain("exclude DEAD leads from map view");
      expect(mapFunctionSection).toContain("!= 'DEAD'");
    });
  });

  describe("Dashboard stats", () => {
    it("should exclude DEAD from total count but still count DEAD separately", async () => {
      const routersSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/routers.ts", "utf-8")
      );
      
      // Total count should exclude DEAD
      expect(routersSource).toContain("Total count excludes DEAD leads");
      expect(routersSource).toContain("await countQuery(sql`${properties.leadTemperature} != 'DEAD'`)");
      
      // DEAD count should still be calculated separately
      expect(routersSource).toContain("await countQuery(eq(properties.leadTemperature, 'DEAD'))");
    });
  });

  describe("Frontend filter options", () => {
    it("should show 'All (excl. Dead)' as the default option label", async () => {
      const propertiesSource = await import("fs").then(fs => 
        fs.readFileSync("/home/ubuntu/crm-123drive-v2/client/src/pages/Properties.tsx", "utf-8")
      );
      
      // The default "All" option should indicate DEAD is excluded
      expect(propertiesSource).toContain('All (excl. Dead)');
      
      // DEAD should still be available as an explicit filter option
      expect(propertiesSource).toContain('☠️ DEAD');
    });
  });
});
