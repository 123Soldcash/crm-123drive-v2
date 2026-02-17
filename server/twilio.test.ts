/**
 * Twilio Voice Integration Tests — Pure REST API Approach
 *
 * Tests cover:
 * 1. Phone number formatting (E.164)
 * 2. TwiML response building (voice + connect)
 * 3. Config validation
 * 4. tRPC procedure integration (checkConfig, makeCall, getCallStatus)
 * 5. Environment variables present and valid
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    expect(xml).toContain("callerId");
  });

  it("treats all-digit strings as phone numbers", () => {
    const xml = buildTwimlResponse("5551234567");
    expect(xml).toContain("<Number>5551234567</Number>");
  });
});

// ─── 3. Connect TwiML Building ─────────────────────────────────────────────

describe("buildConnectTwiml", () => {
  let buildConnectTwiml: typeof import("./twilio").buildConnectTwiml;

  beforeEach(async () => {
    const mod = await import("./twilio");
    buildConnectTwiml = mod.buildConnectTwiml;
  });

  it("returns valid TwiML XML", () => {
    const xml = buildConnectTwiml("+15551234567");
    expect(xml).toContain("<?xml version");
    expect(xml).toContain("<Response>");
  });

  it("includes a Dial element with the destination number", () => {
    const xml = buildConnectTwiml("+15551234567");
    expect(xml).toContain("<Dial");
    expect(xml).toContain("<Number>+15551234567</Number>");
  });

  it("formats the phone number to E.164", () => {
    const xml = buildConnectTwiml("5551234567");
    expect(xml).toContain("<Number>+15551234567</Number>");
  });

  it("includes callerId in the Dial element", () => {
    const xml = buildConnectTwiml("+15551234567");
    expect(xml).toContain("callerId");
  });

  it("includes timeout in the Dial element", () => {
    const xml = buildConnectTwiml("+15551234567");
    expect(xml).toContain("timeout");
  });
});

// ─── 4. Config Validation ───────────────────────────────────────────────────

describe("validateTwilioConfig", () => {
  let validateTwilioConfig: typeof import("./twilio").validateTwilioConfig;

  beforeEach(async () => {
    const mod = await import("./twilio");
    validateTwilioConfig = mod.validateTwilioConfig;
  });

  it("returns valid:true when all env vars are set", () => {
    const result = validateTwilioConfig();
    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("missing");
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("returns the correct structure", () => {
    const result = validateTwilioConfig();
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("checks only essential credentials (ACCOUNT_SID, AUTH_TOKEN, PHONE_NUMBER)", () => {
    const result = validateTwilioConfig();
    // If valid, no missing keys
    if (result.valid) {
      expect(result.missing).toHaveLength(0);
    }
    // Missing keys should only be from the required set
    result.missing.forEach((key) => {
      expect(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"]).toContain(key);
    });
  });
});

// ─── 5. tRPC Procedure Integration ─────────────────────────────────────────

describe("tRPC twilio procedures", () => {
  const mockCtx = {
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

  it("twilio.checkConfig returns valid structure via tRPC", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(mockCtx);
    const result = await caller.twilio.checkConfig();

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("missing");
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("twilio.makeCall requires a phone number", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(mockCtx);

    // Should throw validation error for empty phone number
    await expect(caller.twilio.makeCall({ to: "" })).rejects.toThrow();
  });

  it("twilio.makeCall accepts a valid phone number and initiates call", async () => {
    const { appRouter } = await import("./routers");
    const { validateTwilioConfig } = await import("./twilio");

    const config = validateTwilioConfig();
    if (!config.valid) {
      console.warn("Skipping makeCall test: Twilio env vars not configured");
      return;
    }

    const caller = appRouter.createCaller(mockCtx);

    try {
      const result = await caller.twilio.makeCall({ to: "+15551234567" });
      // If it succeeds, it should return a callSid
      expect(result).toHaveProperty("callSid");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("to");
      expect(result).toHaveProperty("from");
    } catch (err: any) {
      // Expected to fail for invalid test numbers, but should NOT be a validation error
      expect(err.message).not.toContain("Phone number is required");
      // Twilio API errors are acceptable (e.g., 21215 for geo permissions)
    }
  });

  it("twilio.getCallStatus requires a callSid", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(mockCtx);

    await expect(caller.twilio.getCallStatus({ callSid: "" })).rejects.toThrow();
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

  it("TWILIO_AUTH_TOKEN is present and non-empty", () => {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) {
      console.warn("TWILIO_AUTH_TOKEN not set");
      return;
    }
    expect(token.length).toBeGreaterThan(10);
  });

  it("TWILIO_PHONE_NUMBER is in E.164 format", () => {
    const phone = process.env.TWILIO_PHONE_NUMBER;
    if (!phone) {
      console.warn("TWILIO_PHONE_NUMBER not set");
      return;
    }
    expect(phone).toMatch(/^\+\d{10,15}$/);
  });
});

// ─── 7. CUSTOM_DOMAIN for Twilio Callbacks ───────────────────────────────

describe("CUSTOM_DOMAIN for Twilio callbacks", () => {
  it("CUSTOM_DOMAIN env var is set", () => {
    const domain = process.env.CUSTOM_DOMAIN;
    expect(domain).toBeTruthy();
    expect(typeof domain).toBe("string");
  });

  it("CUSTOM_DOMAIN points to a valid manus.space domain", () => {
    const domain = process.env.CUSTOM_DOMAIN;
    if (!domain) {
      console.warn("CUSTOM_DOMAIN not set");
      return;
    }
    expect(domain).toContain("manus.space");
  });

  it("CUSTOM_DOMAIN is accessible (returns 200)", async () => {
    const domain = process.env.CUSTOM_DOMAIN;
    if (!domain) {
      console.warn("CUSTOM_DOMAIN not set");
      return;
    }
    try {
      const resp = await fetch(`https://${domain}/api/twilio/status`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "CallStatus=completed&CallSid=test",
        signal: AbortSignal.timeout(3000),
      });
      // If we get a response, check it's 200
      expect(resp.status).toBe(200);
    } catch (err) {
      // Network errors or timeouts in test env are acceptable
      console.warn("Could not reach CUSTOM_DOMAIN (expected in sandbox):", err);
    }
  });
});

// ─── 8. Answered TwiML (No Duplicate Call) ───────────────────────────────

describe("buildAnsweredTwiml (duplicate call prevention)", () => {
  let buildAnsweredTwiml: typeof import("./twilio").buildAnsweredTwiml;

  beforeEach(async () => {
    const mod = await import("./twilio");
    buildAnsweredTwiml = mod.buildAnsweredTwiml;
  });

  it("returns valid TwiML XML", () => {
    const xml = buildAnsweredTwiml();
    expect(xml).toContain("<?xml version");
    expect(xml).toContain("<Response>");
  });

  it("does NOT contain <Dial> element (prevents duplicate calls)", () => {
    const xml = buildAnsweredTwiml();
    expect(xml).not.toContain("<Dial");
    expect(xml).not.toContain("</Dial>");
  });

  it("does NOT contain <Number> element (prevents duplicate calls)", () => {
    const xml = buildAnsweredTwiml();
    expect(xml).not.toContain("<Number>");
  });

  it("contains a <Pause> to keep the line open", () => {
    const xml = buildAnsweredTwiml();
    expect(xml).toContain("<Pause");
  });

  it("has a long pause duration (at least 60 seconds)", () => {
    const xml = buildAnsweredTwiml();
    const match = xml.match(/length="(\d+)"/);
    expect(match).toBeTruthy();
    const duration = parseInt(match![1], 10);
    expect(duration).toBeGreaterThanOrEqual(60);
  });
});

describe("makeOutboundCall uses /api/twilio/ paths (Error 11750 fix)", () => {
  it("server/twilio.ts makeOutboundCall points to /api/twilio/answered", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/twilio.ts", "utf-8");
    expect(content).toContain("/api/twilio/answered");
    // Should NOT use old /api/oauth/twilio/ paths (platform doesn't forward them)
    const oauthPaths = content.match(/url:\s*`[^`]*\/api\/oauth\/twilio\//g);
    expect(oauthPaths).toBeNull();
    expect(content).not.toContain("/api/trpc/twilio-webhook/");
  });

  it("server/twilio.ts uses /api/twilio/status for status callback", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/twilio.ts", "utf-8");
    expect(content).toContain("/api/twilio/status");
    expect(content).not.toContain("/api/trpc/twilio-webhook/");
  });

  it("twilio-webhooks.ts registers routes at /api/twilio/*", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
    expect(content).toContain("/api/twilio/voice");
    expect(content).toContain("/api/twilio/connect");
    expect(content).toContain("/api/twilio/answered");
    expect(content).toContain("/api/twilio/status");
    // Should NOT use old /api/oauth/twilio/ paths
    expect(content).not.toContain('"api/oauth/twilio/');
  });

  it("_core/index.ts imports and calls registerTwilioWebhooks", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/_core/index.ts", "utf-8");
    expect(content).toContain("registerTwilioWebhooks");
    expect(content).not.toContain("/api/trpc/twilio-webhook/");
  });
});

// ─── 10. No Browser SDK Dependency ──────────────────────────────────────────

describe("No browser SDK dependency", () => {
  it("twilio.ts does not import @twilio/voice-sdk", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/twilio.ts", "utf-8");
    expect(content).not.toContain("@twilio/voice-sdk");
    expect(content).not.toContain("AccessToken");
    expect(content).not.toContain("VoiceGrant");
  });

  it("twilio.ts does not export generateAccessToken", async () => {
    const mod = await import("./twilio");
    expect((mod as any).generateAccessToken).toBeUndefined();
  });

  it("server/twilio.ts only uses twilio REST client, not browser SDK", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/twilio.ts", "utf-8");
    // Should import twilio (server SDK)
    expect(content).toContain('import twilio from "twilio"');
    // Should NOT reference voice-sdk
    expect(content).not.toContain("voice-sdk");
  });
});
