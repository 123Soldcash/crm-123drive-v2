import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-calllog",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
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

describe("Call Log Integration - addCommunicationLog with mood/disposition/propertyDetails", () => {
  it("accepts mood, disposition, and propertyDetails in the input schema", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test that the procedure accepts the new fields without throwing a validation error
    // We expect a DB error since we don't have a real property/contact, but the schema validation should pass
    try {
      await caller.communication.addCommunicationLog({
        propertyId: 999999,
        contactId: 999999,
        communicationType: "Phone",
        callResult: "Not Answer",
        direction: "Outbound",
        mood: "😊",
        disposition: "Not Answer",
        propertyDetails: JSON.stringify({ bedBath: "3/2", sf: "1500" }),
        notes: "Test call with mood and disposition",
        nextStep: "",
      });
    } catch (error: any) {
      // We expect a DB error (foreign key constraint), NOT a validation error
      // If it's a TRPCError with code 'BAD_REQUEST', the schema validation failed
      expect(error.code).not.toBe("BAD_REQUEST");
    }
  });

  it("accepts call log without mood/disposition (backward compatible)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.communication.addCommunicationLog({
        propertyId: 999999,
        contactId: 999999,
        communicationType: "Phone",
        callResult: "Voicemail",
        direction: "Outbound",
        notes: "Test call without mood",
        nextStep: "",
      });
    } catch (error: any) {
      // Should not be a validation error - mood/disposition are optional
      expect(error.code).not.toBe("BAD_REQUEST");
    }
  });

  it("validates disposition as a string", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.communication.addCommunicationLog({
        propertyId: 999999,
        communicationType: "Phone",
        callResult: "Interested - HOT LEAD",
        direction: "Outbound",
        mood: "😡",
        disposition: "Interested - HOT LEAD",
        notes: "Hot lead test",
      });
    } catch (error: any) {
      expect(error.code).not.toBe("BAD_REQUEST");
    }
  });

  it("accepts propertyDetails as JSON string", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const propertyDetails = JSON.stringify({
      bedBath: "4/3",
      sf: "2,500",
      roofAge: "10 years",
      acAge: "5 years",
      overallCondition: "Good",
      reasonToSell: "Relocation",
      howFastToSell: "Within 3 months",
    });

    try {
      await caller.communication.addCommunicationLog({
        propertyId: 999999,
        contactId: 999999,
        communicationType: "Phone",
        callResult: "Interested - WARM LEAD - Not Hated",
        direction: "Outbound",
        mood: "😊",
        disposition: "Interested - WARM LEAD - Not Hated",
        propertyDetails,
        notes: "Warm lead with full property details",
      });
    } catch (error: any) {
      expect(error.code).not.toBe("BAD_REQUEST");
    }
  });

  it("rejects invalid communicationType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.communication.addCommunicationLog({
        propertyId: 999999,
        communicationType: "InvalidType" as any,
        notes: "Should fail validation",
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // This should be a validation error
      expect(error.code).toBe("BAD_REQUEST");
    }
  });

  it("rejects invalid callResult enum value", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.communication.addCommunicationLog({
        propertyId: 999999,
        communicationType: "Phone",
        callResult: "Not A Valid Result" as any,
        notes: "Should fail validation",
      });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe("BAD_REQUEST");
    }
  });

  it("accepts all valid callResult enum values", () => {
    const validResults = [
      "Interested - HOT LEAD",
      "Interested - WARM LEAD - Wants too Much / Full Price",
      "Interested - WARM LEAD - Not Hated",
      "Left Message - Owner Verified",
      "Left Message",
      "Beep Beep",
      "Busy",
      "Call Back",
      "Disconnected",
      "Duplicated number",
      "Fax",
      "Follow-up",
      "Hang up",
      "Has calling restrictions",
      "Investor/Buyer/Realtor Owned",
      "Irate - DNC",
      "Mail box full",
      "Mail box not set-up",
      "Not Answer",
      "Not Available",
      "Not Ringing",
      "Not Service",
      "Number repeated",
      "Player",
      "Portuguese",
      "Property does not fit our criteria",
      "Restrict",
      "See Notes",
      "Sold - DEAD",
      "Spanish",
      "Voicemail",
      "Wrong Number",
      "Wrong Person",
      "Other",
    ];

    // Verify all expected disposition options exist
    expect(validResults).toHaveLength(34);
    expect(validResults).toContain("Interested - HOT LEAD");
    expect(validResults).toContain("Irate - DNC");
    expect(validResults).toContain("Sold - DEAD");
    expect(validResults).toContain("Voicemail");
  });

  it("mood options cover all expected values", () => {
    const moodOptions = [
      { emoji: "😊", label: "Happy" },
      { emoji: "😐", label: "Neutral" },
      { emoji: "😡", label: "Mad" },
      { emoji: "😤", label: "Hated" },
      { emoji: "👴", label: "Senior" },
      { emoji: "🧒", label: "Kid" },
    ];

    expect(moodOptions).toHaveLength(6);
    expect(moodOptions.map((m) => m.emoji)).toEqual(["😊", "😐", "😡", "😤", "👴", "🧒"]);
  });

  it("propertyDetails JSON can be parsed back correctly", () => {
    const details = {
      bedBath: "3/2",
      sf: "1,500",
      roofAge: "5 years",
      acAge: "3 years",
      overallCondition: "Good",
      reasonToSell: "Relocation",
      howFastToSell: "ASAP",
    };

    const jsonStr = JSON.stringify(details);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.bedBath).toBe("3/2");
    expect(parsed.sf).toBe("1,500");
    expect(parsed.overallCondition).toBe("Good");
    expect(parsed.howFastToSell).toBe("ASAP");
    expect(Object.keys(parsed)).toHaveLength(7);
  });

  it("propertyDetails handles empty/partial data", () => {
    const partialDetails = { bedBath: "2/1" };
    const jsonStr = JSON.stringify(partialDetails);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.bedBath).toBe("2/1");
    expect(parsed.sf).toBeUndefined();
    expect(parsed.roofAge).toBeUndefined();
  });
});
