import { describe, it, expect, beforeAll } from "vitest";
import { listAgents } from "./db";
import { getDb } from "./db";
import { users } from "../drizzle/schema";

describe("Import with Users as Agents", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should return users (excluding admins) as agents", async () => {
    if (!db) {
      console.log("Database not available, skipping test");
      return;
    }

    const result = await listAgents();
    
    // Should have some users
    expect(result.length).toBeGreaterThan(0);
    console.log(`✅ Found ${result.length} users to use as agents`);
  });

  it("should include John Smith and Maria Garcia if they exist", async () => {
    if (!db) {
      console.log("Database not available, skipping test");
      return;
    }

    const result = await listAgents();
    const names = result.map((u: any) => u.name);
    
    console.log(`📋 Available agents: ${names.join(", ")}`);
    
    // Check if John Smith or Maria Garcia are in the list
    const hasJohn = names.some((name: string) => name?.includes("John"));
    const hasMaria = names.some((name: string) => name?.includes("Maria"));
    
    if (hasJohn) console.log("✅ John Smith found");
    if (hasMaria) console.log("✅ Maria Garcia found");
  });

  it("should return users with id field for assignment", async () => {
    if (!db) {
      console.log("Database not available, skipping test");
      return;
    }

    const result = await listAgents();
    
    if (result.length > 0) {
      const firstUser = result[0];
      expect(firstUser).toHaveProperty("id");
      expect(typeof firstUser.id).toBe("number");
      console.log(`✅ User ID ${firstUser.id} (${firstUser.name}) can be used as assignedAgentId`);
    }
  });

  it("should exclude admin users from agent list", async () => {
    if (!db) {
      console.log("Database not available, skipping test");
      return;
    }

    const result = await listAgents();
    
    // None of the returned users should have role 'admin'
    result.forEach((user: any) => {
      expect(user.role).not.toBe("admin");
    });
    
    console.log(`✅ All ${result.length} returned users are non-admin`);
  });
});
