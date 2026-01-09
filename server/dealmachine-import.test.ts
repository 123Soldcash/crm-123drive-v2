import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { properties, propertyTags } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("dealmachine.import", () => {
  // Increase timeout for large import operations
  const testTimeout = 120000; // 2 minutes
  let initialPropertyCount = 0;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get initial property count
    const result = await db.select().from(properties);
    initialPropertyCount = result.length;
  });

  it("imports properties with LEAD IDs and status tags", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Read test CSV files
    const propertiesCSV = readFileSync(
      "/home/ubuntu/upload/dealmachine-properties-2026-01-09-150558.csv",
      "utf-8"
    );
    const contactsCSV = readFileSync(
      "/home/ubuntu/upload/dealmachine-contacts-2026-01-09-150431.csv",
      "utf-8"
    );

    // Call import
    const result = await caller.dealmachine.import({
      propertiesCSV,
      contactsCSV,
    });

    // Verify import results
    expect(result.propertiesCreated).toBeGreaterThan(0);
    console.log(`✅ Imported ${result.propertiesCreated} properties`);

    // Verify properties were created with LEAD IDs
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const newProperties = await db
      .select()
      .from(properties)
      .where((col) => {
        const { gt } = require("drizzle-orm");
        return gt(col.id, initialPropertyCount);
      });

    expect(newProperties.length).toBe(result.propertiesCreated);
    console.log(`✅ Found ${newProperties.length} new properties in database`);

    // Verify all new properties have LEAD IDs
    const propertiesWithLeadIds = newProperties.filter((p) => p.leadId !== null);
    expect(propertiesWithLeadIds.length).toBe(result.propertiesCreated);
    console.log(`✅ All ${propertiesWithLeadIds.length} properties have LEAD IDs`);

    // Verify all new properties have status tags
    for (const prop of newProperties) {
      const tags = await db
        .select()
        .from(propertyTags)
        .where(eq(propertyTags.propertyId, prop.id));

      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0].tag).toBe("dealmachine_deep_search_chris_edsel_zach");
    }
    console.log(
      `✅ All ${newProperties.length} properties have status tag: dealmachine_deep_search_chris_edsel_zach`
    );

    // Verify all new properties have TBD temperature
    const tbdProperties = newProperties.filter((p) => p.leadTemperature === "TBD");
    expect(tbdProperties.length).toBe(result.propertiesCreated);
    console.log(`✅ All ${tbdProperties.length} properties have TBD temperature`);

    // Verify all new properties have BIN desk
    const binProperties = newProperties.filter((p) => p.deskStatus === "BIN");
    expect(binProperties.length).toBe(result.propertiesCreated);
    console.log(`✅ All ${binProperties.length} properties have BIN desk status`);

    // Verify contacts were imported
    expect(result.contactsCreated).toBeGreaterThan(0);
    console.log(`✅ Imported ${result.contactsCreated} contacts`);
  }, { timeout: 120000 });
});
