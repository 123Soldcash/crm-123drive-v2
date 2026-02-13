import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createRegularUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Agent Assignment - Duplicate Prevention", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);
  const testPropertyId = 1050023;
  const testAgentId = 1;

  it("should assign an agent to a property successfully", async () => {
    // Clean up first in case previous test left data
    try {
      await adminCaller.properties.removeAgent({ propertyId: testPropertyId, agentId: testAgentId });
    } catch (_) { /* ignore if not exists */ }

    const result = await adminCaller.properties.assignAgent({
      propertyId: testPropertyId,
      agentId: testAgentId,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("should NOT create a duplicate when assigning the same agent again", async () => {
    // Assign same agent a second time
    const result = await adminCaller.properties.assignAgent({
      propertyId: testPropertyId,
      agentId: testAgentId,
    });
    expect(result).toHaveProperty("success", true);

    // Verify only ONE assignment exists (not two)
    const agents = await adminCaller.properties.getAssignedAgents({
      propertyId: testPropertyId,
    });
    const occurrences = agents.filter((a: any) => a.agentId === testAgentId);
    expect(occurrences.length).toBe(1);
  });

  it("should NOT create a duplicate even after multiple rapid assignments", async () => {
    // Simulate rapid clicks - assign 5 times
    await Promise.all([
      adminCaller.properties.assignAgent({ propertyId: testPropertyId, agentId: testAgentId }),
      adminCaller.properties.assignAgent({ propertyId: testPropertyId, agentId: testAgentId }),
      adminCaller.properties.assignAgent({ propertyId: testPropertyId, agentId: testAgentId }),
    ]);

    const agents = await adminCaller.properties.getAssignedAgents({
      propertyId: testPropertyId,
    });
    const occurrences = agents.filter((a: any) => a.agentId === testAgentId);
    expect(occurrences.length).toBe(1);
  });

  it("should remove an agent assignment successfully", async () => {
    const result = await adminCaller.properties.removeAgent({
      propertyId: testPropertyId,
      agentId: testAgentId,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("should show agent as not assigned after removal", async () => {
    const agents = await adminCaller.properties.getAssignedAgents({
      propertyId: testPropertyId,
    });
    const occurrences = agents.filter((a: any) => a.agentId === testAgentId);
    expect(occurrences.length).toBe(0);
  });

  it("should allow re-assigning an agent after removal (toggle on)", async () => {
    const result = await adminCaller.properties.assignAgent({
      propertyId: testPropertyId,
      agentId: testAgentId,
    });
    expect(result).toHaveProperty("success", true);

    const agents = await adminCaller.properties.getAssignedAgents({
      propertyId: testPropertyId,
    });
    const occurrences = agents.filter((a: any) => a.agentId === testAgentId);
    expect(occurrences.length).toBe(1);
  });

  it("should allow multiple DIFFERENT agents on the same property", async () => {
    const secondAgentId = 2;

    await adminCaller.properties.assignAgent({
      propertyId: testPropertyId,
      agentId: secondAgentId,
    });

    const agents = await adminCaller.properties.getAssignedAgents({
      propertyId: testPropertyId,
    });
    const uniqueAgentIds = new Set(agents.map((a: any) => a.agentId));
    expect(uniqueAgentIds.size).toBeGreaterThanOrEqual(2);

    // Clean up
    await adminCaller.properties.removeAgent({ propertyId: testPropertyId, agentId: secondAgentId });
  });

  it("should prevent non-admin users from removing agents", async () => {
    const userCtx = createRegularUserContext();
    const userCaller = appRouter.createCaller(userCtx);

    await expect(
      userCaller.properties.removeAgent({
        propertyId: testPropertyId,
        agentId: testAgentId,
      })
    ).rejects.toThrow("Only admins can remove agents");
  });

  // Final cleanup
  it("cleanup - remove test assignment", async () => {
    try {
      await adminCaller.properties.removeAgent({ propertyId: testPropertyId, agentId: testAgentId });
    } catch (_) { /* ignore */ }
  });
});
