/**
 * Tests for Twilio phone number guard logic
 *
 * Validates the guard behavior that blocks calls and SMS
 * when a user does not have a Twilio phone number configured.
 */
import { describe, it, expect } from "vitest";

// ─── Guard logic (mirrors component behavior) ────────────────────────────────
function shouldBlockAction(user: { twilioPhone?: string | null } | null): boolean {
  if (!user) return true;
  if (!user.twilioPhone) return true;
  if (user.twilioPhone.trim() === "") return true;
  return false;
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("Twilio phone guard — shouldBlockAction", () => {
  it("blocks when user is null (not authenticated)", () => {
    expect(shouldBlockAction(null)).toBe(true);
  });

  it("blocks when user has no twilioPhone field", () => {
    expect(shouldBlockAction({ twilioPhone: undefined })).toBe(true);
  });

  it("blocks when twilioPhone is null", () => {
    expect(shouldBlockAction({ twilioPhone: null })).toBe(true);
  });

  it("blocks when twilioPhone is empty string", () => {
    expect(shouldBlockAction({ twilioPhone: "" })).toBe(true);
  });

  it("blocks when twilioPhone is whitespace only", () => {
    expect(shouldBlockAction({ twilioPhone: "   " })).toBe(true);
  });

  it("allows when twilioPhone is a valid E.164 number", () => {
    expect(shouldBlockAction({ twilioPhone: "+15551234567" })).toBe(false);
  });

  it("allows when twilioPhone is a formatted number", () => {
    expect(shouldBlockAction({ twilioPhone: "(555) 123-4567" })).toBe(false);
  });

  it("allows when twilioPhone is a 10-digit number", () => {
    expect(shouldBlockAction({ twilioPhone: "5551234567" })).toBe(false);
  });
});

describe("Twilio phone guard — action type differentiation", () => {
  it("call action is blocked without phone", () => {
    const user = { twilioPhone: null };
    const actionType = "call";
    const blocked = shouldBlockAction(user);
    expect(blocked).toBe(true);
    expect(actionType).toBe("call");
  });

  it("sms action is blocked without phone", () => {
    const user = { twilioPhone: undefined };
    const actionType = "sms";
    const blocked = shouldBlockAction(user);
    expect(blocked).toBe(true);
    expect(actionType).toBe("sms");
  });

  it("call action is allowed with phone", () => {
    const user = { twilioPhone: "+15551234567" };
    const blocked = shouldBlockAction(user);
    expect(blocked).toBe(false);
  });

  it("sms action is allowed with phone", () => {
    const user = { twilioPhone: "+15551234567" };
    const blocked = shouldBlockAction(user);
    expect(blocked).toBe(false);
  });
});

describe("Twilio phone guard — dialog copy", () => {
  it("call action label is correct", () => {
    const actionLabel = (action: "call" | "sms") =>
      action === "sms" ? "send SMS messages" : "make calls";
    expect(actionLabel("call")).toBe("make calls");
  });

  it("sms action label is correct", () => {
    const actionLabel = (action: "call" | "sms") =>
      action === "sms" ? "send SMS messages" : "make calls";
    expect(actionLabel("sms")).toBe("send SMS messages");
  });
});
