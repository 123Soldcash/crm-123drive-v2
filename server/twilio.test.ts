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
});
