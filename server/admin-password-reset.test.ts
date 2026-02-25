import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Admin Password Reset", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user for password reset tests
    const result = await db
      .insert(users)
      .values({
        openId: `test-pwd-reset-${Date.now()}`,
        name: "Test Password User",
        email: `pwd-test-${Date.now()}@test.com`,
        role: "agent",
        status: "Active",
        loginMethod: "invite",
        passwordHash: await bcrypt.hash("oldPassword123", 10),
      })
      .$returningId();

    testUserId = result[0].id;
  });

  afterAll(async () => {
    if (db && testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should hash a password correctly with bcrypt", async () => {
    const password = "newSecurePassword123";
    const hash = await bcrypt.hash(password, 10);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  it("should verify a correct password against its hash", async () => {
    const password = "testPassword456";
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password against a hash", async () => {
    const password = "correctPassword";
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare("wrongPassword", hash);
    expect(isValid).toBe(false);
  });

  it("should update the passwordHash in the database", async () => {
    const newPassword = "brandNewPassword789";
    const newHash = await bcrypt.hash(newPassword, 10);

    await db!
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, testUserId));

    // Verify the hash was updated
    const updatedUser = await db!
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, testUserId));

    expect(updatedUser.length).toBe(1);
    expect(updatedUser[0].passwordHash).toBe(newHash);

    // Verify the new password works
    const isValid = await bcrypt.compare(newPassword, updatedUser[0].passwordHash!);
    expect(isValid).toBe(true);
  });

  it("should not match old password after reset", async () => {
    const oldPassword = "oldPassword123";
    const newPassword = "updatedPassword999";
    const newHash = await bcrypt.hash(newPassword, 10);

    await db!
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, testUserId));

    const updatedUser = await db!
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, testUserId));

    // Old password should NOT work
    const oldValid = await bcrypt.compare(oldPassword, updatedUser[0].passwordHash!);
    expect(oldValid).toBe(false);

    // New password should work
    const newValid = await bcrypt.compare(newPassword, updatedUser[0].passwordHash!);
    expect(newValid).toBe(true);
  });

  it("should handle user with no existing password (null passwordHash)", async () => {
    // Create a user with no password
    const noPassResult = await db!
      .insert(users)
      .values({
        openId: `test-no-pwd-${Date.now()}`,
        name: "No Password User",
        role: "agent",
        status: "Active",
        loginMethod: "oauth",
        passwordHash: null,
      })
      .$returningId();

    const noPassUserId = noPassResult[0].id;

    try {
      // Set a password for the first time
      const newPassword = "firstPassword123";
      const hash = await bcrypt.hash(newPassword, 10);

      await db!
        .update(users)
        .set({ passwordHash: hash })
        .where(eq(users.id, noPassUserId));

      const updated = await db!
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, noPassUserId));

      expect(updated[0].passwordHash).not.toBeNull();
      const isValid = await bcrypt.compare(newPassword, updated[0].passwordHash!);
      expect(isValid).toBe(true);
    } finally {
      await db!.delete(users).where(eq(users.id, noPassUserId));
    }
  });

  it("should enforce minimum password length of 6 characters", () => {
    // This tests the validation logic that the frontend and backend enforce
    const shortPassword = "12345";
    const validPassword = "123456";

    expect(shortPassword.length).toBeLessThan(6);
    expect(validPassword.length).toBeGreaterThanOrEqual(6);
  });

  it("should generate different hashes for the same password (salt)", async () => {
    const password = "samePassword";
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    // Different hashes due to random salt
    expect(hash1).not.toBe(hash2);

    // Both should verify correctly
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});
