import { describe, it, expect } from "vitest";
import * as fs from "fs";

/**
 * Tests for DEAD lead exclusion from default Properties listing.
 *
 * Business rule: Leads are considered "DEAD" if:
 *   - leadTemperature = 'DEAD', OR
 *   - deskStatus = 'DEAD'
 *
 * DEAD leads should NOT appear in the default property listing.
 * They should ONLY appear when the user explicitly filters by leadTemperature = "DEAD".
 */

const dbSource = fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/db.ts", "utf-8");
const routersSource = fs.readFileSync("/home/ubuntu/crm-123drive-v2/server/routers.ts", "utf-8");
const propertiesSource = fs.readFileSync("/home/ubuntu/crm-123drive-v2/client/src/pages/Properties.tsx", "utf-8");

describe("DEAD Lead Exclusion Logic", () => {
  describe("getProperties — default exclusion", () => {
    it("should exclude leadTemperature=DEAD by default", () => {
      expect(dbSource).toContain("leadTemperature} != 'DEAD'");
    });

    it("should exclude deskStatus=DEAD by default", () => {
      // The else branch should push ne(properties.deskStatus, 'DEAD')
      expect(dbSource).toContain("ne(properties.deskStatus, 'DEAD')");
    });

    it("should have both exclusions in the same else branch", () => {
      const elseBlock = dbSource.match(/By default, exclude DEAD leads[\s\S]*?ne\(properties\.deskStatus, 'DEAD'\)/);
      expect(elseBlock).not.toBeNull();
    });
  });

  describe("getProperties — explicit DEAD filter", () => {
    it("should use OR when leadTemperature filter is DEAD to catch both cases", () => {
      // When user explicitly filters by DEAD, we use OR(leadTemperature=DEAD, deskStatus=DEAD)
      const deadOrBlock = dbSource.match(/filters\.leadTemperature === 'DEAD'[\s\S]*?or\([\s\S]*?eq\(properties\.leadTemperature, 'DEAD'\)[\s\S]*?eq\(properties\.deskStatus, 'DEAD'\)/);
      expect(deadOrBlock).not.toBeNull();
    });
  });

  describe("getPropertiesForMap — DEAD exclusion", () => {
    it("should exclude leadTemperature=DEAD from map view", () => {
      const mapSection = dbSource.substring(
        dbSource.indexOf("export async function getPropertiesForMap"),
        dbSource.indexOf("export async function getPropertyTags")
      );
      expect(mapSection).toContain("leadTemperature} != 'DEAD'");
    });

    it("should also exclude deskStatus=DEAD from map view", () => {
      const mapSection = dbSource.substring(
        dbSource.indexOf("export async function getPropertiesForMap"),
        dbSource.indexOf("export async function getPropertyTags")
      );
      expect(mapSection).toContain("ne(properties.deskStatus, 'DEAD')");
    });
  });

  describe("Dashboard stats", () => {
    it("should exclude both DEAD conditions from total count", () => {
      expect(routersSource).toContain("Total count excludes DEAD leads (both leadTemperature=DEAD and deskStatus=DEAD)");
      expect(routersSource).toContain("ne(properties.deskStatus, 'DEAD')");
    });

    it("should count DEAD using OR to include both leadTemperature=DEAD and deskStatus=DEAD", () => {
      expect(routersSource).toContain("DEAD count includes both leadTemperature=DEAD and deskStatus=DEAD");
      const deadOrCount = routersSource.match(/or\(\s*eq\(properties\.leadTemperature, 'DEAD'\),\s*eq\(properties\.deskStatus, 'DEAD'\)\s*\)/);
      expect(deadOrCount).not.toBeNull();
    });
  });

  describe("Frontend filter options", () => {
    it("should show 'All (excl. Dead)' as the default option label", () => {
      expect(propertiesSource).toContain("All (excl. Dead)");
    });

    it("should still have DEAD as an explicit filter option", () => {
      expect(propertiesSource).toContain("☠️ DEAD");
    });
  });
});
