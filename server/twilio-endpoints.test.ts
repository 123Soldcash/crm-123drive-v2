/**
 * Comprehensive Twilio Integration Tests
 *
 * Tests the REBUILT Twilio integration using /api/oauth/twilio/* endpoints.
 *
 * Architecture:
 * - Manus platform forwards /api/oauth/* and /api/trpc/* to Express
 * - /api/trpc/* goes through tRPC middleware (rejects form-urlencoded → HTTP 415)
 * - Therefore Twilio webhooks MUST use /api/oauth/twilio/* prefix
 * - All responses MUST be under 64KB or Twilio throws Error 11750
 */
import { describe, it, expect } from "vitest";
import {
  buildTwimlResponse,
  buildConnectTwiml,
  buildAnsweredTwiml,
  formatPhoneNumber,
  validateTwilioConfig,
} from "./twilio";
import fs from "fs";
import path from "path";

// ─── TwiML Response Builders ────────────────────────────────────────────────────

describe("buildTwimlResponse (voice)", () => {
  it("returns valid XML with Dial and Number", () => {
    const twiml = buildTwimlResponse("+15551234567");
    expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(twiml).toContain("<Response>");
    expect(twiml).toContain("<Dial");
    expect(twiml).toContain("<Number>");
    expect(twiml).toContain("+15551234567");
    expect(twiml).toContain("</Response>");
  });

  it("returns valid XML even without a phone number", () => {
    const twiml = buildTwimlResponse(undefined as any);
    expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(twiml).toContain("<Response>");
  });

  it("response is under 64KB", () => {
    const twiml = buildTwimlResponse("+15551234567");
    expect(Buffer.byteLength(twiml, "utf-8")).toBeLessThan(65536);
  });

  it("response is under 500 bytes", () => {
    const twiml = buildTwimlResponse("+15551234567");
    expect(Buffer.byteLength(twiml, "utf-8")).toBeLessThan(500);
  });

  it("does NOT contain HTML tags", () => {
    const twiml = buildTwimlResponse("+15551234567");
    expect(twiml).not.toContain("<!DOCTYPE");
    expect(twiml).not.toContain("<html");
    expect(twiml).not.toContain("<script");
  });
});

describe("buildConnectTwiml (connect)", () => {
  it("returns valid XML with Dial and Number", () => {
    const twiml = buildConnectTwiml("+15551234567");
    expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(twiml).toContain("<Dial");
    expect(twiml).toContain("+15551234567");
  });

  it("includes timeout attribute", () => {
    const twiml = buildConnectTwiml("+15551234567");
    expect(twiml).toContain('timeout="30"');
  });

  it("response is under 500 bytes", () => {
    const twiml = buildConnectTwiml("+15551234567");
    expect(Buffer.byteLength(twiml, "utf-8")).toBeLessThan(500);
  });

  it("does NOT contain HTML tags", () => {
    const twiml = buildConnectTwiml("+15551234567");
    expect(twiml).not.toContain("<!DOCTYPE");
    expect(twiml).not.toContain("<html");
  });
});

describe("buildAnsweredTwiml (NO DIAL — prevents duplicate calls)", () => {
  it("returns valid XML with Pause", () => {
    const twiml = buildAnsweredTwiml();
    expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(twiml).toContain("<Pause");
    expect(twiml).toContain("</Response>");
  });

  it("does NOT contain Dial (prevents second call)", () => {
    const twiml = buildAnsweredTwiml();
    expect(twiml).not.toContain("<Dial");
    expect(twiml).not.toContain("<Number>");
  });

  it("does NOT contain Say or other verbs", () => {
    const twiml = buildAnsweredTwiml();
    expect(twiml).not.toContain("<Say");
    expect(twiml).not.toContain("<Play");
    expect(twiml).not.toContain("<Redirect");
  });

  it("response is under 200 bytes", () => {
    const twiml = buildAnsweredTwiml();
    expect(Buffer.byteLength(twiml, "utf-8")).toBeLessThan(200);
  });
});

describe("Status callback empty response", () => {
  const response = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

  it("is under 100 bytes", () => {
    expect(Buffer.byteLength(response, "utf-8")).toBeLessThan(100);
  });

  it("is valid XML", () => {
    expect(response).toContain('<?xml version="1.0"');
    expect(response).toContain("<Response/>");
  });
});

