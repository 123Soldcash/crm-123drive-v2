/**
 * Call Flow Architecture Tests
 *
 * Validates that the CRM uses the correct Twilio Device SDK call flow:
 * 1. Browser gets Access Token → device.connect() → Twilio calls Voice URL
 * 2. Voice URL returns TwiML with <Dial><Number> to connect the call
 * 3. Call logs are created via createCallLog mutation (DB only, no REST API call)
 * 4. The REST API makeOutboundCall is NOT used by the CallModal
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Read source files ──────────────────────────────────────────────────────

const callModalPath = path.resolve(__dirname, "../client/src/components/CallModal.tsx");
const routersPath = path.resolve(__dirname, "./routers.ts");
const twilioPath = path.resolve(__dirname, "./twilio.ts");
const webhooksPath = path.resolve(__dirname, "./twilio-webhooks.ts");
const dbCallNotesPath = path.resolve(__dirname, "./db-callNotes.ts");

const callModalSrc = fs.readFileSync(callModalPath, "utf-8");
const routersSrc = fs.readFileSync(routersPath, "utf-8");
const twilioSrc = fs.readFileSync(twilioPath, "utf-8");
const webhooksSrc = fs.readFileSync(webhooksPath, "utf-8");
const dbCallNotesSrc = fs.readFileSync(dbCallNotesPath, "utf-8");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CALL MODAL — DEVICE SDK ONLY (NO REST API CALLS)
// ═══════════════════════════════════════════════════════════════════════════════

describe("CallModal: Device SDK-only call flow", () => {
  it("uses Twilio Device SDK for browser calling", () => {
    expect(callModalSrc).toContain('import { Device, Call } from "@twilio/voice-sdk"');
  });

  it("connects via device.connect() with params including To number", () => {
    expect(callModalSrc).toContain("deviceRef.current.connect");
    expect(callModalSrc).toContain("To: phoneNumber");
  });

  it("uses createCallLogMutation (DB only) instead of makeCallMutation (REST API)", () => {
    expect(callModalSrc).toContain("createCallLogMutation");
    // Should NOT use makeCallMutation which triggers a REST API outbound call
    expect(callModalSrc).not.toContain("makeCallMutation");
  });

  it("creates call log BEFORE connecting the Device SDK call", () => {
    const createLogIndex = callModalSrc.indexOf("createCallLogMutation.mutateAsync");
    const connectIndex = callModalSrc.indexOf("deviceRef.current.connect");
    expect(createLogIndex).toBeGreaterThan(-1);
    expect(connectIndex).toBeGreaterThan(-1);
    expect(createLogIndex).toBeLessThan(connectIndex);
  });

  it("uses a ref to track callLogId across async callbacks", () => {
    expect(callModalSrc).toContain("callLogIdRef");
    expect(callModalSrc).toContain("callLogIdRef.current");
  });

  it("has DialogTitle for accessibility", () => {
    expect(callModalSrc).toContain("DialogTitle");
    expect(callModalSrc).toContain("sr-only");
  });

  it("handles all call events: accept, ringing, disconnect, cancel, error", () => {
    expect(callModalSrc).toContain('"accept"');
    expect(callModalSrc).toContain('"ringing"');
    expect(callModalSrc).toContain('"disconnect"');
    expect(callModalSrc).toContain('"cancel"');
    expect(callModalSrc).toContain('"error"');
  });

  it("updates call log on disconnect with duration", () => {
    expect(callModalSrc).toContain('status: "completed"');
    expect(callModalSrc).toContain("duration");
  });

  it("shows token error warning when Twilio is not configured", () => {
    expect(callModalSrc).toContain("tokenError");
    expect(callModalSrc).toContain("Twilio not configured");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ROUTER — createCallLog MUTATION (DB ONLY)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Router: createCallLog mutation", () => {
  it("has a createCallLog mutation in the twilio router", () => {
    expect(routersSrc).toContain("createCallLog: protectedProcedure");
  });

  it("createCallLog accepts to, contactId, propertyId, status", () => {
    // Find the createCallLog section
    const startIdx = routersSrc.indexOf("createCallLog: protectedProcedure");
    const endIdx = routersSrc.indexOf("}),", startIdx + 100);
    const section = routersSrc.slice(startIdx, endIdx);
    expect(section).toContain("to: z.string()");
    expect(section).toContain("contactId: z.number()");
    expect(section).toContain("propertyId: z.number()");
  });

  it("createCallLog imports from db-callNotes (not twilio)", () => {
    const startIdx = routersSrc.indexOf("createCallLog: protectedProcedure");
    const endIdx = routersSrc.indexOf("}),", startIdx + 100);
    const section = routersSrc.slice(startIdx, endIdx);
    expect(section).toContain("db-callNotes");
    // Should NOT import makeOutboundCall
    expect(section).not.toContain("makeOutboundCall");
  });

  it("still has makeCall mutation for backward compatibility", () => {
    expect(routersSrc).toContain("makeCall: protectedProcedure");
  });

  it("has getAccessToken procedure for Device SDK tokens", () => {
    expect(routersSrc).toContain("getAccessToken: protectedProcedure");
    expect(routersSrc).toContain("AccessToken");
    expect(routersSrc).toContain("VoiceGrant");
    expect(routersSrc).toContain("outgoingApplicationSid");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. VOICE WEBHOOK — HANDLES DEVICE SDK PARAMS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Voice Webhook: handles Device SDK parameters", () => {
  it("reads To parameter from request body (form-urlencoded from Twilio)", () => {
    expect(webhooksSrc).toContain("req.body?.To");
  });

  it("formats phone number to E.164 before building TwiML", () => {
    expect(webhooksSrc).toContain("formatPhoneNumber");
  });

  it("logs incoming request details for debugging", () => {
    expect(webhooksSrc).toContain("Body keys:");
    expect(webhooksSrc).toContain("CallSid");
  });

  it("returns TwiML with Dial and Number for phone numbers", () => {
    expect(twilioSrc).toContain("dial.number(to)");
  });

  it("returns TwiML with Dial and Client for client identities", () => {
    expect(twilioSrc).toContain("dial.client(to)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DB-CALLNOTES — PROPER ASYNC/AWAIT
// ═══════════════════════════════════════════════════════════════════════════════

describe("db-callNotes: proper async/await and null checks", () => {
  it("all functions use await getDb()", () => {
    const matches = dbCallNotesSrc.match(/const db = await getDb\(\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(7);
  });

  it("all functions have null checks after getDb()", () => {
    const nullChecks = dbCallNotesSrc.match(/if \(!db\) throw new Error/g);
    expect(nullChecks).not.toBeNull();
    expect(nullChecks!.length).toBeGreaterThanOrEqual(7);
  });

  it("does NOT have getDb() without await", () => {
    // Should not have "const db = getDb()" without await
    const badPattern = /const db = getDb\(\)/g;
    const matches = dbCallNotesSrc.match(badPattern);
    expect(matches).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ACCESS TOKEN — PROPER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Access Token: proper Twilio Voice SDK configuration", () => {
  it("uses TWILIO_API_KEY and TWILIO_API_SECRET (not AUTH_TOKEN) for tokens", () => {
    // Access tokens must use API Key/Secret, not Account SID/Auth Token
    expect(routersSrc).toContain("twilioApiKey");
    expect(routersSrc).toContain("twilioApiSecret");
  });

  it("includes TwiML App SID in the VoiceGrant", () => {
    expect(routersSrc).toContain("twilioTwimlAppSid");
    expect(routersSrc).toContain("outgoingApplicationSid");
  });

  it("sets a user identity on the token", () => {
    expect(routersSrc).toContain("identity");
    expect(routersSrc).toContain("crm-user-");
  });

  it("sets TTL on the token", () => {
    expect(routersSrc).toContain("ttl:");
  });
});
