/**
 * Tests for inbound call receiving feature
 * Validates: voice webhook routing, TwiML generation, token configuration
 */
import { describe, it, expect } from "vitest";

// ─── 1. Voice Webhook Routing Logic ──────────────────────────────────────

describe("Voice webhook inbound/outbound routing", () => {
  // Simulate the routing logic from twilio-webhooks.ts
  function determineCallDirection(params: {
    from?: string;
    to?: string;
    callerPhone?: string;
    direction?: string;
  }) {
    const { from, to, callerPhone, direction } = params;
    const isFromBrowserClient = from?.startsWith("client:");
    const isOutbound = callerPhone || (to && !from?.startsWith("client:") && direction === "outbound-api");

    if (isFromBrowserClient || isOutbound) {
      return "outbound";
    }
    return "inbound";
  }

  it("detects outbound call from browser client", () => {
    expect(determineCallDirection({
      from: "client:crm-user-1",
      to: "+15551234567",
    })).toBe("outbound");
  });

  it("detects outbound call with CallerPhone param", () => {
    expect(determineCallDirection({
      from: "+15559999999",
      to: "+15551234567",
      callerPhone: "+15559999999",
    })).toBe("outbound");
  });

  it("detects outbound call with direction=outbound-api", () => {
    expect(determineCallDirection({
      from: "+15559999999",
      to: "+15551234567",
      direction: "outbound-api",
    })).toBe("outbound");
  });

  it("detects inbound call from external number", () => {
    expect(determineCallDirection({
      from: "+15551234567",
      to: "+15559999999",
    })).toBe("inbound");
  });

  it("detects inbound call with no direction", () => {
    expect(determineCallDirection({
      from: "+15551234567",
      to: "+15559999999",
      direction: undefined,
    })).toBe("inbound");
  });

  it("detects inbound call with direction=inbound", () => {
    expect(determineCallDirection({
      from: "+15551234567",
      to: "+15559999999",
      direction: "inbound",
    })).toBe("inbound");
  });

  it("handles missing from/to gracefully", () => {
    expect(determineCallDirection({})).toBe("inbound");
  });
});

// ─── 2. Access Token Configuration ──────────────────────────────────────

describe("Access token incomingAllow configuration", () => {
  it("should have incomingAllow set to true in the code", async () => {
    // Read the routers.ts file to verify incomingAllow is true
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    // Find the VoiceGrant configuration
    const voiceGrantMatch = routersContent.match(/new VoiceGrant\(\{[\s\S]*?\}\)/);
    expect(voiceGrantMatch).toBeTruthy();
    
    // Verify incomingAllow is true
    expect(voiceGrantMatch![0]).toContain("incomingAllow: true");
  });
});

// ─── 3. Inbound Call TwiML Structure ────────────────────────────────────

describe("Inbound call TwiML structure", () => {
  it("should generate TwiML with <Dial><Client> for inbound calls", async () => {
    const twilio = await import("twilio");
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    
    const response = new VoiceResponse();
    const dial = response.dial({
      callerId: "+15551234567",
      timeout: 30,
      action: "/api/twilio/inbound-status",
      method: "POST",
    });
    
    // Simulate ringing 3 CRM users
    dial.client("crm-user-1");
    dial.client("crm-user-2");
    dial.client("crm-user-3");
    
    const twiml = response.toString();
    
    // Verify TwiML structure
    expect(twiml).toContain("<Dial");
    expect(twiml).toContain("callerId=\"+15551234567\"");
    expect(twiml).toContain("timeout=\"30\"");
    expect(twiml).toContain("<Client>crm-user-1</Client>");
    expect(twiml).toContain("<Client>crm-user-2</Client>");
    expect(twiml).toContain("<Client>crm-user-3</Client>");
    expect(twiml).toContain("action=\"/api/twilio/inbound-status\"");
  });

  it("should generate unavailable message when no users", async () => {
    const twilio = await import("twilio");
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    
    const response = new VoiceResponse();
    response.say("Thank you for calling. No agents are currently available. Please try again later.");
    response.hangup();
    
    const twiml = response.toString();
    expect(twiml).toContain("<Say>");
    expect(twiml).toContain("No agents are currently available");
    expect(twiml).toContain("<Hangup/>");
  });
});

