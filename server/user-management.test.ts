import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, propertyAgents, leadAssignments, properties, agents } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(userId = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `admin-test-${userId}`,
    email: "admin@test.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createUserContext(userId = 2): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-test-${userId}`,
    email: "user@test.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("User Management - deleteAgent", () => {
  let testUserId: number | null = null;
  let testPropertyId: number | null = null;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Clean up any leftover test data
    await db.delete(users).where(eq(users.openId, "test-delete-user-openid"));
    await db.delete(users).where(eq(users.openId, "test-delete-user2-openid"));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    if (testUserId) {
      try {
        await db.delete(propertyAgents).where(eq(propertyAgents.agentId, testUserId));
        await db.delete(leadAssignments).where(eq(leadAssignments.agentId, testUserId));
        await db.delete(users).where(eq(users.id, testUserId));
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (testPropertyId) {
      try {
        await db.delete(properties).where(eq(properties.id, testPropertyId));
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    // Clean up any remaining test users
    await db.delete(users).where(eq(users.openId, "test-delete-user-openid"));
    await db.delete(users).where(eq(users.openId, "test-delete-user2-openid"));
  });

  it("should delete a user from the users table (not agents table)", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user in the users table
    await db.insert(users).values({
      openId: "test-delete-user-openid",
      name: "Test Delete User",
      email: "testdelete@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-delete-user-openid"));
    expect(created.length).toBe(1);
    testUserId = created[0].id;

    // Delete via the router
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.users.deleteAgent({ userId: testUserId });
    expect(result.success).toBe(true);

    // Verify user is gone from users table
    const afterDelete = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(afterDelete.length).toBe(0);

    testUserId = null; // Mark as deleted
  });

  it("should prevent non-admin from deleting users", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user
    await db.insert(users).values({
      openId: "test-delete-user2-openid",
      name: "Test Delete User 2",
      email: "testdelete2@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-delete-user2-openid"));
    testUserId = created[0].id;

    // Try to delete as regular user
    const { ctx } = createUserContext(999);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.users.deleteAgent({ userId: testUserId })
    ).rejects.toThrow("Only admins can delete agents");

    // Verify user still exists
    const afterAttempt = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(afterAttempt.length).toBe(1);

    // Clean up
    await db.delete(users).where(eq(users.id, testUserId));
    testUserId = null;
  });

  it("should prevent admin from deleting themselves", async () => {
    const adminId = 1;
    const { ctx } = createAdminContext(adminId);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.users.deleteAgent({ userId: adminId })
    ).rejects.toThrow("Cannot delete your own account");
  });

  it("should clean up propertyAgents when deleting a user", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user
    await db.insert(users).values({
      openId: "test-delete-user-openid",
      name: "Test PA Cleanup User",
      email: "testpa@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-delete-user-openid"));
    testUserId = created[0].id;

    // Assign a property to this user via propertyAgents
    // First find any existing property
    const existingProps = await db
      .select({ id: properties.id })
      .from(properties)
      .limit(1);

    if (existingProps.length > 0) {
      const propId = existingProps[0].id;

      // Create a propertyAgent assignment
      await db.insert(propertyAgents).values({
        propertyId: propId,
        agentId: testUserId,
      });

      // Verify assignment exists
      const assignments = await db
        .select()
        .from(propertyAgents)
        .where(
          and(
            eq(propertyAgents.propertyId, propId),
            eq(propertyAgents.agentId, testUserId)
          )
        );
      expect(assignments.length).toBe(1);

      // Delete the user
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.users.deleteAgent({ userId: testUserId });

      // Verify propertyAgents assignment is cleaned up
      const afterDelete = await db
        .select()
        .from(propertyAgents)
        .where(eq(propertyAgents.agentId, testUserId));
      expect(afterDelete.length).toBe(0);

      testUserId = null;
    } else {
      // No properties to test with, just delete the user
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.users.deleteAgent({ userId: testUserId });
      testUserId = null;
    }
  });

  it("should clear assignedAgentId on properties when deleting a user", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user
    await db.insert(users).values({
      openId: "test-delete-user-openid",
      name: "Test Assign Cleanup",
      email: "testassign@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-delete-user-openid"));
    testUserId = created[0].id;

    // Find a property and assign it to this user
    const existingProps = await db
      .select({ id: properties.id, assignedAgentId: properties.assignedAgentId })
      .from(properties)
      .limit(1);

    if (existingProps.length > 0) {
      const propId = existingProps[0].id;
      const originalAgentId = existingProps[0].assignedAgentId;

      // Assign the property to our test user
      await db
        .update(properties)
        .set({ assignedAgentId: testUserId })
        .where(eq(properties.id, propId));

      // Delete the user
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.users.deleteAgent({ userId: testUserId });

      // Verify assignedAgentId is cleared
      const afterDelete = await db
        .select({ assignedAgentId: properties.assignedAgentId })
        .from(properties)
        .where(eq(properties.id, propId));
      expect(afterDelete[0].assignedAgentId).toBeNull();

      // Restore original assignment
      await db
        .update(properties)
        .set({ assignedAgentId: originalAgentId })
        .where(eq(properties.id, propId));

      testUserId = null;
    } else {
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      await caller.users.deleteAgent({ userId: testUserId });
      testUserId = null;
    }
  });
});

