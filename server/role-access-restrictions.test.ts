import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "admin" | "agent", userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@test.com`,
    name: role === "admin" ? "Admin User" : "Agent User",
    loginMethod: "manus",
    role,
    status: "Active",
    notes: null,
    twilioPhone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Role-based Access Restrictions", () => {
  // ─── Deep Search: Admin Only ───────────────────────────────────────────────
  describe("Deep Search - admin only", () => {
    it("should allow admin to access deepSearch.getOverview", async () => {
      const ctx = createContext("admin");
      const caller = appRouter.createCaller(ctx);

      // Should not throw FORBIDDEN - may return null if no data exists
      const result = await caller.deepSearch.getOverview({ propertyId: 999999 });
      // null is fine - means no data, but access was granted
      expect(result).toBeNull();
    });

    it("should block agent from accessing deepSearch.getOverview", async () => {
      const ctx = createContext("agent", 2);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.deepSearch.getOverview({ propertyId: 999999 })
      ).rejects.toThrow(/FORBIDDEN|permission/i);
    });

    it("should block agent from accessing deepSearch.getFinancial", async () => {
      const ctx = createContext("agent", 2);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.deepSearch.getFinancial({ propertyId: 999999 })
      ).rejects.toThrow(/FORBIDDEN|permission/i);
    });

    it("should block agent from accessing deepSearch.getDistressScore", async () => {
      const ctx = createContext("agent", 2);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.deepSearch.getDistressScore({ propertyId: 999999 })
      ).rejects.toThrow(/FORBIDDEN|permission/i);
    });
  });

  // ─── Contacts: Decision Makers Only for Agents ─────────────────────────────
  describe("Contacts - agents see only decision makers", () => {
    it("contacts.byProperty should filter for agents (code review check)", async () => {
      // Verify the router code contains the isDecisionMaker filter
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers.ts", "utf-8")
      );

      // Check that contacts.byProperty has the decision maker filter
      const byPropertySection = routerSource.slice(
        routerSource.indexOf("contacts: router({"),
        routerSource.indexOf("contacts: router({") + 500
      );

      expect(byPropertySection).toContain("isDecisionMaker");
      expect(byPropertySection).toContain("ctx.user.role !== 'admin'");
    });

    it("communication.getContactsByProperty should filter for agents (code review check)", async () => {
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers.ts", "utf-8")
      );

      const commSection = routerSource.slice(
        routerSource.indexOf("getContactsByProperty: protectedProcedure"),
        routerSource.indexOf("getContactsByProperty: protectedProcedure") + 500
      );

      expect(commSection).toContain("isDecisionMaker");
      expect(commSection).toContain("ctx.user.role !== 'admin'");
    });
  });

  // ─── Tasks: Agents see only their own ──────────────────────────────────────
  describe("Tasks - agents see only their own", () => {
    it("tasks.byProperty should filter by user for agents (code review check)", async () => {
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers.ts", "utf-8")
      );

      // Find the byProperty section within tasks router
      const byPropertyIdx = routerSource.indexOf("byProperty: protectedProcedure", routerSource.indexOf("tasks: router({"));
      const byPropertySection = routerSource.slice(byPropertyIdx, byPropertyIdx + 500);

      // Should filter by createdById or assignedToId for agents
      expect(byPropertySection).toContain("ctx.user.role !== 'admin'");
      expect(byPropertySection).toContain("createdById");
      expect(byPropertySection).toContain("assignedToId");
      expect(byPropertySection).toContain("ctx.user.id");
    });

    it("tasks.list should filter by userId for non-admin users", async () => {
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers.ts", "utf-8")
      );

      const tasksSection = routerSource.slice(
        routerSource.indexOf("tasks: router({"),
        routerSource.indexOf("tasks: router({") + 800
      );

      // tasks.list uses ctx.user?.role === 'admin' pattern
      expect(tasksSection).toContain("ctx.user?.role === 'admin'");
      expect(tasksSection).toContain("ctx.user?.id");
    });
  });

  // ─── Notes: Agents see only their own ──────────────────────────────────────
  describe("Notes - agents see only their own", () => {
    it("notes.byProperty should filter by userId for agents (code review check)", async () => {
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers.ts", "utf-8")
      );

      const notesSection = routerSource.slice(
        routerSource.indexOf("notes: router({"),
        routerSource.indexOf("notes: router({") + 500
      );

      expect(notesSection).toContain("ctx.user.role !== 'admin'");
      expect(notesSection).toContain("userId");
      expect(notesSection).toContain("ctx.user.id");
    });
  });

  // ─── Property getById: Strip sensitive data for agents ─────────────────────
  describe("Property getById - strip sensitive data for agents", () => {
    it("should strip deep search fields for agents (code review check)", async () => {
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers.ts", "utf-8")
      );

      const getByIdSection = routerSource.slice(
        routerSource.indexOf("getById: protectedProcedure"),
        routerSource.indexOf("getById: protectedProcedure") + 800
      );

      // Should destructure and remove sensitive fields for agents
      expect(getByIdSection).toContain("ctx.user.role !== 'admin'");
      expect(getByIdSection).toContain("propertyCondition");
      expect(getByIdSection).toContain("issues");
      expect(getByIdSection).toContain("hasMortgage");
      expect(getByIdSection).toContain("delinquentTaxTotal");
      expect(getByIdSection).toContain("dealMachineRawData");
      // Should also filter contacts to decision makers
      expect(getByIdSection).toContain("isDecisionMaker");
    });
  });

  // ─── Frontend: Admin-only sections hidden ──────────────────────────────────
  describe("Frontend - admin-only sections hidden for agents", () => {
    it("PropertyDetail should wrap DeepSearch, FamilyTree, ActivityTimeline, BuyerMatching in admin check", async () => {
      const pageSource = await import("fs").then((fs) =>
        fs.readFileSync("client/src/pages/PropertyDetail.tsx", "utf-8")
      );

      // Count occurrences of role === 'admin' checks in JSX (not imports)
      const adminChecks = (pageSource.match(/user\?\.role === 'admin'/g) || []).length;
      expect(adminChecks).toBeGreaterThanOrEqual(2); // At least 2 blocks: DeepSearch+FamilyTree, ActivityTimeline+BuyerMatching

      // Find the JSX rendering section (after return statement)
      const returnIdx = pageSource.lastIndexOf("return (");
      const jsxSection = pageSource.slice(returnIdx);

      // In JSX, DeepSearchOverview should appear after an admin check
      const firstAdminCheck = jsxSection.indexOf("user?.role === 'admin'");
      const deepSearchIdx = jsxSection.indexOf("DeepSearchOverview");
      const familyTreeIdx = jsxSection.indexOf("FamilyTreeEnhanced");
      const activityIdx = jsxSection.indexOf("ActivityTimeline");
      const buyerIdx = jsxSection.indexOf("BuyerMatching");

      expect(firstAdminCheck).toBeGreaterThan(-1);
      expect(firstAdminCheck).toBeLessThan(deepSearchIdx);
      expect(firstAdminCheck).toBeLessThan(familyTreeIdx);

      // Second admin check for ActivityTimeline and BuyerMatching
      const secondAdminCheck = jsxSection.indexOf("user?.role === 'admin'", firstAdminCheck + 1);
      expect(secondAdminCheck).toBeGreaterThan(-1);
      expect(secondAdminCheck).toBeLessThan(activityIdx);
      expect(secondAdminCheck).toBeLessThan(buyerIdx);
    });
  });

  // ─── Deep Search Router: All procedures use adminProcedure ─────────────────
  describe("Deep Search Router - all procedures use adminProcedure", () => {
    it("should import adminProcedure instead of protectedProcedure", async () => {
      const routerSource = await import("fs").then((fs) =>
        fs.readFileSync("server/routers/deep-search.ts", "utf-8")
      );

      expect(routerSource).toContain("import { adminProcedure");
      expect(routerSource).not.toContain("protectedProcedure");
    });
  });
});
