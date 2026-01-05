import { describe, expect, it } from "vitest";

describe("Twilio Configuration", () => {
  it("should have TWILIO_ACCOUNT_SID configured", () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    expect(accountSid).toBeDefined();
    expect(accountSid).toMatch(/^AC/);
  });

  it("should have TWILIO_AUTH_TOKEN configured", () => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    expect(authToken).toBeDefined();
    expect(authToken!.length).toBeGreaterThan(10);
  });

  it("should have TWILIO_PHONE_NUMBER configured", () => {
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    expect(phoneNumber).toBeDefined();
    expect(phoneNumber).toMatch(/^\+\d+$/);
  });

  it("should have TWILIO_TWIML_APP_SID configured", () => {
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
    expect(twimlAppSid).toBeDefined();
    expect(twimlAppSid).toMatch(/^AP/);
  });

  it("should have TWILIO_API_KEY configured", () => {
    const apiKey = process.env.TWILIO_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^SK/);
  });

  it("should have TWILIO_API_SECRET configured", () => {
    const apiSecret = process.env.TWILIO_API_SECRET;
    expect(apiSecret).toBeDefined();
    expect(apiSecret!.length).toBeGreaterThan(10);
  });

  it("should be able to initialize Twilio client", async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not configured");
    }

    // Import twilio dynamically to test initialization
    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);
    
    // Verify account by fetching account info
    const account = await client.api.accounts(accountSid).fetch();
    expect(account.sid).toBe(accountSid);
    expect(account.status).toBe("active");
  });

  it("should generate a valid Access Token with API Key credentials", async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const apiKey = process.env.TWILIO_API_KEY!;
    const apiSecret = process.env.TWILIO_API_SECRET!;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!;

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      throw new Error("Twilio API Key credentials not configured");
    }

    // Import twilio dynamically
    const twilio = await import("twilio");
    const { AccessToken } = twilio.default.jwt;
    const { VoiceGrant } = AccessToken;

    // Create an access token
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: 'test-user',
      ttl: 3600,
    });

    // Create a Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    // Generate the token
    const jwt = token.toJwt();

    // Verify token is generated (JWT format: header.payload.signature)
    expect(jwt).toBeDefined();
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.').length).toBe(3);
    
    console.log('✅ Access Token generated successfully');
  });
});
