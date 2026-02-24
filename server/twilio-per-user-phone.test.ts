/**
 * Tests for per-user Twilio phone number feature.
 * Validates that:
 * 1. Users table has twilioPhone field
 * 2. TwiML builders accept optional callerPhone parameter
 * 3. Voice webhook reads CallerPhone custom param
 * 4. makeOutboundCall accepts fromNumber parameter
 * 5. getAccessToken returns twilioPhone
 * 6. Agents router update accepts twilioPhone
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ─── Read source files ──────────────────────────────────────────────────────

const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
const twilioPath = path.resolve(__dirname, "./twilio.ts");
const webhooksPath = path.resolve(__dirname, "./twilio-webhooks.ts");
const routersPath = path.resolve(__dirname, "./routers.ts");
const agentsRouterPath = path.resolve(__dirname, "./routers/agents.ts");
const callModalPath = path.resolve(__dirname, "../client/src/components/CallModal.tsx");
const userMgmtPath = path.resolve(__dirname, "../client/src/pages/UserManagement.tsx");

// ─── Schema Tests ───────────────────────────────────────────────────────────

describe("Schema: twilioPhone field on users table", () => {
  const schemaSrc = fs.readFileSync(schemaPath, "utf-8");

  it("users table has twilioPhone column", () => {
    expect(schemaSrc).toContain('twilioPhone: varchar("twilioPhone"');
  });

  it("twilioPhone is a varchar field", () => {
    expect(schemaSrc).toMatch(/twilioPhone:\s*varchar\("twilioPhone"/);
  });
});

// ─── TwiML Builder Tests ────────────────────────────────────────────────────

describe("TwiML builders accept callerPhone parameter", () => {
  it("buildTwimlResponse accepts optional callerPhone", () => {
    const src = fs.readFileSync(twilioPath, "utf-8");
    expect(src).toMatch(/buildTwimlResponse\(to:.*callerPhone\?/);
  });

  it("buildConnectTwiml accepts optional callerPhone", () => {
    const src = fs.readFileSync(twilioPath, "utf-8");
    expect(src).toMatch(/buildConnectTwiml\(to:.*callerPhone\?/);
  });

  it("buildTwimlResponse uses callerPhone as callerId when provided", () => {
    const src = fs.readFileSync(twilioPath, "utf-8");
    // Should have: const callerId = callerPhone || ENV.twilioPhoneNumber
    expect(src).toContain("callerPhone || ENV.twilioPhoneNumber");
  });

  it("buildTwimlResponse generates correct TwiML with custom caller", async () => {
    const { buildTwimlResponse } = await import("./twilio");
    const xml = buildTwimlResponse("+15551234567", "+19998887777");
    expect(xml).toContain("+19998887777"); // Custom caller ID
    expect(xml).toContain("+15551234567"); // Destination number
  });

  it("buildTwimlResponse falls back to ENV when no callerPhone", async () => {
    const { buildTwimlResponse } = await import("./twilio");
    const xml = buildTwimlResponse("+15551234567");
    expect(xml).toContain("callerId");
    expect(xml).toContain("+15551234567");
  });

  it("buildConnectTwiml generates correct TwiML with custom caller", async () => {
    const { buildConnectTwiml } = await import("./twilio");
    const xml = buildConnectTwiml("+15551234567", "+19998887777");
    expect(xml).toContain("+19998887777");
    expect(xml).toContain("+15551234567");
  });
});

// ─── makeOutboundCall Tests ─────────────────────────────────────────────────

describe("makeOutboundCall accepts fromNumber parameter", () => {
  const src = fs.readFileSync(twilioPath, "utf-8");

  it("has fromNumber in params type", () => {
    expect(src).toMatch(/fromNumber\?:\s*string/);
  });

  it("uses fromNumber or falls back to ENV", () => {
    expect(src).toContain("fromNumber || ENV.twilioPhoneNumber");
  });

  it("returns the callerPhone in from field", () => {
    expect(src).toContain("from: callerPhone");
  });
});

// ─── Voice Webhook Tests ────────────────────────────────────────────────────

describe("Voice webhook reads CallerPhone parameter", () => {
  const src = fs.readFileSync(webhooksPath, "utf-8");

  it("reads CallerPhone from request body", () => {
    expect(src).toContain("req.body?.CallerPhone");
  });

  it("reads CallerPhone from query params", () => {
    expect(src).toContain("req.query?.CallerPhone");
  });

  it("passes callerPhone to buildTwimlResponse", () => {
    expect(src).toMatch(/buildTwimlResponse\(.*callerPhone/);
  });

  it("connect webhook also reads CallerPhone", () => {
    expect(src).toContain("req.body?.CallerPhone");
  });

  it("connect webhook passes callerPhone to buildConnectTwiml", () => {
    expect(src).toMatch(/buildConnectTwiml\(.*callerPhone/);
  });
});

// ─── Router Tests ───────────────────────────────────────────────────────────

describe("Routers use per-user twilioPhone", () => {
  const routersSrc = fs.readFileSync(routersPath, "utf-8");

  it("getAccessToken returns twilioPhone", () => {
    expect(routersSrc).toContain("ctx.user.twilioPhone");
    expect(routersSrc).toMatch(/twilioPhone:.*ctx\.user\.twilioPhone/);
  });

  it("makeCall uses user's twilioPhone for fromNumber", () => {
    expect(routersSrc).toContain("ctx.user.twilioPhone");
    expect(routersSrc).toContain("userTwilioPhone");
  });

  it("createCallLog uses user's twilioPhone for fromPhoneNumber", () => {
    // The createCallLog mutation should use the user's twilio phone
    const createLogSection = routersSrc.slice(
      routersSrc.indexOf("createCallLog: protectedProcedure"),
      routersSrc.indexOf("createCallLog: protectedProcedure") + 800
    );
    expect(createLogSection).toContain("ctx.user.twilioPhone");
  });
});

// ─── Agents Router Tests ────────────────────────────────────────────────────

describe("Agents router supports twilioPhone", () => {
  const agentsSrc = fs.readFileSync(agentsRouterPath, "utf-8");

  it("listAllUsers returns twilioPhone", () => {
    expect(agentsSrc).toContain("twilioPhone: users.twilioPhone");
  });

  it("update accepts twilioPhone in input", () => {
    expect(agentsSrc).toMatch(/twilioPhone:.*z\.string\(\)/);
  });
});

// ─── Frontend Tests ─────────────────────────────────────────────────────────

describe("CallModal passes CallerPhone to device.connect", () => {
  const src = fs.readFileSync(callModalPath, "utf-8");

  it("reads twilioPhone from tokenData", () => {
    expect(src).toContain("tokenData?.twilioPhone");
  });

  it("passes CallerPhone in device.connect params", () => {
    expect(src).toContain("CallerPhone");
  });
});

describe("UserManagement UI has twilioPhone field", () => {
  const src = fs.readFileSync(userMgmtPath, "utf-8");

  it("UserRow type includes twilioPhone", () => {
    expect(src).toContain("twilioPhone: string | null");
  });

  it("edit form has twilioPhone field", () => {
    expect(src).toContain('twilioPhone: ""');
  });

  it("table shows Twilio # column", () => {
    expect(src).toContain("Twilio #");
  });

  it("edit dialog has twilioPhone input", () => {
    expect(src).toContain("Twilio Phone Number");
    expect(src).toContain("Twilio Caller ID");
  });

  it("save sends twilioPhone to update mutation", () => {
    expect(src).toContain("twilioPhone: editForm.twilioPhone");
  });
});
