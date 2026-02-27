import { describe, expect, it, vi, beforeEach } from "vitest";
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// Mock fetch for Street View API test
const originalFetch = global.fetch;

describe("property image procedures", () => {
  describe("getStreetViewImage", () => {
    beforeEach(() => {
      // Restore fetch after each test
      global.fetch = originalFetch;
    });

    it("returns imageBase64 when Street View API returns an image", async () => {
      // Mock fetch to return a fake JPEG image
      const fakeImageBuffer = Buffer.from("fake-jpeg-image-data");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === "content-type" ? "image/jpeg" : null,
        },
        arrayBuffer: () => Promise.resolve(fakeImageBuffer.buffer.slice(
          fakeImageBuffer.byteOffset,
          fakeImageBuffer.byteOffset + fakeImageBuffer.byteLength
        )),
      });

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.properties.getStreetViewImage({
        address: "102 Marion Rd",
        city: "West Park",
        state: "FL",
        zipcode: "33023",
      });

      expect(result).toHaveProperty("imageBase64");
      if (result.imageBase64) {
        expect(result.imageBase64).toMatch(/^data:image\/jpeg;base64,/);
      }
      // Verify fetch was called with correct URL pattern
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(fetchUrl).toContain("streetview");
      expect(fetchUrl).toContain("102%20Marion%20Rd");
    });

    it("returns null imageBase64 when Street View API fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: {
          get: () => null,
        },
      });

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.properties.getStreetViewImage({
        address: "Nonexistent Address",
        city: "Nowhere",
        state: "XX",
        zipcode: "00000",
      });

      expect(result).toEqual({ imageBase64: null });
    });

    it("returns null imageBase64 when fetch throws an error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.properties.getStreetViewImage({
        address: "102 Marion Rd",
        city: "West Park",
        state: "FL",
        zipcode: "33023",
      });

      expect(result).toEqual({ imageBase64: null });
    });

    it("returns null when response is not an image content type", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === "content-type" ? "application/json" : null,
        },
      });

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.properties.getStreetViewImage({
        address: "102 Marion Rd",
        city: "West Park",
        state: "FL",
        zipcode: "33023",
      });

      expect(result).toEqual({ imageBase64: null });
    });

    it("constructs the full address correctly from parts", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: () => null },
      });

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await caller.properties.getStreetViewImage({
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        zipcode: "33101",
      });

      const fetchUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(fetchUrl).toContain(encodeURIComponent("123 Main St, Miami, FL 33101"));
    });
  });
});
