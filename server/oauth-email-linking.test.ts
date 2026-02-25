import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("OAuth Email Linking for Invited Users", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  const testEmail = `oauth-link-test-${Date.now()}@test.com`;
  const inviteOpenId = `invite-test-${Date.now()}`;
  const realOAuthOpenId = `real-oauth-${Date.now()}`;
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Simulate an invited user with a temporary openId
    const result = await db
      .insert(users)
      .values({
        openId: inviteOpenId,
        name: "Invited Test User",
        email: testEmail,
        role: "agent",
        status: "Active",
        loginMethod: "invite",
      })
      .$returningId();

    testUserId = result[0].id;
  });

  afterAll(async () => {
    if (db && testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should find invited user by temporary openId", async () => {
    const result = await db!
      .select()
      .from(users)
      .where(eq(users.openId, inviteOpenId))
      .limit(1);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Invited Test User");
    expect(result[0].loginMethod).toBe("invite");
  });

  it("should NOT find invited user by real OAuth openId (before linking)", async () => {
    const result = await db!
      .select()
      .from(users)
      .where(eq(users.openId, realOAuthOpenId))
      .limit(1);

    expect(result.length).toBe(0);
  });

  it("should find invited user by email", async () => {
    const result = await db!
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    expect(result.length).toBe(1);
    expect(result[0].openId).toBe(inviteOpenId);
  });

  it("should update openId when linking OAuth to invited user", async () => {
    // Simulate what the OAuth callback does: update openId from invite to real
    await db!
      .update(users)
      .set({
        openId: realOAuthOpenId,
        loginMethod: "google",
        lastSignedIn: new Date(),
      })
      .where(eq(users.id, testUserId));

    // Now the user should be findable by the real OAuth openId
    const result = await db!
      .select()
      .from(users)
      .where(eq(users.openId, realOAuthOpenId))
      .limit(1);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Invited Test User");
    expect(result[0].email).toBe(testEmail);
    expect(result[0].loginMethod).toBe("google");
  });

  it("should NOT find user by old invite openId after linking", async () => {
    const result = await db!
      .select()
      .from(users)
      .where(eq(users.openId, inviteOpenId))
      .limit(1);

    expect(result.length).toBe(0);
  });

  it("should preserve user role and status after openId update", async () => {
    const result = await db!
      .select({ role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, testUserId));

    expect(result[0].role).toBe("agent");
    expect(result[0].status).toBe("Active");
  });

  it("should block unknown user who has no matching openId or email", async () => {
    const unknownOpenId = `unknown-${Date.now()}`;
    const unknownEmail = `unknown-${Date.now()}@test.com`;

    // No match by openId
    const byOpenId = await db!
      .select()
      .from(users)
      .where(eq(users.openId, unknownOpenId))
      .limit(1);
    expect(byOpenId.length).toBe(0);

    // No match by email
    const byEmail = await db!
      .select()
      .from(users)
      .where(eq(users.email, unknownEmail))
      .limit(1);
    expect(byEmail.length).toBe(0);

    // Both empty = user should be blocked (invite-only)
    const isAuthorized = byOpenId.length > 0 || byEmail.length > 0;
    expect(isAuthorized).toBe(false);
  });
});
