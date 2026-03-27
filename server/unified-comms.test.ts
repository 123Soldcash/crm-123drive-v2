import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("callHistory.unified", () => {
  it("returns an array of unified communication records", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "all",
      direction: "all",
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
    // Each record should have the unified shape
    if (result.length > 0) {
      const rec = result[0];
      expect(rec).toHaveProperty("id");
      expect(rec).toHaveProperty("type");
      expect(["call", "sms"]).toContain(rec.type);
      expect(rec).toHaveProperty("direction");
      expect(["Inbound", "Outbound"]).toContain(rec.direction);
      expect(rec).toHaveProperty("phoneNumber");
      expect(rec).toHaveProperty("propertyAddress");
      expect(rec).toHaveProperty("agentName");
      expect(rec).toHaveProperty("date");
    }
  });

  it("filters by commType=call returns only calls", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "call",
      direction: "all",
      limit: 50,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
    for (const rec of result) {
      expect(rec.type).toBe("call");
    }
  });

  it("filters by commType=sms returns only SMS", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "sms",
      direction: "all",
      limit: 50,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
    for (const rec of result) {
      expect(rec.type).toBe("sms");
    }
  });

  it("filters by direction=Inbound returns only inbound records", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "all",
      direction: "Inbound",
      limit: 50,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
    for (const rec of result) {
      expect(rec.direction).toBe("Inbound");
    }
  });

  it("filters by direction=Outbound returns only outbound records", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "all",
      direction: "Outbound",
      limit: 50,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
    for (const rec of result) {
      expect(rec.direction).toBe("Outbound");
    }
  });

  it("records are sorted by date descending by default", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "all",
      direction: "all",
      limit: 50,
      offset: 0,
    });

    if (result.length > 1) {
      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1].date).getTime();
        const curr = new Date(result[i].date).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    }
  });

  it("respects limit parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "all",
      direction: "all",
      limit: 5,
      offset: 0,
    });

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("SMS records have messageBody and messageStatus fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "sms",
      direction: "all",
      limit: 10,
      offset: 0,
    });

    for (const rec of result) {
      expect(rec).toHaveProperty("messageBody");
      expect(rec).toHaveProperty("messageStatus");
      // SMS should have a body
      if (rec.messageBody !== null) {
        expect(typeof rec.messageBody).toBe("string");
      }
    }
  });

  it("call records have callResult and disposition fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.callHistory.unified({
      commType: "call",
      direction: "all",
      limit: 10,
      offset: 0,
    });

    for (const rec of result) {
      expect(rec).toHaveProperty("callResult");
      expect(rec).toHaveProperty("disposition");
      // Calls should NOT have messageBody
      expect(rec.messageBody).toBeNull();
    }
  });
});

describe("callHistory.unifiedStats", () => {
  it("returns stats with call and SMS counts", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.callHistory.unifiedStats();

    expect(stats).toHaveProperty("totalCalls");
    expect(stats).toHaveProperty("totalSms");
    expect(stats).toHaveProperty("totalAll");
    expect(stats).toHaveProperty("inboundCalls");
    expect(stats).toHaveProperty("outboundCalls");
    expect(stats).toHaveProperty("inboundSms");
    expect(stats).toHaveProperty("outboundSms");
    expect(stats).toHaveProperty("inboundAll");
    expect(stats).toHaveProperty("outboundAll");

    // totalAll should be sum of calls + sms
    expect(stats.totalAll).toBe(stats.totalCalls + stats.totalSms);
    expect(stats.inboundAll).toBe(stats.inboundCalls + stats.inboundSms);
    expect(stats.outboundAll).toBe(stats.outboundCalls + stats.outboundSms);

    // All counts should be non-negative
    expect(stats.totalCalls).toBeGreaterThanOrEqual(0);
    expect(stats.totalSms).toBeGreaterThanOrEqual(0);
  });
});
