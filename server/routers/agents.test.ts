import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, like } from "drizzle-orm";

describe("Unified User System", () => {
  let db: any;
  const timestamp = Date.now();

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
  });

  afterAll(async () => {
    // Cleanup: delete all test users created in this run
    try {
      await db
        .delete(users)
        .where(like(users.email, `test${timestamp}%@example.com`));
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it("should create a user with agent role and default status", async () => {
    const email = `test${timestamp}agent1@example.com`;
    await db.insert(users).values({
      openId: `test-openid-${timestamp}-agent1`,
      name: "Test Agent",
      email: email,
      role: "agent",
      status: "Active",
      loginMethod: "apple",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Test Agent");
    expect(created[0].email).toBe(email);
    expect(created[0].role).toBe("agent");
    expect(created[0].status).toBe("Active");
  });

  it("should create a user with admin role", async () => {
    const email = `test${timestamp}admin1@example.com`;
    await db.insert(users).values({
      openId: `test-openid-${timestamp}-admin1`,
      name: "Test Admin",
      email: email,
      role: "admin",
      status: "Active",
      loginMethod: "apple",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    expect(created).toHaveLength(1);
    expect(created[0].name).toBe("Test Admin");
    expect(created[0].role).toBe("admin");
    expect(created[0].status).toBe("Active");
  });

  it("should support all valid statuses: Active, Inactive, Suspended", async () => {
    const statuses = ["Active", "Inactive", "Suspended"];

    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      const email = `test${timestamp}status${i}@example.com`;

      await db.insert(users).values({
        openId: `test-openid-${timestamp}-status${i}`,
        name: `User ${status}`,
        email: email,
        role: "agent",
        status: status,
        loginMethod: "apple",
      });

      const created = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      expect(created).toHaveLength(1);
      expect(created[0].status).toBe(status);
    }
  });

  it("should store notes on a user", async () => {
    const email = `test${timestamp}notes1@example.com`;
    await db.insert(users).values({
      openId: `test-openid-${timestamp}-notes1`,
      name: "Agent With Notes",
      email: email,
      role: "agent",
      status: "Active",
      notes: "Birddog agent for Cuiaba region",
      loginMethod: "apple",
    });

    const created = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    expect(created).toHaveLength(1);
    expect(created[0].notes).toBe("Birddog agent for Cuiaba region");
  });

  it("should update user role from agent to admin", async () => {
    const email = `test${timestamp}rolechange@example.com`;
    await db.insert(users).values({
      openId: `test-openid-${timestamp}-rolechange`,
      name: "Promoted User",
      email: email,
      role: "agent",
      status: "Active",
      loginMethod: "apple",
    });

    // Update role to admin
    await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.email, email));

    const updated = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    expect(updated).toHaveLength(1);
    expect(updated[0].role).toBe("admin");
  });

  it("should update user status from Active to Suspended", async () => {
    const email = `test${timestamp}suspend@example.com`;
    await db.insert(users).values({
      openId: `test-openid-${timestamp}-suspend`,
      name: "Suspended User",
      email: email,
      role: "agent",
      status: "Active",
      loginMethod: "apple",
    });

    // Suspend user
    await db
      .update(users)
      .set({ status: "Suspended" })
      .where(eq(users.email, email));

    const updated = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe("Suspended");
  });

  it("should delete a user", async () => {
    const email = `test${timestamp}delete@example.com`;
    await db.insert(users).values({
      openId: `test-openid-${timestamp}-delete`,
      name: "To Delete",
      email: email,
      role: "agent",
      status: "Active",
      loginMethod: "apple",
    });

    // Delete
    await db.delete(users).where(eq(users.email, email));

    const remaining = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    expect(remaining).toHaveLength(0);
  });
});
