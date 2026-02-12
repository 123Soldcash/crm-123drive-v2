import { describe, it, expect } from "vitest";
import twilio from "twilio";

describe("Twilio Credentials Validation", () => {
  it("should validate Twilio credentials are set", () => {
    expect(process.env.TWILIO_ACCOUNT_SID).toBeDefined();
    expect(process.env.TWILIO_AUTH_TOKEN).toBeDefined();
    expect(process.env.TWILIO_PHONE_NUMBER).toBeDefined();
    expect(process.env.TWILIO_API_KEY).toBeDefined();
    expect(process.env.TWILIO_API_SECRET).toBeDefined();
  });

  it("should create a valid Twilio client with credentials", () => {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    expect(client).toBeDefined();
  });

  it("should validate phone number format", () => {
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    expect(phoneNumber).toMatch(/^\+\d{10,15}$/);
  });

  it("should generate valid access token with API credentials", () => {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      { identity: "test_user", ttl: 3600 }
    );

    const voiceGrant = new VoiceGrant({
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);
    const jwt = token.toJwt();

    expect(jwt).toBeDefined();
    expect(typeof jwt).toBe("string");
    expect(jwt.split(".").length).toBe(3); // Valid JWT has 3 parts
  });

  it("should be able to list Twilio account details", async () => {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
    expect(account.sid).toBe(process.env.TWILIO_ACCOUNT_SID);
  });
});
