import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { eq, like } from "drizzle-orm";

describe("Agent Creation", () => {
  let db: any;
  const timestamp = Date.now();

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
  });

  afterAll(async () => {
    // Cleanup: delete all test agents created in this run
    try {
      await db
        .delete(agents)
        .where(like(agents.email, `test${timestamp}%@example.com`));
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it("should create agent with default values", async () => {
    const email = `test${timestamp}1@example.com`;
    const result = await db.insert(agents).values({
      name: "Test Agent",
      email: email,
      phone: undefined,
      role: "Birddog",
      agentType: "Internal",
      status: "Active",
      notes: undefined,
    });

    // Verify agent was created
    const created = await db
      .select()
      .from(agents)
      .where(eq(agents.email, email));

    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Test Agent");
    expect(created[0].email).toBe(email);
    expect(created[0].role).toBe("Birddog");
    expect(created[0].agentType).toBe("Internal");
    expect(created[0].status).toBe("Active");
  });

  it("should create agent with custom values", async () => {
    const email = `test${timestamp}2@example.com`;
    const result = await db.insert(agents).values({
      name: "Custom Agent",
      email: email,
      phone: "5551234567",
      role: "Corretor",
      agentType: "External",
      status: "Active",
      notes: "Test notes",
    });

    // Verify agent was created with correct values
    const created = await db
      .select()
      .from(agents)
      .where(eq(agents.email, email));

    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Custom Agent");
    expect(created[0].email).toBe(email);
    expect(created[0].phone).toBe("5551234567");
    expect(created[0].role).toBe("Corretor");
    expect(created[0].agentType).toBe("External");
    expect(created[0].notes).toBe("Test notes");
  });

  it("should handle all valid agent types", async () => {
    const types = ["Internal", "External", "Birddog", "Corretor"];

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const email = `test${timestamp}type${i}@example.com`;

      const result = await db.insert(agents).values({
        name: `Agent ${type}`,
        email: email,
        phone: undefined,
        role: "Birddog",
        agentType: type,
        status: "Active",
        notes: undefined,
      });

      const created = await db
        .select()
        .from(agents)
        .where(eq(agents.email, email));

      expect(created).toHaveLength(1);
      expect(created[0].agentType).toBe(type);
    }
  });

  it("should handle all valid roles", async () => {
    const roles = [
      "Birddog",
      "Acquisition Manager",
      "Disposition Manager",
      "Admin",
      "Manager",
      "Corretor",
      "Other",
    ];

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const email = `test${timestamp}role${i}@example.com`;

      const result = await db.insert(agents).values({
        name: `Agent ${role}`,
        email: email,
        phone: undefined,
        role: role,
        agentType: "Internal",
        status: "Active",
        notes: undefined,
      });

      const created = await db
        .select()
        .from(agents)
        .where(eq(agents.email, email));

      expect(created).toHaveLength(1);
      expect(created[0].role).toBe(role);
    }
  });

  it("should handle all valid statuses", async () => {
    const statuses = ["Active", "Inactive", "Suspended"];

    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      const email = `test${timestamp}status${i}@example.com`;

      const result = await db.insert(agents).values({
        name: `Agent ${status}`,
        email: email,
        phone: undefined,
        role: "Birddog",
        agentType: "Internal",
        status: status,
        notes: undefined,
      });

      const created = await db
        .select()
        .from(agents)
        .where(eq(agents.email, email));

      expect(created).toHaveLength(1);
      expect(created[0].status).toBe(status);
    }
  });
});