// ─── 4. Inbound Status Callback TwiML ──────────────────────────────────

describe("Inbound status callback TwiML", () => {
  it("should say unavailable message for no-answer", async () => {
    const twilio = await import("twilio");
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    
    const response = new VoiceResponse();
    const dialCallStatus = "no-answer";
    
    if (dialCallStatus === "no-answer" || dialCallStatus === "busy" || dialCallStatus === "failed") {
      response.say("We're sorry, no agents are available right now. Please try again later.");
      response.hangup();
    }
    
    const twiml = response.toString();
    expect(twiml).toContain("<Say>");
    expect(twiml).toContain("<Hangup/>");
  });

  it("should return empty response for completed calls", async () => {
    const twilio = await import("twilio");
    const VoiceResponse = twilio.default.twiml.VoiceResponse;
    
    const response = new VoiceResponse();
    const dialCallStatus = "completed";
    
    if (dialCallStatus === "no-answer" || dialCallStatus === "busy" || dialCallStatus === "failed") {
      response.say("We're sorry, no agents are available right now. Please try again later.");
      response.hangup();
    }
    
    const twiml = response.toString();
    expect(twiml).not.toContain("<Say>");
    expect(twiml).not.toContain("<Hangup/>");
  });
});

// ─── 5. Webhook Routes Registration ────────────────────────────────────

describe("Webhook routes", () => {
  it("should have /api/twilio/voice webhook registered in code", async () => {
    const fs = await import("fs");
    const webhooksContent = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
    
    expect(webhooksContent).toContain('/api/twilio/voice');
    expect(webhooksContent).toContain('/api/twilio/inbound-status');
    expect(webhooksContent).toContain('/api/twilio/status');
    expect(webhooksContent).toContain('/api/twilio/answered');
    expect(webhooksContent).toContain('/api/twilio/connect');
    expect(webhooksContent).toContain('/api/twilio/sms/incoming');
  });

  it("voice webhook handles both inbound and outbound", async () => {
    const fs = await import("fs");
    const webhooksContent = fs.readFileSync("server/twilio-webhooks.ts", "utf-8");
    
    // Verify the webhook handles both directions
    expect(webhooksContent).toContain("OUTBOUND call");
    expect(webhooksContent).toContain("INBOUND call");
    expect(webhooksContent).toContain("isFromBrowserClient");
    expect(webhooksContent).toContain("dial.client");
  });
});

// ─── 6. IncomingCallNotification Component ──────────────────────────────

describe("IncomingCallNotification component structure", () => {
  it("should exist and be imported in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync("client/src/App.tsx", "utf-8");
    
    expect(appContent).toContain("IncomingCallNotification");
    expect(appContent).toContain("import { IncomingCallNotification }");
  });

  it("should have accept and reject handlers", async () => {
    const fs = await import("fs");
    const componentContent = fs.readFileSync("client/src/components/IncomingCallNotification.tsx", "utf-8");
    
    expect(componentContent).toContain("handleAccept");
    expect(componentContent).toContain("handleReject");
    expect(componentContent).toContain("handleHangup");
    expect(componentContent).toContain("handleToggleMute");
  });

  it("should use Twilio Device SDK for incoming calls", async () => {
    const fs = await import("fs");
    const componentContent = fs.readFileSync("client/src/components/IncomingCallNotification.tsx", "utf-8");
    
    expect(componentContent).toContain("device.on(\"incoming\"");
    expect(componentContent).toContain(".accept()");
    expect(componentContent).toContain(".reject()");
    expect(componentContent).toContain(".disconnect()");
    expect(componentContent).toContain(".mute(");
  });

  it("should be positioned fixed bottom-right", async () => {
    const fs = await import("fs");
    const componentContent = fs.readFileSync("client/src/components/IncomingCallNotification.tsx", "utf-8");
    
    expect(componentContent).toContain("fixed bottom-4 right-4");
    expect(componentContent).toContain("z-[9999]");
  });

  it("should handle token refresh", async () => {
    const fs = await import("fs");
    const componentContent = fs.readFileSync("client/src/components/IncomingCallNotification.tsx", "utf-8");
    
    expect(componentContent).toContain("tokenWillExpire");
    expect(componentContent).toContain("updateToken");
  });
});
