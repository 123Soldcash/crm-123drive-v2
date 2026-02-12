import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { formatPhoneNumber, generateAccessToken } from "./twilio";
import { createCallLog, updateCallLog, getPropertyCallLogs, getContactCallLogs } from "./db-call-logs";
import twilio from "twilio";

describe("Twilio Integration", () => {
  describe("Phone Number Formatting", () => {
    it("should format 10-digit number to E.164 format", () => {
      const result = formatPhoneNumber("5551234567");
      expect(result).toBe("+15551234567");
    });

    it("should format 11-digit number starting with 1", () => {
      const result = formatPhoneNumber("15551234567");
      expect(result).toBe("+15551234567");
    });

    it("should handle number with dashes", () => {
      const result = formatPhoneNumber("555-123-4567");
      expect(result).toBe("+15551234567");
    });

    it("should handle number with parentheses", () => {
      const result = formatPhoneNumber("(555) 123-4567");
      expect(result).toBe("+15551234567");
    });

    it("should handle number with spaces", () => {
      const result = formatPhoneNumber("555 123 4567");
      expect(result).toBe("+15551234567");
    });

    it("should preserve already formatted number", () => {
      const result = formatPhoneNumber("+15551234567");
      expect(result).toBe("+15551234567");
    });

    it("should handle international format", () => {
      const result = formatPhoneNumber("+441632960000");
      expect(result).toBe("+441632960000");
    });
  });

  describe("Access Token Generation", () => {
    it("should generate valid JWT token", () => {
      const token = generateAccessToken("test_user_123");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // Valid JWT has 3 parts
    });

    it("should generate different tokens for different identities", () => {
      const token1 = generateAccessToken("user_1");
      const token2 = generateAccessToken("user_2");
      expect(token1).not.toBe(token2);
    });

    it("should generate token with correct structure", () => {
      const token = generateAccessToken("test_user");
      const parts = token.split(".");
      expect(parts.length).toBe(3);
      
      // Decode header
      const header = JSON.parse(Buffer.from(parts[0], "base64").toString());
      expect(header.typ).toBe("JWT");
      expect(header.alg).toBe("HS256");
    });
  });

  describe("Call Logs Database", () => {
    let callLogId: number;

    it("should create a new call log", async () => {
      const result = await createCallLog({
        propertyId: 1,
        contactId: 1,
        userId: 1,
        toPhoneNumber: "+15551234567",
        fromPhoneNumber: "+19542313176",
        callType: "outbound",
        status: "ringing",
        notes: "Test call",
        startedAt: new Date(),
      });

      expect(result.insertId).toBeGreaterThan(0);
      callLogId = result.insertId;
    });

    it("should update call log with end time", async () => {
      if (!callLogId) {
        throw new Error("Call log ID not set from previous test");
      }

      const endTime = new Date();
      const result = await updateCallLog(callLogId, {
        status: "completed",
        duration: 300,
        endedAt: endTime,
      });

      expect(result.rowsAffected).toBeGreaterThan(0);
    });

    it("should retrieve property call logs", async () => {
      const logs = await getPropertyCallLogs(1, 10);
      expect(Array.isArray(logs)).toBe(true);
      if (logs.length > 0) {
        expect(logs[0].propertyId).toBe(1);
      }
    });

    it("should retrieve contact call logs", async () => {
      const logs = await getContactCallLogs(1, 10);
      expect(Array.isArray(logs)).toBe(true);
      if (logs.length > 0) {
        expect(logs[0].contactId).toBe(1);
      }
    });

    it("should create failed call log with error message", async () => {
      const result = await createCallLog({
        propertyId: 2,
        contactId: 2,
        userId: 1,
        toPhoneNumber: "+15559876543",
        fromPhoneNumber: "+19542313176",
        callType: "outbound",
        status: "failed",
        errorMessage: "Invalid phone number",
        notes: "Failed call test",
        startedAt: new Date(),
        endedAt: new Date(),
      });

      expect(result.insertId).toBeGreaterThan(0);
    });
  });

  describe("Twilio Client", () => {
    it("should create valid Twilio client", () => {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );
      expect(client).toBeDefined();
    });

    it("should fetch account details", async () => {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      const account = await client.api
        .accounts(process.env.TWILIO_ACCOUNT_SID!)
        .fetch();

      expect(account.sid).toBe(process.env.TWILIO_ACCOUNT_SID);
      expect(account.status).toBe("active");
    });
  });

  describe("Call Log Fields", () => {
    it("should support all call log fields", async () => {
      const result = await createCallLog({
        propertyId: 3,
        contactId: 3,
        userId: 1,
        toPhoneNumber: "+15551111111",
        fromPhoneNumber: "+19542313176",
        callType: "outbound",
        status: "in-progress",
        twilioCallSid: "CA1234567890abcdef1234567890abcdef",
        notes: "Testing all fields",
        recordingUrl: "https://example.com/recording.mp3",
        startedAt: new Date(),
      });

      expect(result.insertId).toBeGreaterThan(0);

      // Update with additional fields
      await updateCallLog(result.insertId, {
        status: "completed",
        duration: 450,
        endedAt: new Date(),
        recordingUrl: "https://example.com/recording-final.mp3",
      });
    });
  });
});