describe("User Management - listAgents", () => {
  it("should list agents (non-admin users) from users table", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const agents = await caller.users.listAgents();
    expect(Array.isArray(agents)).toBe(true);

    // Verify all returned users are non-admin
    for (const agent of agents) {
      expect(agent.role).not.toBe("admin");
    }
  });

  it("should return agents with expected fields", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const agents = await caller.users.listAgents();

    if (agents.length > 0) {
      const agent = agents[0];
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("email");
      expect(agent).toHaveProperty("role");
      expect(agent).toHaveProperty("createdAt");
    }
  });
});

describe("User Management - updateAgent", () => {
  let testUserId: number | null = null;

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    await db.delete(users).where(eq(users.openId, "test-update-user-openid"));
  });

  it("should update agent name and email", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    await db.insert(users).values({
      openId: "test-update-user-openid",
      name: "Original Name",
      email: "original@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-update-user-openid"));
    testUserId = created[0].id;

    // Update via router
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.users.updateAgent({
      userId: testUserId,
      name: "Updated Name",
      email: "updated@example.com",
    });
    expect(result.success).toBe(true);

    // Verify update
    const afterUpdate = await db
      .select()
      .from(users)
      .where(eq(users.id, testUserId));
    expect(afterUpdate[0].name).toBe("Updated Name");
    expect(afterUpdate[0].email).toBe("updated@example.com");
  });

  it("should prevent non-admin from updating agents", async () => {
    if (!testUserId) return;

    const { ctx } = createUserContext(999);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.users.updateAgent({
        userId: testUserId,
        name: "Hacked Name",
      })
    ).rejects.toThrow("Only admins can update agent details");
  });
});

describe("User Management - reassignAgentProperties", () => {
  it("should prevent non-admin from reassigning properties", async () => {
    const { ctx } = createUserContext(999);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.users.reassignAgentProperties({
        fromAgentId: 1,
        toAgentId: 2,
      })
    ).rejects.toThrow("Only admins can reassign agent properties");
  });

  it("should reassign properties between agents", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // This should succeed even if there are no properties to reassign
    const result = await caller.users.reassignAgentProperties({
      fromAgentId: 99999,
      toAgentId: 99998,
    });
    expect(result.success).toBe(true);
  });
});

describe("User Management - deleteAgent targets correct table", () => {
  it("deleteAgent should delete from users table, not agents table", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a user in the users table
    await db.insert(users).values({
      openId: "test-correct-table-openid",
      name: "Correct Table Test",
      email: "correcttable@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-correct-table-openid"));
    expect(created.length).toBe(1);
    const userId = created[0].id;

    // Delete via router
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await caller.users.deleteAgent({ userId });

    // Verify deleted from users table
    const afterDelete = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-correct-table-openid"));
    expect(afterDelete.length).toBe(0);
  });

  it("listAgents should query users table", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a user in users table
    await db.insert(users).values({
      openId: "test-list-table-openid",
      name: "List Table Test",
      email: "listtable@example.com",
      role: "user",
    });

    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const agentsList = await caller.users.listAgents();
    const found = agentsList.find((a: any) => a.email === "listtable@example.com");
    expect(found).toBeDefined();
    expect(found?.name).toBe("List Table Test");

    // Clean up
    await db.delete(users).where(eq(users.openId, "test-list-table-openid"));
  });

  it("deleting a user should make them disappear from listAgents", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a user
    await db.insert(users).values({
      openId: "test-disappear-openid",
      name: "Disappear Test",
      email: "disappear@example.com",
      role: "user",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.openId, "test-disappear-openid"));
    const userId = created[0].id;

    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Verify user appears in list
    const beforeList = await caller.users.listAgents();
    const beforeFound = beforeList.find((a: any) => a.email === "disappear@example.com");
    expect(beforeFound).toBeDefined();

    // Delete the user
    await caller.users.deleteAgent({ userId });

    // Verify user no longer appears in list
    const afterList = await caller.users.listAgents();
    const afterFound = afterList.find((a: any) => a.email === "disappear@example.com");
    expect(afterFound).toBeUndefined();
  });
});