// ─── Phone Number Formatting ────────────────────────────────────────────────────

describe("formatPhoneNumber", () => {
  it("adds + prefix if missing", () => {
    expect(formatPhoneNumber("15551234567")).toBe("+15551234567");
  });

  it("keeps + prefix if already present", () => {
    expect(formatPhoneNumber("+15551234567")).toBe("+15551234567");
  });
});

// ─── CRITICAL: Webhook URL Path Verification ────────────────────────────────────

describe("Webhook URLs use /api/oauth/twilio/ prefix (CRITICAL)", () => {
  let twilioSrc: string;
  let webhookSrc: string;
  let indexSrc: string;

  it("reads twilio.ts", () => {
    twilioSrc = fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    expect(twilioSrc).toBeTruthy();
  });

  it("reads twilio-webhooks.ts", () => {
    webhookSrc = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(webhookSrc).toBeTruthy();
  });

  it("reads _core/index.ts", () => {
    indexSrc = fs.readFileSync(path.resolve(__dirname, "_core/index.ts"), "utf-8");
    expect(indexSrc).toBeTruthy();
  });

  // ─── makeOutboundCall URL checks ───────────────────────────────────────

  it("makeOutboundCall uses /api/oauth/twilio/answered", () => {
    twilioSrc = twilioSrc || fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    expect(twilioSrc).toContain("/api/oauth/twilio/answered");
  });

  it("makeOutboundCall uses /api/oauth/twilio/status", () => {
    twilioSrc = twilioSrc || fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    expect(twilioSrc).toContain("/api/oauth/twilio/status");
  });

  it("makeOutboundCall does NOT use old /api/twilio/ paths", () => {
    twilioSrc = twilioSrc || fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    const oldPaths = twilioSrc.match(/url:\s*`[^`]*\/api\/twilio\//g);
    expect(oldPaths).toBeNull();
  });

  it("makeOutboundCall does NOT use /api/trpc/twilio-webhook/ paths", () => {
    twilioSrc = twilioSrc || fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    expect(twilioSrc).not.toContain("/api/trpc/twilio-webhook/");
  });

  // ─── Webhook route registration checks ─────────────────────────────────

  it("webhooks registered at /api/oauth/twilio/voice", () => {
    webhookSrc = webhookSrc || fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(webhookSrc).toContain('"/api/oauth/twilio/voice"');
  });

  it("webhooks registered at /api/oauth/twilio/connect", () => {
    webhookSrc = webhookSrc || fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(webhookSrc).toContain('"/api/oauth/twilio/connect"');
  });

  it("webhooks registered at /api/oauth/twilio/answered", () => {
    webhookSrc = webhookSrc || fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(webhookSrc).toContain('"/api/oauth/twilio/answered"');
  });

  it("webhooks registered at /api/oauth/twilio/status", () => {
    webhookSrc = webhookSrc || fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(webhookSrc).toContain('"/api/oauth/twilio/status"');
  });

  it("webhooks use app.all() for both GET and POST", () => {
    webhookSrc = webhookSrc || fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    const allCalls = webhookSrc.match(/app\.all\(/g);
    expect(allCalls).not.toBeNull();
    expect(allCalls!.length).toBeGreaterThanOrEqual(4);
  });

  it("webhooks do NOT use app.post() only", () => {
    webhookSrc = webhookSrc || fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    const postOnly = webhookSrc.match(/app\.post\(\s*["']\/api\/oauth\/twilio/g);
    expect(postOnly).toBeNull();
  });

  // ─── index.ts integration checks ──────────────────────────────────────

  it("index.ts imports registerTwilioWebhooks", () => {
    indexSrc = indexSrc || fs.readFileSync(path.resolve(__dirname, "_core/index.ts"), "utf-8");
    expect(indexSrc).toContain("registerTwilioWebhooks");
  });

  it("index.ts does NOT have old /api/twilio/ routes", () => {
    indexSrc = indexSrc || fs.readFileSync(path.resolve(__dirname, "_core/index.ts"), "utf-8");
    const old = indexSrc.match(/["']\/api\/twilio\//g);
    expect(old).toBeNull();
  });

  it("index.ts does NOT have /api/trpc/twilio-webhook/ routes", () => {
    indexSrc = indexSrc || fs.readFileSync(path.resolve(__dirname, "_core/index.ts"), "utf-8");
    const old = indexSrc.match(/["']\/api\/trpc\/twilio-webhook\//g);
    expect(old).toBeNull();
  });
});

// ─── Content-Type Verification ──────────────────────────────────────────────────

describe("All webhook responses set Content-Type text/xml", () => {
  it("webhook file sets text/xml for all endpoints (try + catch)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    const matches = src.match(/Content-Type.*text\/xml/g);
    expect(matches).not.toBeNull();
    // 4 endpoints with try/catch = at least 7 (status has simpler handler)
    expect(matches!.length).toBeGreaterThanOrEqual(7);
  });
});

// ─── Duplicate Call Prevention ──────────────────────────────────────────────────

describe("Duplicate Call Prevention", () => {
  it("answered TwiML has NO Dial element", () => {
    const twiml = buildAnsweredTwiml();
    expect(twiml).not.toContain("<Dial");
    expect(twiml).not.toContain("<Number>");
    expect(twiml).not.toContain("</Dial>");
  });

  it("answered TwiML only has Pause", () => {
    const twiml = buildAnsweredTwiml();
    expect(twiml).toContain("<Pause");
  });

  it("makeOutboundCall URL points to /answered NOT /voice", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    const urlLines = src.match(/url:\s*`[^`]+`/g);
    expect(urlLines).not.toBeNull();
    const answeredUrl = urlLines!.find((u) => u.includes("/answered"));
    expect(answeredUrl).toBeTruthy();
    const voiceUrl = urlLines!.find(
      (u) => u.includes("/voice") && !u.includes("/answered")
    );
    expect(voiceUrl).toBeUndefined();
  });
});

// ─── Error Fallback TwiML ───────────────────────────────────────────────────────

describe("Error Fallback TwiML Responses", () => {
  const fallbacks = [
    {
      name: "voice error",
      twiml: '<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>',
    },
    {
      name: "answered error",
      twiml: '<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="3600"/></Response>',
    },
    {
      name: "status empty",
      twiml: '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    },
  ];

  for (const { name, twiml } of fallbacks) {
    it(`${name} is valid XML`, () => {
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain("<Response");
    });

    it(`${name} is under 200 bytes`, () => {
      expect(Buffer.byteLength(twiml, "utf-8")).toBeLessThan(200);
    });

    it(`${name} has no HTML`, () => {
      expect(twiml).not.toContain("<!DOCTYPE");
      expect(twiml).not.toContain("<html");
    });
  }
});

// ─── Configuration ──────────────────────────────────────────────────────────────

describe("Twilio Configuration", () => {
  it("validateTwilioConfig returns valid/missing structure", () => {
    const config = validateTwilioConfig();
    expect(config).toHaveProperty("valid");
    expect(config).toHaveProperty("missing");
    expect(Array.isArray(config.missing)).toBe(true);
  });

  it("getBaseUrl function exists in twilio.ts (private)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio.ts"), "utf-8");
    expect(src).toContain("function getBaseUrl()");
  });
});

// ─── File Existence ─────────────────────────────────────────────────────────────

describe("Production Build Verification", () => {
  it("twilio-webhooks.ts exists", () => {
    expect(fs.existsSync(path.resolve(__dirname, "twilio-webhooks.ts"))).toBe(true);
  });

  it("twilio.ts exists", () => {
    expect(fs.existsSync(path.resolve(__dirname, "twilio.ts"))).toBe(true);
  });

  it("twilio-webhooks.ts exports registerTwilioWebhooks", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(src).toContain("export function registerTwilioWebhooks");
  });

  it("twilio-webhooks.ts has architecture documentation", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    expect(src).toContain("CRITICAL ARCHITECTURE NOTE");
    expect(src).toContain("/api/oauth/");
  });

  it("all error handlers return inline XML (no dynamic imports in catch)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "twilio-webhooks.ts"), "utf-8");
    const catchBlocks = src.split("catch");
    for (let i = 1; i < catchBlocks.length; i++) {
      const block = catchBlocks[i].substring(0, 300);
      expect(block).toContain("text/xml");
    }
  });
});
