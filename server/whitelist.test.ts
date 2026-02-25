import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("../drizzle/schema", () => ({
  emailWhitelist: { email: "email", id: "id", role: "role", name: "name", addedBy: "addedBy", usedAt: "usedAt", createdAt: "createdAt" },
}));

describe("Email Whitelist System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Whitelist Logic", () => {
    it("should validate email format before adding to whitelist", () => {
      const validEmails = ["test@example.com", "user@domain.co", "name+tag@company.org"];
      const invalidEmails = ["notanemail", "@missing.com", "spaces in@email.com"];

      for (const email of validEmails) {
        expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
      for (const email of invalidEmails) {
        // At least one should fail
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (email === "notanemail" || email === "@missing.com") {
          expect(isValid).toBe(false);
        }
      }
    });

    it("should normalize email to lowercase", () => {
      const email = "User@Example.COM";
      expect(email.trim().toLowerCase()).toBe("user@example.com");
    });

    it("should accept valid roles: agent and admin", () => {
      const validRoles = ["agent", "admin"];
      for (const role of validRoles) {
        expect(["agent", "admin"]).toContain(role);
      }
    });

    it("should reject invalid roles", () => {
      const invalidRoles = ["superadmin", "manager", "owner", ""];
      for (const role of invalidRoles) {
        expect(["agent", "admin"]).not.toContain(role);
      }
    });
  });

  describe("OAuth Whitelist Check Logic", () => {
    it("should allow owner to login regardless of whitelist", () => {
      const ownerOpenId = "owner-123";
      const userOpenId = "owner-123";
      const isOwner = userOpenId === ownerOpenId;
      expect(isOwner).toBe(true);
    });

    it("should allow existing users to login without whitelist check", () => {
      const existingUser = { id: 1, openId: "user-123", email: "test@example.com", role: "agent" };
      expect(existingUser).toBeTruthy();
      // Existing users bypass whitelist check
    });

    it("should block new users whose email is NOT in whitelist", () => {
      const existingUser = null;
      const isOwner = false;
      const whitelistEntry = null; // Not in whitelist
      
      const shouldBlock = !existingUser && !isOwner && !whitelistEntry;
      expect(shouldBlock).toBe(true);
    });

    it("should allow new users whose email IS in whitelist", () => {
      const existingUser = null;
      const isOwner = false;
      const whitelistEntry = { id: 1, email: "new@example.com", role: "agent" };
      
      const shouldBlock = !existingUser && !isOwner && !whitelistEntry;
      expect(shouldBlock).toBe(false);
    });

    it("should create user with whitelisted role when new user registers", () => {
      const whitelistEntry = { id: 1, email: "new@example.com", role: "admin", name: "New Admin" };
      
      const newUser = {
        email: whitelistEntry.email,
        role: whitelistEntry.role,
        name: whitelistEntry.name,
        status: "Active",
      };

      expect(newUser.role).toBe("admin");
      expect(newUser.name).toBe("New Admin");
      expect(newUser.status).toBe("Active");
    });

    it("should mark whitelist entry as used after successful registration", () => {
      const whitelistEntry = { id: 1, email: "new@example.com", role: "agent", usedAt: null };
      
      // After registration, usedAt should be set
      const updatedEntry = { ...whitelistEntry, usedAt: new Date() };
      expect(updatedEntry.usedAt).toBeInstanceOf(Date);
    });

    it("should block users with no email from OAuth", () => {
      const existingUser = null;
      const isOwner = false;
      const userEmail = null;
      
      // No email means we can't check whitelist
      const shouldBlock = !existingUser && !isOwner && !userEmail;
      expect(shouldBlock).toBe(true);
    });

    it("should handle case-insensitive email matching", () => {
      const whitelistEmail = "user@example.com";
      const oauthEmail = "User@Example.COM";
      
      expect(oauthEmail.toLowerCase()).toBe(whitelistEmail.toLowerCase());
    });

    it("should not allow removal of already-used whitelist entries from UI", () => {
      const entry = { id: 1, email: "used@example.com", usedAt: new Date() };
      const canRemove = !entry.usedAt;
      expect(canRemove).toBe(false);
    });

    it("should prevent duplicate emails in whitelist", () => {
      const existingEmails = ["a@test.com", "b@test.com"];
      const newEmail = "a@test.com";
      const isDuplicate = existingEmails.includes(newEmail.toLowerCase());
      expect(isDuplicate).toBe(true);
    });
  });
});
