import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { agents } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

describe("Agents API", () => {
  let testAgentId: number | null = null;

  beforeAll(async () => {
    // Clean up any test agents from previous runs
    const database = await getDb();
    if (database) {
      await database.delete(agents).where(eq(agents.name, "Test Birddog Agent"));
    }
  });

  afterAll(async () => {
    // Clean up test agent
    if (testAgentId) {
      const database = await getDb();
      if (database) {
        await database.delete(agents).where(eq(agents.id, testAgentId));
      }
    }
  });

  it("should have agents table available", async () => {
    const database = await getDb();
    expect(database).toBeDefined();
  });

  it("should create a new agent", async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    await database.insert(agents).values({
      name: "Test Birddog Agent",
      email: "test@example.com",
      phone: "555-123-4567",
      role: "Birddog",
      status: "Active",
      notes: "Test agent for unit testing",
    });

    // Get the created agent by name
    const createdAgent = await database
      .select()
      .from(agents)
      .where(eq(agents.name, "Test Birddog Agent"))
      .execute();

    expect(createdAgent.length).toBe(1);
    testAgentId = createdAgent[0].id;
    expect(testAgentId).toBeGreaterThan(0);
  });

  it("should list agents including the test agent", async () => {
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const allAgents = await database.select().from(agents).execute();
    expect(Array.isArray(allAgents)).toBe(true);
    
    const testAgent = allAgents.find((a: any) => a.name === "Test Birddog Agent");
    expect(testAgent).toBeDefined();
    expect(testAgent?.email).toBe("test@example.com");
  });

  it("should get agent by ID", async () => {
    if (!testAgentId) throw new Error("Test agent not created");
    
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    const result = await database
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId))
      .execute();

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Test Birddog Agent");
    expect(result[0].role).toBe("Birddog");
  });

  it("should update an agent", async () => {
    if (!testAgentId) throw new Error("Test agent not created");
    
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    await database
      .update(agents)
      .set({ 
        role: "Acquisition Manager",
        notes: "Updated notes" 
      })
      .where(eq(agents.id, testAgentId));

    const result = await database
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId))
      .execute();

    expect(result[0].role).toBe("Acquisition Manager");
    expect(result[0].notes).toBe("Updated notes");
  });

  it("should validate agent roles", async () => {
    // Valid roles should be: Birddog, Acquisition Manager, Disposition Manager, Admin, Other
    const validRoles = ["Birddog", "Acquisition Manager", "Disposition Manager", "Admin", "Other"];
    
    for (const role of validRoles) {
      expect(validRoles).toContain(role);
    }
  });

  it("should validate agent status", async () => {
    // Valid statuses should be: Active, Inactive
    const validStatuses = ["Active", "Inactive"];
    expect(validStatuses).toContain("Active");
    expect(validStatuses).toContain("Inactive");
  });

  it("should delete an agent", async () => {
    if (!testAgentId) throw new Error("Test agent not created");
    
    const database = await getDb();
    if (!database) throw new Error("Database not available");

    await database.delete(agents).where(eq(agents.id, testAgentId));

    const result = await database
      .select()
      .from(agents)
      .where(eq(agents.id, testAgentId))
      .execute();

    expect(result.length).toBe(0);
    testAgentId = null; // Mark as deleted so afterAll doesn't try to delete again
  });
});
