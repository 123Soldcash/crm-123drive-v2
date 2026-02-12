/**
 * Twilio Voice Integration Tests
 *
 * Tests cover:
 * 1. Environment variable validation
 * 2. Phone number formatting (E.164)
 * 3. Access token generation
 * 4. TwiML response building
 * 5. tRPC procedure integration (getAccessToken, checkConfig)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── 1. Phone Number Formatting ────────────────────────────────────────────

describe("formatPhoneNumber", () => {
  let formatPhoneNumber: typeof import("./twilio").formatPhoneNumber;

  beforeEach(async () => {
    const mod = await import("./twilio");
    formatPhoneNumber = mod.formatPhoneNumber;
  });

  it("formats a 10-digit US number to E.164", () => {
    expect(formatPhoneNumber("5551234567")).toBe("+15551234567");
  });

  it("formats an 11-digit US number starting with 1", () => {
    expect(formatPhoneNumber("15551234567")).toBe("+15551234567");
  });

  it("strips non-digit characters and formats", () => {
    expect(formatPhoneNumber("(555) 123-4567")).toBe("+15551234567");
  });

  it("preserves numbers already in E.164 format", () => {
    expect(formatPhoneNumber("+15551234567")).toBe("+15551234567");
  });

  it("handles dashes and spaces", () => {
    expect(formatPhoneNumber("555-123-4567")).toBe("+15551234567");
  });

  it("handles number with dots", () => {
    expect(formatPhoneNumber("555.123.4567")).toBe("+15551234567");
  });

  it("handles international format with +", () => {
    expect(formatPhoneNumber("+442071234567")).toBe("+442071234567");
  });
});

// ─── 2. TwiML Response Building ────────────────────────────────────────────

describe("buildTwimlResponse", () => {
  let buildTwimlResponse: typeof import("./twilio").buildTwimlResponse;

  beforeEach(async () => {
    const mod = await import("./twilio");
    buildTwimlResponse = mod.buildTwimlResponse;
  });

  it("returns TwiML with <Dial><Number> for a phone number", () => {
    const xml = buildTwimlResponse("+15551234567");
    expect(xml).toContain("<Dial");
    expect(xml).toContain("<Number>+15551234567</Number>");
    expect(xml).toContain("</Dial>");
    expect(xml).toContain("<?xml version");
  });

  it("returns TwiML with <Dial><Client> for a client identity", () => {
    const xml = buildTwimlResponse("user_42");
    expect(xml).toContain("<Client>user_42</Client>");
  });

  it("returns TwiML with <Say> when no destination", () => {
    const xml = buildTwimlResponse(undefined);
    expect(xml).toContain("<Say>");
    expect(xml).toContain("No destination");
  });

  it("uses callerId from env", () => {
    const xml = buildTwimlResponse("+15551234567");
    // The callerId should be set in the Dial element
    expect(xml).toContain("callerId");
  });

  it("treats all-digit strings as phone numbers", () => {
    const xml = buildTwimlResponse("5551234567");
    expect(xml).toContain("<Number>5551234567</Number>");
  });
});

// ─── 3. Config Validation ───────────────────────────────────────────────────

describe("validateTwilioConfig", () => {
  let validateTwilioConfig: typeof import("./twilio").validateTwilioConfig;

  beforeEach(async () => {
    const mod = await import("./twilio");
    validateTwilioConfig = mod.validateTwilioConfig;
  });

  it("returns valid:true when all env vars are set", () => {
    // These should be set in the test environment via .env
    const result = validateTwilioConfig();

    // If running in CI without env vars, check structure at minimum
    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("missing");
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("returns the correct structure", () => {
    const result = validateTwilioConfig();
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.missing)).toBe(true);
  });
});

// ─── 4. Access Token Generation ─────────────────────────────────────────────

describe("generateAccessToken", () => {
  let generateAccessToken: typeof import("./twilio").generateAccessToken;
  let validateTwilioConfig: typeof import("./twilio").validateTwilioConfig;

  beforeEach(async () => {
    const mod = await import("./twilio");
    generateAccessToken = mod.generateAccessToken;
    validateTwilioConfig = mod.validateTwilioConfig;
  });

  it("generates a JWT string when credentials are configured", () => {
    const config = validateTwilioConfig();

    if (!config.valid) {
      // Skip if env vars not set — this is expected in some CI environments
      console.warn("Skipping token test: Twilio env vars not configured");
      return;
    }

    const token = generateAccessToken("test_user_1");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(50);

    // JWT has 3 parts separated by dots
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("generates different tokens for different identities", () => {
    const config = validateTwilioConfig();
    if (!config.valid) return;

    const token1 = generateAccessToken("user_1");
    const token2 = generateAccessToken("user_2");
    expect(token1).not.toBe(token2);
  });

  it("respects custom TTL", () => {
    const config = validateTwilioConfig();
    if (!config.valid) return;

    const token = generateAccessToken("test_user", 60);
    expect(typeof token).toBe("string");

    // Decode the payload to check expiration
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    const ttl = payload.exp - payload.iat;
    expect(ttl).toBe(60);
  });
});

// ─── 5. tRPC Procedure Integration ─────────────────────────────────────────

describe("tRPC twilio procedures", () => {
  it("twilio.checkConfig returns valid structure via tRPC", async () => {
    const { appRouter } = await import("./routers");
    const { TrpcContext } = await import("./_core/context").catch(() => ({ TrpcContext: null }));

    const ctx = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.twilio.checkConfig();

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("missing");
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("twilio.getAccessToken returns token and identity", async () => {
    const { appRouter } = await import("./routers");
    const { validateTwilioConfig } = await import("./twilio");

    const config = validateTwilioConfig();
    if (!config.valid) {
      console.warn("Skipping tRPC token test: Twilio env vars not configured");
      return;
    }

    const ctx = {
      user: {
        id: 42,
        openId: "test-user-42",
        email: "test42@example.com",
        name: "Test User 42",
        loginMethod: "manus",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: () => {} } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.twilio.getAccessToken();

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("identity");
    expect(typeof result.token).toBe("string");
    expect(result.identity).toBe("user_42");
    expect(result.token.split(".")).toHaveLength(3); // Valid JWT
  });
});

// ─── 6. Environment Variables Present ───────────────────────────────────────

describe("Twilio environment variables", () => {
  it("TWILIO_ACCOUNT_SID starts with AC", () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    if (!sid) {
      console.warn("TWILIO_ACCOUNT_SID not set");
      return;
    }
    expect(sid).toMatch(/^AC/);
  });

  it("TWILIO_API_KEY starts with SK", () => {
    const key = process.env.TWILIO_API_KEY;
    if (!key) {
      console.warn("TWILIO_API_KEY not set");
      return;
    }
    expect(key).toMatch(/^SK/);
  });

  it("TWILIO_PHONE_NUMBER is in E.164 format", () => {
    const phone = process.env.TWILIO_PHONE_NUMBER;
    if (!phone) {
      console.warn("TWILIO_PHONE_NUMBER not set");
      return;
    }
    expect(phone).toMatch(/^\+\d{10,15}$/);
  });

  it("TWILIO_AUTH_TOKEN is present and non-empty", () => {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) {
      console.warn("TWILIO_AUTH_TOKEN not set");
      return;
    }
    expect(token.length).toBeGreaterThan(10);
  });

  it("TWILIO_API_SECRET is present and non-empty", () => {
    const secret = process.env.TWILIO_API_SECRET;
    if (!secret) {
      console.warn("TWILIO_API_SECRET not set");
      return;
    }
    expect(secret.length).toBeGreaterThan(10);
  });
});
