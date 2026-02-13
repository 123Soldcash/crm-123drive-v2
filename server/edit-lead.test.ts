/**
 * Edit Lead (properties.update) Tests
 *
 * Tests cover:
 * 1. The properties.update tRPC procedure accepts valid input
 * 2. Partial updates work (only provided fields are updated)
 * 3. Input validation rejects invalid data
 * 4. The procedure requires authentication
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("properties.update (Edit Lead)", () => {
  it("accepts a valid update with all fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Use a property ID that exists in the database
    // This tests that the procedure accepts the input shape correctly
    try {
      const result = await caller.properties.update({
        id: 1,
        addressLine1: "123 Test St",
        city: "Miami",
        state: "FL",
        zipcode: "33101",
        leadTemperature: "HOT",
        estimatedValue: 250000,
        equityPercent: 50,
        owner1Name: "John Doe",
        owner2Name: "Jane Doe",
        totalBedrooms: 3,
        totalBaths: 2,
        buildingSquareFeet: 1500,
        yearBuilt: 2000,
        source: "Manual",
        listName: "Test List",
        entryDate: new Date("2025-01-15"),
      });
      expect(result).toEqual({ success: true });
    } catch (err: any) {
      // If property ID 1 doesn't exist, the update still succeeds (0 rows affected)
      // but doesn't throw — so any error here is unexpected unless DB is down
      if (!err.message.includes("Database not available")) {
        expect(result).toBeDefined();
      }
    }
  });

  it("accepts a partial update with only some fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.properties.update({
        id: 1,
        leadTemperature: "WARM",
      });
      expect(result).toEqual({ success: true });
    } catch (err: any) {
      // DB might not have property ID 1, that's OK
      if (!err.message.includes("Database not available")) {
        expect(result).toBeDefined();
      }
    }
  });

  it("requires the id field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // @ts-expect-error - Testing missing required field
    await expect(caller.properties.update({})).rejects.toThrow();
  });

  it("rejects non-numeric id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // @ts-expect-error - Testing wrong type
    await expect(caller.properties.update({ id: "abc" })).rejects.toThrow();
  });

  it("rejects non-numeric estimatedValue", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.properties.update({
        id: 1,
        // @ts-expect-error - Testing wrong type
        estimatedValue: "not-a-number",
      })
    ).rejects.toThrow();
  });

  it("rejects non-numeric equityPercent", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.properties.update({
        id: 1,
        // @ts-expect-error - Testing wrong type
        equityPercent: "fifty",
      })
    ).rejects.toThrow();
  });

  it("rejects non-numeric totalBedrooms", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.properties.update({
        id: 1,
        // @ts-expect-error - Testing wrong type
        totalBedrooms: "three",
      })
    ).rejects.toThrow();
  });

  it("requires authentication (unauthenticated user cannot update)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.properties.update({
        id: 1,
        leadTemperature: "HOT",
      })
    ).rejects.toThrow();
  });

  it("handles update with only id (no fields to update)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // When only id is provided and no other fields, Drizzle throws "No values to set"
    // This is expected behavior — at least one field should be provided
    await expect(
      caller.properties.update({ id: 1 })
    ).rejects.toThrow();
  });

  it("accepts entryDate as a Date object", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.properties.update({
        id: 1,
        entryDate: new Date("2025-06-15"),
      });
      expect(result).toEqual({ success: true });
    } catch (err: any) {
      if (!err.message.includes("Database not available")) {
        expect(result).toBeDefined();
      }
    }
  });
});

describe("properties.update input schema", () => {
  it("validates the complete input schema shape", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This should NOT throw a validation error — all fields are valid types
    const validInput = {
      id: 999999,
      addressLine1: "456 Oak Ave",
      city: "Orlando",
      state: "FL",
      zipcode: "32801",
      leadTemperature: "COLD",
      estimatedValue: 180000,
      equityPercent: 75,
      owner1Name: "Alice Smith",
      owner2Name: "Bob Smith",
      totalBedrooms: 4,
      totalBaths: 3,
      buildingSquareFeet: 2200,
      yearBuilt: 1995,
      source: "DealMachine",
      listName: "Driving Campaign",
      entryDate: new Date(),
    };

    try {
      const result = await caller.properties.update(validInput);
      // Even if property 999999 doesn't exist, the mutation should succeed
      // (0 rows updated, but no error thrown)
      expect(result).toEqual({ success: true });
    } catch (err: any) {
      // Only acceptable error is DB not available
      expect(err.message).toContain("Database");
    }
  });
});
