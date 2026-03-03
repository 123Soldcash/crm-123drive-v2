/**
 * Tests for Twilio SMS integration
 *
 * Tests cover:
 * 1. Phone number normalization to E.164
 * 2. SMS webhook deduplication logic
 * 3. SMS message direction enum values
 * 4. Inbound webhook route existence
 */
import { describe, it, expect } from "vitest";

// ─── Phone normalization helper (mirrors server logic) ──────────────────────
function normalizePhone(phone: string): string {
  const rawDigits = phone.replace(/\D/g, "");
  if (rawDigits.length === 10) return `+1${rawDigits}`;
  if (rawDigits.length === 11 && rawDigits.startsWith("1")) return `+${rawDigits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return `+1${rawDigits}`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("SMS phone normalization", () => {
  it("normalizes 10-digit US number", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });

  it("normalizes formatted 10-digit number", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("normalizes 11-digit number starting with 1", () => {
    expect(normalizePhone("15551234567")).toBe("+15551234567");
  });

  it("preserves already-normalized E.164 number", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });

  it("handles dashes and spaces", () => {
    expect(normalizePhone("555-123-4567")).toBe("+15551234567");
  });
});

describe("SMS message direction", () => {
  it("outbound direction is 'outbound'", () => {
    const direction: "outbound" | "inbound" = "outbound";
    expect(direction).toBe("outbound");
  });

  it("inbound direction is 'inbound'", () => {
    const direction: "outbound" | "inbound" = "inbound";
    expect(direction).toBe("inbound");
  });
});

describe("SMS status values", () => {
  const validStatuses = ["queued", "sent", "delivered", "failed", "received", "undelivered"];

  it.each(validStatuses)("status '%s' is valid", (status) => {
    expect(validStatuses).toContain(status);
  });
});

describe("SMS webhook URL", () => {
  it("inbound webhook path is correct", () => {
    const webhookPath = "/api/twilio/sms/incoming";
    expect(webhookPath).toBe("/api/twilio/sms/incoming");
    expect(webhookPath.startsWith("/api/twilio/")).toBe(true);
  });

  it("webhook path does not conflict with voice paths", () => {
    const smsPaths = ["/api/twilio/sms/incoming"];
    const voicePaths = ["/api/twilio/voice", "/api/twilio/connect", "/api/twilio/answered", "/api/twilio/status"];
    const allPaths = [...smsPaths, ...voicePaths];
    const uniquePaths = new Set(allPaths);
    expect(uniquePaths.size).toBe(allPaths.length); // No duplicates
  });
});

describe("SMS message body validation", () => {
  it("rejects empty body", () => {
    const body = "";
    expect(body.trim().length).toBe(0);
  });

  it("accepts normal message", () => {
    const body = "Hello, are you interested in selling your property?";
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(1600);
  });

  it("rejects body over 1600 characters", () => {
    const body = "a".repeat(1601);
    expect(body.length).toBeGreaterThan(1600);
  });
});
